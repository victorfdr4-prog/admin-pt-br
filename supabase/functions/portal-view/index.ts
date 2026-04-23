import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, jsonResponse, getServiceClient } from "../_shared/auth.ts";
import { getDriveClient } from "../_shared/google-drive.ts";

const CLIENT_SELECT = "id, name, logo_url, portal_token, portal_active";
const PORTAL_ROW_SELECT = "id, created_at, expires_at, is_active";
const CALENDAR_SELECT =
  "id, client_id, month, year, title, template_name, status, exported_file_url, approval_status, approval_requested_at, approved_at, approved_by_name";
const CALENDAR_ITEM_SELECT =
  "id, calendar_id, parent_post_id, version_number, post_date, day_number, post_type, title, description, notes, image_url, video_url, label_color, status, workflow_status, owner_role, revision_count, approval_status, approval_notes, approved_at, approved_by_name, scheduled_date, published_at, current_version_id, change_reason, change_log, is_current_version, created_at, updated_at, owner_id";
const CALENDAR_ITEM_SELECT_LEGACY =
  "id, calendar_id, parent_post_id, version_number, post_date, day_number, post_type, title, description, notes, image_url, video_url, label_color, status, workflow_status, owner_role, revision_count, approval_status, approval_notes, approved_at, approved_by_name, current_version_id, change_reason, change_log, is_current_version, created_at, updated_at, owner_id";
const POST_VERSION_SELECT =
  "id, post_id, version_number, title, content, created_by, created_at, change_reason, is_current";
const TEMPLATE_SELECT = "id, client_id, name, slug, legend_items, config, is_active, updated_at";
const DRIVE_FILE_SELECT =
  "id, file_id, name, mime_type, folder_id, folder_name, size_bytes, version, created_at";
const TASK_SELECT =
  "id, client_id, title, description, status, priority, order_index, assignee_id, due_date, checklist, custom_fields, created_at, updated_at";
const PORTAL_VISIBLE_WORKFLOW_STATUSES = [
  "em_aprovacao_cliente",
  "revisao_cliente",
  "aprovado_cliente",
  "aguardando_agendamento",
  "agendado",
  "publicado",
] as const;

const buildDriveFileUrl = (fileId: string, mode: "view" | "download" = "view") =>
  mode === "download"
    ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`
    : `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;

const slugify = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const ALLOWED_INTAKE_TYPES = new Set(["general", "creative", "campaign", "support", "onboarding", "internal"]);

const parseDataUrl = (value: string) => {
  const match = /^data:(.+?);base64,(.+)$/i.exec(String(value || "").trim());
  if (!match) return null;
  return {
    contentType: match[1],
    base64: match[2],
  };
};

const decodeBase64ToBytes = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const uploadPortalAttachment = async (
  serviceClient: ReturnType<typeof getServiceClient>,
  clientId: string,
  payload: {
    attachmentDataUrl?: string | null;
    attachmentName?: string | null;
    attachmentContentType?: string | null;
  }
) => {
  const rawDataUrl = String(payload.attachmentDataUrl || "").trim();
  if (!rawDataUrl) return null;

  const parsed = parseDataUrl(rawDataUrl);
  if (!parsed) {
    throw new Error("Anexo do portal em formato inválido.");
  }

  const fileName = String(payload.attachmentName || "anexo").trim() || "anexo";
  const safeName = slugify(fileName.replace(/\.[^.]+$/u, "")) || "anexo";
  const extensionMatch = /\.([a-z0-9]+)$/iu.exec(fileName);
  const extension = extensionMatch ? `.${extensionMatch[1].toLowerCase()}` : "";
  const contentType = String(payload.attachmentContentType || parsed.contentType || "application/octet-stream");
  const bytes = decodeBase64ToBytes(parsed.base64);
  const path = `portal-intake/${clientId}/${crypto.randomUUID()}-${safeName}${extension}`;

  const { error: uploadError } = await serviceClient.storage.from("posting-calendars").upload(path, bytes, {
    contentType,
    upsert: false,
  });

  if (uploadError) throw uploadError;

  const publicUrlData = serviceClient.storage.from("posting-calendars").getPublicUrl(path);
  return {
    bucket: "posting-calendars",
    path,
    name: fileName,
    content_type: contentType,
    size_bytes: bytes.byteLength,
    public_url: publicUrlData.data.publicUrl,
  };
};

const DEFAULT_TABLE_COLUMNS = [
  { id: "task", label: "Tarefa", visible: true, client_visible: true, order: 1 },
  { id: "assignee", label: "Responsável", visible: true, client_visible: true, order: 2 },
  { id: "status", label: "Status", visible: true, client_visible: true, order: 3 },
  { id: "due_date", label: "Prazo", visible: true, client_visible: true, order: 4 },
  { id: "priority", label: "Prioridade", visible: true, client_visible: true, order: 5 },
  { id: "updated_at", label: "Atualização", visible: true, client_visible: true, order: 6 },
];

const DEFAULT_PIPELINE = [
  { id: "todo", title: "Not Started", color: "#c4c4c4", order: 1 },
  { id: "in-progress", title: "Working on it", color: "#fdab3d", order: 2 },
  { id: "stuck", title: "Stuck", color: "#e2445c", order: 3 },
  { id: "done", title: "Done", color: "#00c875", order: 4 },
];

