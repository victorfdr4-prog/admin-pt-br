import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  corsHeaders,
  HttpError,
  jsonResponse,
  requireAdmin,
} from "../_shared/auth.ts";

const CALENDAR_SELECT =
  "id, client_id, month, year, title, template_name, status, exported_file_url, approval_status, approval_requested_at, approved_at, approved_by_name";
const CALENDAR_ITEM_SELECT =
  "id, calendar_id, post_date, day_number, post_type, title, description, notes, image_url, video_url, label_color, status, workflow_status, owner_role, revision_count, approval_status, approval_notes, approved_at, approved_by_name";

const isMissingColumnError = (error: unknown, columnName: string) => {
  const message = String((error as { message?: string })?.message || "").toLowerCase();
  const code = String((error as { code?: string })?.code || "").toUpperCase();
  return (
    (message.includes(columnName.toLowerCase()) &&
      (message.includes("does not exist") || message.includes("schema cache"))) ||
    code === "PGRST204"
  );
};

const buildPostingCalendarItemFallbackPayloads = (payload: {
  calendar_id: string;
  post_date: string;
  day_number: number;
  post_type: string;
  title?: string | null;
  description?: string | null;
  notes?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  label_color?: string | null;
  status?: string;
}) => {
  const normalizedPayload = {
    calendar_id: payload.calendar_id,
    post_date: payload.post_date,
    day_number: payload.day_number,
    post_type: payload.post_type || "feed",
    title: payload.title || null,
    description: payload.description || null,
    notes: payload.notes || null,
    image_url: payload.image_url || null,
    video_url: payload.video_url || null,
    label_color: payload.label_color || null,
    status: payload.status || "planned",
  };

  return [
    normalizedPayload,
    {
      calendar_id: normalizedPayload.calendar_id,
      post_date: normalizedPayload.post_date,
      day_number: normalizedPayload.day_number,
      post_type: normalizedPayload.post_type,
      title: normalizedPayload.title,
      description: normalizedPayload.description,
      notes: normalizedPayload.notes,
      status: normalizedPayload.status,
    },
    {
      calendar_id: normalizedPayload.calendar_id,
      post_date: normalizedPayload.post_date,
      day_number: normalizedPayload.day_number,
      post_type: normalizedPayload.post_type,
      title: normalizedPayload.title,
      status: normalizedPayload.status,
    },
    {
      calendar_id: normalizedPayload.calendar_id,
      post_date: normalizedPayload.post_date,
      day_number: normalizedPayload.day_number,
      post_type: normalizedPayload.post_type,
      title: normalizedPayload.title,
    },
  ];
};