const isMissingRelationError = (error: unknown, relationName: string) => {
  const message = String((error as { message?: string })?.message || "").toLowerCase();
  return message.includes(relationName.toLowerCase()) && message.includes("does not exist");
};

const isMissingColumnError = (error: unknown, columnName: string) => {
  const message = String((error as { message?: string })?.message || "").toLowerCase();
  const code = String((error as { code?: string })?.code || "").toUpperCase();
  return (
    (message.includes(columnName.toLowerCase()) &&
      (message.includes("does not exist") || message.includes("schema cache"))) ||
    code === "PGRST204"
  );
};

const normalizeVersionContent = (value: unknown) => {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    description: typeof record.description === "string" ? record.description : null,
    notes: typeof record.notes === "string" ? record.notes : null,
    image_url: typeof record.image_url === "string" ? record.image_url : null,
    video_url: typeof record.video_url === "string" ? record.video_url : null,
    post_type: typeof record.post_type === "string" ? record.post_type : null,
    label_color: typeof record.label_color === "string" ? record.label_color : null,
    workflow_status: typeof record.workflow_status === "string" ? record.workflow_status : null,
    approval_status: typeof record.approval_status === "string" ? record.approval_status : null,
    day_number: typeof record.day_number === "number" ? record.day_number : null,
    post_date: typeof record.post_date === "string" ? record.post_date : null,
  };
};

const mapPostVersionRow = (row: Record<string, unknown>) => ({
  id: String(row.id || ""),
  post_id: String(row.post_id || ""),
  version_number: Number(row.version_number || 0),
  title: typeof row.title === "string" ? row.title : null,
  content: normalizeVersionContent(row.content),
  created_by: typeof row.created_by === "string" ? row.created_by : null,
  created_at: String(row.created_at || ""),
  change_reason: typeof row.change_reason === "string" ? row.change_reason : null,
  change_log: Array.isArray(row.change_log)
    ? row.change_log.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [],
  is_current: row.is_current === true,
});

const normalizeChangeLog = (value: unknown) =>
  Array.isArray(value)
    ? value.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];

const mapCalendarLineageRowToVersion = (row: Record<string, unknown>) => ({
  id: String(row.id || ""),
  post_id: String(row.parent_post_id || row.id || ""),
  version_number: Number(row.version_number || 1),
  title: typeof row.title === "string" ? row.title : null,
  content: {
    description: typeof row.description === "string" ? row.description : null,
    notes: typeof row.notes === "string" ? row.notes : null,
    image_url: typeof row.image_url === "string" ? row.image_url : null,
    video_url: typeof row.video_url === "string" ? row.video_url : null,
    post_type: typeof row.post_type === "string" ? row.post_type : null,
    label_color: typeof row.label_color === "string" ? row.label_color : null,
    workflow_status: typeof row.workflow_status === "string" ? row.workflow_status : null,
    approval_status: typeof row.approval_status === "string" ? row.approval_status : null,
    day_number: typeof row.day_number === "number" ? row.day_number : null,
    post_date: typeof row.post_date === "string" ? row.post_date : null,
  },
  created_by: typeof row.owner_id === "string" ? row.owner_id : null,
  created_at: String(row.created_at || row.updated_at || ""),
  change_reason: typeof row.change_reason === "string" ? row.change_reason : null,
  change_log: normalizeChangeLog(row.change_log),
  is_current: row.is_current_version !== false,
});

const getCurrentPostVersion = (versions: Array<ReturnType<typeof mapPostVersionRow>>) =>
  versions.find((version) => version.is_current) || versions[0] || null;

const getPreviousPostVersion = (versions: Array<ReturnType<typeof mapPostVersionRow>>) => {
  const current = getCurrentPostVersion(versions);
  return versions.find((version) => version.id !== current?.id) || null;
};

const buildCalendarApprovalPayloads = (payload: Record<string, unknown>) => {
  const fallback = Object.fromEntries(
    Object.entries(payload).filter(
      ([key]) =>
        !["approval_status", "approval_requested_at", "approved_at", "approved_by_name"].includes(key)
    )
  );

  return [payload, fallback].filter((entry, index, source) => {
    const keys = Object.keys(entry);
    if (!keys.length) return false;
    return source.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(entry)) === index;
  });
};

const updateCalendarWithFallback = async (
  serviceClient: ReturnType<typeof getServiceClient>,
  calendarId: string,
  payloads: Record<string, unknown>[]
) => {
  let lastError: unknown = null;

  for (const payload of payloads) {
    const { data, error } = await serviceClient
      .from("posting_calendars")
      .update(payload)
      .eq("id", calendarId)
      .select(CALENDAR_SELECT)
      .single();

    if (!error) {
      return data;
    }

    lastError = error;
    if (
      !isMissingColumnError(error, "approval_status") &&
      !isMissingColumnError(error, "approval_requested_at") &&
      !isMissingColumnError(error, "approved_at") &&
      !isMissingColumnError(error, "approved_by_name")
    ) {
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Não foi possível atualizar o calendário.");
};

const updateCalendarItemsApprovalWithFallback = async (
  serviceClient: ReturnType<typeof getServiceClient>,
  calendarId: string,
  payloads: Record<string, unknown>[],
  allowedCurrentStatuses: string[] = []
) => {
  const buildUpdateQuery = (payload: Record<string, unknown>) => {
    let query = serviceClient
      .from("posting_calendar_items")
      .update(payload)
      .eq("calendar_id", calendarId);

    if (allowedCurrentStatuses.length > 0) {
      query = query.in("workflow_status", allowedCurrentStatuses);
    }

    return query;
  };

  for (const payload of payloads) {
    const queryWithSoftDelete = buildUpdateQuery(payload).is("deleted_at", null);
    let response = await queryWithSoftDelete;
    let error = response.error;

    if (error && isMissingColumnError(error, "deleted_at")) {
      response = await buildUpdateQuery(payload);
      error = response.error;
    }

    if (!error) {
      return true;
    }

    if (
      !isMissingColumnError(error, "approval_status") &&
      !isMissingColumnError(error, "approval_notes") &&
      !isMissingColumnError(error, "approved_at") &&
      !isMissingColumnError(error, "approved_by_name")
    ) {
      throw error;
    }
  }

  return false;
};

const updateSingleCalendarItemApprovalWithFallback = async (
  serviceClient: ReturnType<typeof getServiceClient>,
  calendarItemId: string,
  payloads: Record<string, unknown>[],
  allowedCurrentStatuses: string[] = []
) => {
  const buildUpdateQuery = (payload: Record<string, unknown>) => {
    let query = serviceClient
      .from("posting_calendar_items")
      .update(payload)
      .eq("id", calendarItemId);

    if (allowedCurrentStatuses.length > 0) {
      query = query.in("workflow_status", allowedCurrentStatuses);
    }

    return query;
  };

  for (const payload of payloads) {
    const queryWithSoftDelete = buildUpdateQuery(payload).is("deleted_at", null);
    let response = await queryWithSoftDelete;
    let error = response.error;

    if (error && isMissingColumnError(error, "deleted_at")) {
      response = await buildUpdateQuery(payload);
      error = response.error;
    }

    if (!error) {
      return true;
    }

    if (
      !isMissingColumnError(error, "approval_status") &&
      !isMissingColumnError(error, "approval_notes") &&
      !isMissingColumnError(error, "approved_at") &&
      !isMissingColumnError(error, "approved_by_name")
    ) {
      throw error;
    }
  }

  return false;
};

const syncApprovalBundleWithCalendarDecision = async (
  serviceClient: ReturnType<typeof getServiceClient>,
  calendarId: string,
  calendarItemId: string | null,
  isApprove: boolean,
  now: string,
  reviewerName: string,
  reviewNote: string
) => {
  const { data: approval } = await serviceClient
    .from("approvals")
    .select("id")
    .eq("entity_type", "calendar_item")
    .eq("entity_id", calendarId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!approval?.id) return;

  const itemDecisionStatus = isApprove ? "approved" : "revision_requested";
  let itemsUpdateQuery = serviceClient
    .from("approval_items")
    .update({
      status: itemDecisionStatus,
      feedback: isApprove ? null : reviewNote || "Ajustes solicitados pelo cliente.",
      reviewer_name: reviewerName,
      decided_at: now,
      updated_at: now,
    })
    .eq("approval_id", approval.id)
    .eq("status", "pending");

  if (calendarItemId) {
    itemsUpdateQuery = itemsUpdateQuery.eq("calendar_post_id", calendarItemId);
  }

  const { error: itemsSyncError } = await itemsUpdateQuery;
  if (itemsSyncError) throw itemsSyncError;

  const { data: approvalItems, error: itemsReadError } = await serviceClient
    .from("approval_items")
    .select("status")
    .eq("approval_id", approval.id);
  if (itemsReadError) throw itemsReadError;

  const statuses = (approvalItems || []).map((row: any) => String(row.status || ""));
  let approvalStatus = "pending";
  if (statuses.length > 0 && statuses.every((status) => status === "approved")) {
    approvalStatus = "approved";
  } else if (statuses.length > 0 && statuses.every((status) => status !== "pending") && statuses.some((status) => status === "rejected")) {
    approvalStatus = "rejected";
  } else if (
    statuses.length > 0 &&
    statuses.every((status) => status !== "pending") &&
    statuses.some((status) => status === "revision_requested")
  ) {
    approvalStatus = "revision_requested";
  }

  const { error: approvalSyncError } = await serviceClient
    .from("approvals")
    .update({
      status: approvalStatus,
      decided_at: now,
      decision_notes: isApprove ? null : reviewNote || null,
      updated_at: now,
    })
    .eq("id", approval.id);
  if (approvalSyncError) throw approvalSyncError;
};

const resolvePortalClient = async (
  serviceClient: ReturnType<typeof getServiceClient>,
  token: string
) => {
  const { data: client, error: clientError } = await serviceClient
    .from("clients")
    .select(CLIENT_SELECT)
    .eq("portal_token", token)
    .eq("portal_active", true)
    .maybeSingle();

  let resolvedClient = client;

  if ((clientError || !resolvedClient) && token) {
    const { data: fallbackClients, error: fallbackError } = await serviceClient
      .from("clients")
      .select(CLIENT_SELECT)
      .eq("portal_active", true);

    if (fallbackError) {
      throw fallbackError;
    }

    resolvedClient =
      (fallbackClients || []).find((item: any) => slugify(String(item.name || "")) === slugify(token)) || null;
  }

  if (!resolvedClient) {
    return { client: null, portalRow: null };
  }

  const { data: portalRow } = await serviceClient
    .from("client_portal")
    .select(PORTAL_ROW_SELECT)
    .eq("client_id", resolvedClient.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    client: resolvedClient,
    portalRow,
  };
};

const loadLatestCalendar = async (
  serviceClient: ReturnType<typeof getServiceClient>,
  clientId: string
) => {
  logPortalQuery({
    cliente: clientId,
    tabela: "posting_calendars",
    query: "SELECT calendário mais recente do cliente",
    detalhes: {
      client_id: clientId,
    },
  });
  const { data, error } = await serviceClient
    .from("posting_calendars")
    .select(CALENDAR_SELECT)
    .eq("client_id", clientId)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[PORTAL] Erro ao consultar calendário do cliente", {
      cliente: clientId,
      tabela: "posting_calendars",
      error,
    });
    throw error;
  }
  logPortalResult({
    cliente: clientId,
    tabela: "posting_calendars",
    resultado: data?.id ? "calendário carregado" : "nenhum calendário encontrado",
    total: data?.id ? 1 : 0,
    detalhes: {
      calendar_id: data?.id || null,
    },
  });
  return data || null;
};