const persistPostingCalendarItem = async (
  serviceClient: Awaited<ReturnType<typeof requireAdmin>>["serviceClient"],
  mode: "insert" | "update",
  payloads: Record<string, unknown>[],
  itemId?: string
) => {
  let lastError: unknown = null;

  for (const payload of payloads) {
    const query =
      mode === "update" && itemId
        ? serviceClient.from("posting_calendar_items").update(payload).eq("id", itemId).select("*").single()
        : serviceClient.from("posting_calendar_items").insert(payload).select("*").single();

    const { data, error } = await query;
    if (!error) return data;

    lastError = error;
    if (
      !isMissingColumnError(error, "approval_status") &&
      !isMissingColumnError(error, "approval_notes") &&
      !isMissingColumnError(error, "approved_at") &&
      !isMissingColumnError(error, "approved_by_name")
    ) {
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Não foi possível salvar o item do calendário.");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user, serviceClient } = await requireAdmin(req);
    const { action, payload } = await req.json();

    if (!action) throw new HttpError(400, "Ação obrigatória.");

    if (action === "save_item") {
      if (!payload?.calendar_id || !payload?.day_number || !payload?.post_date) {
        throw new HttpError(400, "Payload incompleto para salvar item.");
      }

      const { data: existing, error: existingError } = await serviceClient
        .from("posting_calendar_items")
        .select("id")
        .eq("calendar_id", payload.calendar_id)
        .eq("day_number", payload.day_number)
        .maybeSingle();

      if (existingError) throw existingError;

      const payloads = buildPostingCalendarItemFallbackPayloads(payload);
      const item = existing?.id
        ? await persistPostingCalendarItem(serviceClient, "update", payloads, existing.id)
        : await persistPostingCalendarItem(serviceClient, "insert", payloads);

      await serviceClient.from("activity_logs").insert({
        user_id: user.id,
        client_id: null,
        action: existing?.id ? "posting_calendar_item_updated" : "posting_calendar_item_created",
        entity: "posting_calendar_item",
        entity_id: item.id,
        metadata: {
          calendar_id: payload.calendar_id,
          day_number: payload.day_number,
          post_type: payload.post_type,
        },
      });

      return jsonResponse(item);
    }

    if (action === "delete_item") {
      const itemId = String(payload?.itemId || "");
      if (!itemId) throw new HttpError(400, "Item obrigatório.");

      const { error } = await serviceClient.from("posting_calendar_items").delete().eq("id", itemId);
      if (error) throw error;

      return jsonResponse({ ok: true });
    }

    if (action === "request_approval") {
      const calendarId = String(payload?.calendarId || "");
      if (!calendarId) throw new HttpError(400, "Calendário obrigatório.");

      const { data: calendar, error: calendarError } = await serviceClient
        .from("posting_calendars")
        .select(CALENDAR_SELECT)
        .eq("id", calendarId)
        .single();
      if (calendarError) throw calendarError;

      const [
        { data: client, error: clientError },
        { data: items, error: itemsError },
      ] = await Promise.all([
        serviceClient
          .from("clients")
          .select("id, name")
          .eq("id", calendar.client_id)
          .maybeSingle(),
        serviceClient
          .from("posting_calendar_items")
          .select(CALENDAR_ITEM_SELECT)
          .eq("calendar_id", calendarId)
          .order("day_number", { ascending: true }),
      ]);
      if (clientError) throw clientError;
      if (itemsError) throw itemsError;

      const { data: updatedCalendar, error: updateError } = await serviceClient
        .from("posting_calendars")
        .update({ status: "pending" })
        .eq("id", calendarId)
        .select(CALENDAR_SELECT)
        .single();
      if (updateError) throw updateError;

      const { error: itemWorkflowError } = await serviceClient
        .from("posting_calendar_items")
        .update({
          workflow_status: "em_aprovacao_cliente",
          approval_status: "pending",
          owner_role: "admin_operacional",
        })
        .eq("calendar_id", calendarId);
      if (itemWorkflowError) throw itemWorkflowError;

      try {
        const title = calendar.title || `Aprovação do calendário • ${client?.name || "Cliente"} • ${calendar.month}/${calendar.year}`;
        const description = `Calendário com ${(items || []).length} postagem(ns) para aprovação do cliente.`;
        const { data: existingApproval } = await serviceClient
          .from("approvals")
          .select("id,status")
          .eq("entity_type", "calendar_item")
          .eq("entity_id", calendar.id)
          .in("status", ["pending", "revision_requested"])
          .limit(1)
          .maybeSingle();

        const metadata = {
          source: "posting_calendar",
          calendar_id: calendar.id,
          client_id: calendar.client_id,
          client_name: client?.name || null,
          month: calendar.month,
          year: calendar.year,
          exported_file_url: calendar.exported_file_url || null,
          items_count: (items || []).length,
          items: items || [],
          approval_requested_at: new Date().toISOString(),
        };

        if (!existingApproval) {
          await serviceClient.from("approvals").insert({
            entity_type: "calendar_item",
            entity_id: calendar.id,
            client_id: calendar.client_id,
            title,
            description,
            status: "pending",
            requested_by: user.id,
            metadata,
          });
        } else {
          await serviceClient
            .from("approvals")
            .update({
              title,
              description,
              metadata,
              status: "pending",
              decision_notes: null,
              decided_by: null,
              decided_at: null,
            })
            .eq("id", existingApproval.id);
        }
      } catch (_error) {
        // Não bloquear o fluxo visual do calendário se approvals falhar.
      }

      return jsonResponse(updatedCalendar);
    }

    throw new HttpError(400, "Ação não suportada.");
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Erro no módulo de calendário.";
    return jsonResponse({ error: message }, status);
  }
});