const loadCalendarItems = async (
  serviceClient: ReturnType<typeof getServiceClient>,
  calendarId?: string | null,
  clientName?: string | null
) => {
  if (!calendarId) return [];
  logPortalQuery({
    cliente: clientName || calendarId,
    tabela: "posting_calendar_items",
    query: "SELECT posts visíveis do portal por calendário",
    detalhes: {
      calendar_id: calendarId,
      workflow_status: PORTAL_VISIBLE_WORKFLOW_STATUSES,
    },
  });
  let calendarItemSelect = CALENDAR_ITEM_SELECT;
  const buildBaseQuery = (selectClause = calendarItemSelect) =>
    serviceClient
      .from("posting_calendar_items")
      .select(selectClause)
      .eq("calendar_id", calendarId)
      .in("workflow_status", [...PORTAL_VISIBLE_WORKFLOW_STATUSES])
      .order("day_number", { ascending: true });

  let response = await buildBaseQuery().is("deleted_at", null);

  if (
    response.error &&
    (isMissingColumnError(response.error, "scheduled_date") || isMissingColumnError(response.error, "published_at"))
  ) {
    calendarItemSelect = CALENDAR_ITEM_SELECT_LEGACY;
    response = await buildBaseQuery().is("deleted_at", null);
  }

  if (response.error && isMissingColumnError(response.error, "deleted_at")) {
    response = await buildBaseQuery();
  }

  if (response.error) {
      console.error("[PORTAL] Erro ao consultar posts do portal", {
        cliente: clientName || calendarId,
        tabela: "posting_calendar_items",
        calendarId,
        statusFilter: PORTAL_VISIBLE_WORKFLOW_STATUSES,
        error: response.error,
      });
    throw response.error;
  }
  const rows = (response.data || []).filter((item: any) => item.is_current_version !== false);
  logPortalResult({
    cliente: clientName || calendarId,
    tabela: "posting_calendar_items",
    resultado: "posts carregados para o portal",
    total: rows.length,
    detalhes: {
      calendar_id: calendarId,
      workflow_status: PORTAL_VISIBLE_WORKFLOW_STATUSES,
    },
  });
  const parentIds = Array.from(
    new Set(rows.map((item: any) => String(item.parent_post_id || item.id || "")).filter(Boolean))
  );

  if (!parentIds.length) return rows;

  let lineageRows: any[] = [];
  let lineageResponse = await serviceClient
    .from("posting_calendar_items")
    .select(calendarItemSelect)
    .in("parent_post_id", parentIds)
    .order("version_number", { ascending: false })
    .order("created_at", { ascending: false });

  if (
    lineageResponse.error &&
    (isMissingColumnError(lineageResponse.error, "scheduled_date") || isMissingColumnError(lineageResponse.error, "published_at"))
  ) {
    lineageResponse = await serviceClient
      .from("posting_calendar_items")
      .select(CALENDAR_ITEM_SELECT_LEGACY)
      .in("parent_post_id", parentIds)
      .order("version_number", { ascending: false })
      .order("created_at", { ascending: false });
  }

  if (!lineageResponse.error) {
    lineageRows = lineageResponse.data || [];
  } else {
    const postIds = rows.map((item: any) => String(item.id)).filter(Boolean);
    const { data: versionRows, error: versionError } = await serviceClient
      .from("post_versions")
      .select(POST_VERSION_SELECT)
      .in("post_id", postIds)
      .order("version_number", { ascending: false });

    const versionsMap = new Map<string, Array<ReturnType<typeof mapPostVersionRow>>>();
    if (!versionError) {
      for (const row of versionRows || []) {
        const version = mapPostVersionRow(row as Record<string, unknown>);
        const bucket = versionsMap.get(version.post_id) || [];
        bucket.push(version);
        versionsMap.set(version.post_id, bucket);
      }
    }

    if (!rows.length) {
      console.warn("[PORTAL] Nenhum post retornado para o portal", {
        cliente: clientName || calendarId,
        calendarId,
        statusFilter: PORTAL_VISIBLE_WORKFLOW_STATUSES,
      });
    }

    return rows.map((item: any) => {
      const versions = versionsMap.get(String(item.id)) || [];
      return {
        ...item,
        versions,
        current_version: getCurrentPostVersion(versions),
        previous_version: getPreviousPostVersion(versions),
        current_version_number: getCurrentPostVersion(versions)?.version_number || null,
      };
    });
  }

  const versionsByParent = new Map<string, Array<ReturnType<typeof mapCalendarLineageRowToVersion>>>();
  for (const row of lineageRows) {
    const parentId = String((row as any).parent_post_id || (row as any).id || "");
    const bucket = versionsByParent.get(parentId) || [];
    bucket.push(mapCalendarLineageRowToVersion(row as Record<string, unknown>));
    versionsByParent.set(parentId, bucket);
  }

  return rows.map((item: any) => {
    const parentId = String(item.parent_post_id || item.id || "");
    const versions = versionsByParent.get(parentId) || [];
    return {
      ...item,
      versions,
      current_version: getCurrentPostVersion(versions),
      previous_version: getPreviousPostVersion(versions),
      current_version_number: getCurrentPostVersion(versions)?.version_number || Number(item.version_number || 1),
    };
  });
};

const loadLatestPlanning = async (
  serviceClient: ReturnType<typeof getServiceClient>,
  clientId: string
) => {
  try {
    const { data, error } = await serviceClient
      .from("planejamentos")
      .select("id, cliente_id, plano_id, conteudo, created_at, updated_at")
      .eq("cliente_id", clientId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    if (isMissingRelationError(error, "planejamentos")) return null;
    throw error;
  }
};

const resolveCalendarTemplate = async (
  serviceClient: ReturnType<typeof getServiceClient>,
  clientId: string,
  settingsMap: Map<string, unknown>
) => {
  try {
    const { data: clientTemplate, error: clientError } = await serviceClient
      .from("posting_calendar_templates")
      .select(TEMPLATE_SELECT)
      .eq("client_id", clientId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (clientError) throw clientError;
    if (clientTemplate) {
      return {
        ...clientTemplate,
        ...((clientTemplate as { config?: Record<string, unknown> }).config || {}),
        legend_items: clientTemplate.legend_items,
        scope: "client",
        client_id: clientId,
      };
    }

    const { data: defaultTemplate, error: defaultError } = await serviceClient
      .from("posting_calendar_templates")
      .select(TEMPLATE_SELECT)
      .is("client_id", null)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (defaultError) throw defaultError;
    if (defaultTemplate) {
      return {
        ...defaultTemplate,
        ...((defaultTemplate as { config?: Record<string, unknown> }).config || {}),
        legend_items: defaultTemplate.legend_items,
        scope: "default",
        client_id: null,
      };
    }
  } catch (error) {
    if (!isMissingRelationError(error, "posting_calendar_templates")) {
      throw error;
    }
  }

  const registry = settingsMap.get("posting_calendar_templates");
  if (registry && typeof registry === "object") {
    const record = registry as { clients?: Record<string, unknown>; default?: unknown };
    if (record.clients?.[clientId]) return record.clients[clientId];
    if (record.default) return record.default;
  }

  return null;
};

const buildPortalPayload = async (
  serviceClient: ReturnType<typeof getServiceClient>,
  resolvedClient: any,
  portalRow: any
) => {
  const [
    { data: settingsRows, error: settingsError },
    { data: driveFiles, error: filesError },
    { data: taskRows, error: tasksError },
    calendar,
    planning,
  ] = await Promise.all([
    serviceClient
      .from("system_settings")
      .select("key, value")
      .in("key", [
        "board_table_columns",
        "kanban_pipeline",
        "board_view_preferences",
        "posting_calendar_templates",
        "branding",
      ]),
    serviceClient
      .from("drive_files")
      .select(DRIVE_FILE_SELECT)
      .eq("client_id", resolvedClient.id)
      .order("created_at", { ascending: false }),
    serviceClient
      .from("tasks")
      .select(TASK_SELECT)
      .eq("client_id", resolvedClient.id)
      .order("order_index", { ascending: true })
      .order("updated_at", { ascending: false }),
    loadLatestCalendar(serviceClient, resolvedClient.id),
    loadLatestPlanning(serviceClient, resolvedClient.id),
  ]);

  if (settingsError) throw settingsError;
  if (filesError) throw filesError;
  if (tasksError) throw tasksError;

  const settingsMap = new Map((settingsRows || []).map((row: any) => [String(row.key), row.value]));

  const activeDriveFiles = await (async () => {
    if (!driveFiles?.length) return [];
    const drive = getDriveClient();

    const checks = await Promise.all(
      (driveFiles || []).map(async (file: any) => {
        if (!file?.file_id) return null;

        try {
          const meta = await drive.files.get({
            fileId: String(file.file_id),
            fields: "id, trashed",
            supportsAllDrives: true,
          });

          if (meta.data.trashed) return null;
          return file;
        } catch {
          return null;
        }
      })
    );

    return checks.filter(Boolean);
  })();

  const taskRowsSorted = (taskRows || [])
    .sort((left, right) => {
      const leftOrder = Number(left.order_index || 0);
      const rightOrder = Number(right.order_index || 0);
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      const leftUpdated = new Date(left.updated_at || left.created_at || 0).getTime();
      const rightUpdated = new Date(right.updated_at || right.created_at || 0).getTime();
      return rightUpdated - leftUpdated;
    });

  const assigneeIds = Array.from(
    new Set(taskRowsSorted.map((task: any) => String(task.assignee_id || "")).filter(Boolean))
  );

  const assignees =
    assigneeIds.length > 0
      ? await (async () => {
          const { data, error } = await serviceClient
            .from("profiles")
            .select("id, full_name, avatar_url, username")
            .in("id", assigneeIds);

          if (error) {
            throw error;
          }

          return data || [];
        })()
      : [];

  const assigneeMap = new Map((assignees || []).map((person: any) => [String(person.id), person]));
  const calendarItems = await loadCalendarItems(serviceClient, calendar?.id, resolvedClient.name);
  const calendarTemplate = await resolveCalendarTemplate(serviceClient, resolvedClient.id, settingsMap);
  const branding = (settingsMap.get("branding") as Record<string, unknown> | null) || null;

  return {
    portal: {
      id: portalRow?.id || resolvedClient.id,
      token: resolvedClient.portal_token,
      is_active: portalRow?.is_active ?? true,
      expires_at: portalRow?.expires_at || null,
      created_at: portalRow?.created_at || null,
    },
    client: {
      id: resolvedClient.id,
      name: resolvedClient.name,
      logo_url: resolvedClient.logo_url,
    },
    branding: {
      logo_url: branding?.logo_url ? String(branding.logo_url) : null,
    },
    board: {
      table_columns: normalizeTableColumns(settingsMap.get("board_table_columns")),
      pipeline: normalizePipelineColumns(settingsMap.get("kanban_pipeline")),
      default_view:
        (settingsMap.get("board_view_preferences") as { defaultView?: string } | undefined)?.defaultView || "table",
    },
    tasks: taskRowsSorted.map((task: any) => {
      const assignee = assigneeMap.get(String(task.assignee_id || ""));
      return {
        id: task.id,
        client_id: task.client_id,
        client_name: resolvedClient.name,
        title: task.title,
        description: task.description || "",
        status: task.status,
        priority: task.priority || "medium",
        order_index: Number(task.order_index || 0),
        assignee_id: task.assignee_id || null,
        assignee_name: assignee?.full_name || assignee?.username || null,
        assignee_avatar: assignee?.avatar_url || null,
        due_date: task.due_date || null,
        checklist: task.checklist || [],
        custom_fields: task.custom_fields || null,
        created_at: task.created_at || null,
        updated_at: task.updated_at || null,
      };
    }),
    calendar,
    calendar_items: calendarItems,
    calendar_template: calendarTemplate,
    planning,
    files: (activeDriveFiles || []).map((file: any) => ({
      id: file.id,
      name: file.name,
      mime_type: file.mime_type || "application/octet-stream",
      size: Number(file.size_bytes || 0),
      modified_time: file.created_at,
      version: Number(file.version || 1),
      folder_id: file.folder_id,
      folder_name: file.folder_name,
      folder_path: file.folder_name || resolvedClient.name,
      drive_view_url: buildDriveFileUrl(file.file_id, "view"),
      preview_url: buildDriveFileUrl(file.file_id, "view"),
      download_url: buildDriveFileUrl(file.file_id, "download"),
      can_edit: false,
    })),
    permissions: {
      can_edit: false,
      can_download: true,
      can_preview: true,
    },
  };
};

const normalizeTableColumns = (value: unknown) => {
  const source = Array.isArray((value as { columns?: unknown[] })?.columns)
    ? (value as { columns: unknown[] }).columns
    : Array.isArray(value)
      ? value
      : [];

  const mapped = source
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const fallback = DEFAULT_TABLE_COLUMNS.find((column) => column.id === String(record.id || ""));
      if (!fallback) return null;

      return {
        id: fallback.id,
        label: String(record.label || fallback.label),
        visible: record.visible !== false,
        client_visible: record.client_visible !== false,
        order: Number(record.order || index + 1),
      };
    })
    .filter((item): item is (typeof DEFAULT_TABLE_COLUMNS)[number] => Boolean(item));

  return DEFAULT_TABLE_COLUMNS.map((fallback, index) => {
    const current = mapped.find((item) => item.id === fallback.id);
    return current ? { ...fallback, ...current } : { ...fallback, order: index + 1 };
  }).sort((left, right) => left.order - right.order);
};

const normalizePipelineColumns = (value: unknown) => {
  const source = Array.isArray((value as { columns?: unknown[] })?.columns)
    ? (value as { columns: unknown[] }).columns
    : Array.isArray(value)
      ? value
      : [];

  const mapped = source
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const fallback = DEFAULT_PIPELINE.find((column) => column.id === String(record.id || ""));
      if (!fallback) return null;

      return {
        id: fallback.id,
        title: String(record.title || fallback.title),
        color: String(record.color || fallback.color),
        order: Number(record.order || index + 1),
      };
    })
    .filter((item): item is (typeof DEFAULT_PIPELINE)[number] => Boolean(item));

  return DEFAULT_PIPELINE.map((fallback, index) => {
    const current = mapped.find((item) => item.id === fallback.id);
    return current ? { ...fallback, ...current } : { ...fallback, order: index + 1 };
  }).sort((left, right) => left.order - right.order);
};

const logPortalQuery = (params: {
  cliente?: string | null;
  tabela: string;
  query: string;
  detalhes?: Record<string, unknown>;
}) => {
  console.log(
    [
      "[PORTAL]",
      `Cliente: ${params.cliente || "desconhecido"}`,
      `Tabela: ${params.tabela}`,
      `Query: ${params.query}`,
      params.detalhes ? `Detalhes: ${JSON.stringify(params.detalhes)}` : null,
    ]
      .filter(Boolean)
      .join("\n")
  );
};

const logPortalResult = (params: {
  cliente?: string | null;
  tabela: string;
  resultado: string;
  total?: number | null;
  detalhes?: Record<string, unknown>;
}) => {
  console.log(
    [
      "[PORTAL]",
      `Cliente: ${params.cliente || "desconhecido"}`,
      `Tabela: ${params.tabela}`,
      `Resultado: ${params.resultado}`,
      typeof params.total === "number" ? `Total: ${params.total}` : null,
      params.detalhes ? `Detalhes: ${JSON.stringify(params.detalhes)}` : null,
    ]
      .filter(Boolean)
      .join("\n")
  );
};

const logWorkflowAction = (params: {
  acao: string;
  statusAnterior: string;
  statusNovo: string;
  cliente?: string | null;
  postId?: string | null;
  observacao?: string | null;
}) => {
  console.log(
    [
      "[WORKFLOW]",
      `Ação: ${params.acao}`,
      `Status anterior: ${params.statusAnterior}`,
      `Status novo: ${params.statusNovo}`,
      `Cliente: ${params.cliente || "desconhecido"}`,
      params.postId ? `Post: ${params.postId}` : null,
      params.observacao ? `Obs: ${params.observacao}` : null,
    ]
      .filter(Boolean)
      .join("\n")
  );
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const body =
      req.method === "POST"
        ? await req
            .json()
            .catch(() => ({}))
        : {};
    const token = String(url.searchParams.get("token") || (body as { token?: string }).token || "").trim();

    if (!token) {
      return jsonResponse({ error: "Token do portal ausente." }, 400);
    }

    const serviceClient = getServiceClient();
    const { client: resolvedClient, portalRow } = await resolvePortalClient(serviceClient, token);

    logPortalResult({
      cliente: resolvedClient?.name || token,
      tabela: "client_portal",
      resultado: "portal resolvido",
      total: resolvedClient ? 1 : 0,
      detalhes: {
        token,
        client_id: resolvedClient?.id || null,
        portal_id: portalRow?.id || null,
        method: req.method,
      },
    });

    if (!resolvedClient) {
      return jsonResponse({ error: "Portal não encontrado ou desativado." }, 404);
    }

    if (portalRow?.is_active === false) {
      return jsonResponse({ error: "Este portal foi desativado." }, 403);
    }

    if (portalRow?.expires_at && new Date(portalRow.expires_at).getTime() < Date.now()) {
      return jsonResponse({ error: "Este portal expirou." }, 403);
    }

    if (req.method === "POST") {
      const action = String((body as { action?: string }).action || "").trim();
      if (!action) {
        return jsonResponse({ error: "Ação do portal ausente." }, 400);
      }

      const explicitCalendarId = String((body as { calendarId?: string }).calendarId || "").trim();
      const reviewNote = String(
        (body as { note?: string; reviewNote?: string }).note ||
          (body as { note?: string; reviewNote?: string }).reviewNote ||
          ""
      ).trim();
      const calendar = explicitCalendarId
        ? await (async () => {
            const { data, error } = await serviceClient
              .from("posting_calendars")
              .select(CALENDAR_SELECT)
              .eq("id", explicitCalendarId)
              .eq("client_id", resolvedClient.id)
              .maybeSingle();
            if (error) throw error;
            return data;
          })()
        : await loadLatestCalendar(serviceClient, resolvedClient.id);

      if (!calendar) {
        return jsonResponse({ error: "Calendário não encontrado para este cliente." }, 404);
      }

      if (action === "approve_calendar" || action === "request_calendar_changes") {
        const isApprove = action === "approve_calendar";
        const now = new Date().toISOString();
        const reviewerName = resolvedClient.name;
        const calendarItemId = String((body as { calendarItemId?: string }).calendarItemId || "").trim();
        const requestedCategories = Array.isArray((body as { categories?: unknown[] }).categories)
          ? (body as { categories?: unknown[] }).categories
              .map((entry) => String(entry || "").trim())
              .filter(Boolean)
          : [];

        if (!isApprove && !reviewNote) {
          return jsonResponse({ error: "Comentario obrigatorio para solicitar alteracoes." }, 400);
        }

        if (!isApprove && requestedCategories.length === 0) {
          return jsonResponse({ error: "Selecione pelo menos um tipo de ajuste." }, 400);
        }

        let latestRevisionQuery = serviceClient
          .from("posting_calendar_items")
          .select("revision_count")
          .eq("calendar_id", calendar.id);

        if (calendarItemId) {
          latestRevisionQuery = latestRevisionQuery.eq("id", calendarItemId);
        }

        const { data: latestRevision, error: latestRevisionError } = await latestRevisionQuery
          .order("revision_count", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestRevisionError) throw latestRevisionError;

        const maxRevisionCount = Number(latestRevision?.revision_count || 0);
        if (!isApprove && maxRevisionCount >= 2) {
          return jsonResponse(
            { error: "Limite de revisão atingido (2). Contate a equipe diretamente." },
            400
          );
        }

        const noteWithCategories = isApprove
          ? null
          : requestedCategories.length
            ? `[${requestedCategories.join(", ")}] ${reviewNote || "Ajustes solicitados pelo cliente."}`
            : reviewNote || "Ajustes solicitados pelo cliente.";
        const previousWorkflowStatus = "em_aprovacao_cliente";
        const nextWorkflowStatus = isApprove ? "aprovado_cliente" : "revisao_cliente";

        const itemPayloads = [
          {
            approval_status: isApprove ? "approved" : "changes_requested",
            approval_notes: noteWithCategories,
            approved_at: isApprove ? now : null,
            approved_by_name: isApprove ? reviewerName : null,
            workflow_status: isApprove ? "aprovado_cliente" : "revisao_cliente",
            owner_role: "cliente",
            ...(!isApprove ? { revision_count: maxRevisionCount + 1 } : {}),
          },
          {},
        ];

        if (calendarItemId) {
          await updateSingleCalendarItemApprovalWithFallback(
            serviceClient,
            calendarItemId,
            itemPayloads,
            isApprove ? ["em_aprovacao_cliente"] : ["em_aprovacao_cliente"]
          );
        } else {
          await updateCalendarItemsApprovalWithFallback(
            serviceClient,
            calendar.id,
            itemPayloads,
            isApprove ? ["em_aprovacao_cliente"] : ["em_aprovacao_cliente"]
          );
        }

        logWorkflowAction({
          acao: isApprove ? "aprovar_post_no_portal" : "solicitar_ajuste_no_portal",
          statusAnterior: previousWorkflowStatus,
          statusNovo: nextWorkflowStatus,
          cliente: resolvedClient.name,
          postId: calendarItemId || null,
          observacao: noteWithCategories || null,
        });

        await syncApprovalBundleWithCalendarDecision(
          serviceClient,
          String(calendar.id),
          calendarItemId || null,
          isApprove,
          now,
          reviewerName,
          noteWithCategories || ""
        );

        try {
          await serviceClient.from("activity_logs").insert({
              action: isApprove ? "posting_calendar_approved_by_client" : "posting_calendar_changes_requested",
              entity_type: "posting_calendar",
              entity_id: calendarItemId || calendar.id,
              client_id: resolvedClient.id,
              metadata: {
                note: noteWithCategories || null,
                categories: requestedCategories,
                calendar_item_id: calendarItemId || null,
                portal_token: token,
              },
            });
        } catch {
          // best effort only
        }

        const refreshedItems = await loadCalendarItems(serviceClient, calendar.id, resolvedClient.name);
        const allApproved =
          refreshedItems.length > 0 &&
          refreshedItems.every((item: any) =>
            ["aprovado_cliente", "aguardando_agendamento", "agendado", "publicado"].includes(String(item.workflow_status || ""))
          );
        const hasRevisionRequested = refreshedItems.some(
          (item: any) => String(item.workflow_status || "") === "revisao_cliente"
        );

        const updatedCalendar = await updateCalendarWithFallback(
          serviceClient,
          calendar.id,
          buildCalendarApprovalPayloads({
            status: allApproved ? "approved" : hasRevisionRequested ? "changes_requested" : "pending",
            approval_status: allApproved ? "approved" : hasRevisionRequested ? "changes_requested" : "pending",
            approval_requested_at: allApproved ? null : now,
            approved_at: allApproved ? now : null,
            approved_by_name: allApproved ? reviewerName : null,
          })
        );

        return jsonResponse({
          ok: true,
          calendar: updatedCalendar,
          calendar_items: refreshedItems,
        });
      }

      if (action === "submit_intake") {
        const title = String((body as { title?: string }).title || "").trim();
        const description = String((body as { description?: string }).description || "").trim();
        const intakeType = String((body as { type?: string }).type || "general").trim().toLowerCase();
        const references = String((body as { references?: string }).references || "").trim();
        const requestKind = String((body as { request_kind?: string }).request_kind || "").trim();

        if (!title) {
          return jsonResponse({ error: "Titulo da solicitacao ausente." }, 400);
        }

        const normalizedType = ALLOWED_INTAKE_TYPES.has(intakeType) ? intakeType : "general";
        const attachment = await uploadPortalAttachment(serviceClient, resolvedClient.id, {
          attachmentDataUrl: String((body as { attachment_data_url?: string }).attachment_data_url || ""),
          attachmentName: String((body as { attachment_name?: string }).attachment_name || ""),
          attachmentContentType: String((body as { attachment_content_type?: string }).attachment_content_type || ""),
        });

        const { data: intake, error: intakeError } = await serviceClient
          .from("intake_requests")
          .insert({
            title,
            description: description || null,
            client_id: resolvedClient.id,
            status: "new",
            source: "portal",
            priority: "medium",
            type: normalizedType,
            form_data: {
              portal_token: token,
              client_name: resolvedClient.name,
              references: references || null,
              request_kind: requestKind || null,
              attachment,
            },
          })
          .select("id, title, status, created_at")
          .single();

        if (intakeError) throw intakeError;

        console.log("[PORTAL] Solicitação criada", {
          cliente: resolvedClient.name,
          tabela: "intake_requests",
          titulo: title,
          tipo: normalizedType,
          possuiAnexo: Boolean(attachment),
        });

        return jsonResponse({
          ok: true,
          intake,
        });
      }

      return jsonResponse({ error: "Ação do portal inválida." }, 400);
    }

    return jsonResponse(await buildPortalPayload(serviceClient, resolvedClient, portalRow));
  } catch (error: any) {
    const message = error?.message || (typeof error === "string" ? error : "Erro ao carregar portal.");
    const details = error?.details || error?.hint || (error instanceof Error ? error.stack : "");
    console.error("Erro geral do portal:", { message, details, error });
    return jsonResponse({ error: message, details }, 500);
  }
});
