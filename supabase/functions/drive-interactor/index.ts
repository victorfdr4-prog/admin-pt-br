import { corsHeaders, HttpError, jsonResponse, requireClientAccess } from "../_shared/auth.ts";
import { getDriveClient } from "../_shared/google-drive.ts";

// ── Helpers ───────────────────────────────────────────────────────────────────

const escapeDriveQueryValue = (value: string) => String(value || "").replace(/'/g, "\\'");

const sortItems = (items: unknown[], sort?: string, order?: string) => {
  const direction = order === "asc" ? 1 : -1;
  const sorted = [...items] as Array<Record<string, unknown>>;

  sorted.sort((a, b) => {
    if (sort === "name") {
      return String(a.name ?? "").localeCompare(String(b.name ?? ""), "pt-BR") * direction;
    }
    const left  = new Date(String(a.modifiedTime  ?? 0)).getTime();
    const right = new Date(String(b.modifiedTime ?? 0)).getTime();
    return (left - right) * direction;
  });

  return sorted;
};

// ── Entry point ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // ── CORS pre-flight ──────────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. Autenticação ANTES de qualquer coisa ──────────────────────────
    //    Lança HttpError(401) se não houver token ou se for inválido.
    //    requireClientAccess também valida clientId → HttpError(403/404).

    // Precisamos do clientId para requireClientAccess, então fazemos clone
    // do request para ler o body em paralelo com a validação.
    const bodyText = await req.text();

    let parsedBody: Record<string, unknown>;
    try {
      parsedBody = bodyText ? JSON.parse(bodyText) : {};
    } catch {
      return jsonResponse({ error: "INVALID_BODY", message: "Body não é JSON válido." }, 400);
    }

    const { action, clientId, folderId, name, search, sort, order } = parsedBody as Record<string, string | undefined>;

    // Validar auth + acesso ao cliente (lança 401/403/404 se falhar)
    const { client } = await requireClientAccess(
      new Request(req.url, {
        method: req.method,
        headers: req.headers,
        body: bodyText,
      }),
      clientId
    );

    // ── 2. Validações de negócio ──────────────────────────────────────────
    if (!client.drive_folder_id) {
      throw new HttpError(400, "Cliente sem pasta principal configurada no Drive.");
    }

    const drive = getDriveClient();
    const targetFolderId = folderId || client.drive_folder_id;

    // ── 3. Ações ──────────────────────────────────────────────────────────
    if (action === "list") {
      const folderMeta = await drive.files.get({
        fileId: targetFolderId,
        fields: "id, name, webViewLink",
        supportsAllDrives: true,
      });

      let q = `'${targetFolderId}' in parents and trashed = false`;
      if (search) {
        q += ` and name contains '${escapeDriveQueryValue(String(search))}'`;
      }

      const res = await drive.files.list({
        q,
        fields: "files(id, name, mimeType, size, modifiedTime, webViewLink)",
        pageSize: 200,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const items = sortItems(
        (res.data.files || []).map((file: Record<string, unknown>) => ({
          id: file.id,
          name: file.name,
          isFolder: file.mimeType === "application/vnd.google-apps.folder",
          mimeType: file.mimeType,
          size: file.size ? parseInt(String(file.size), 10) : 0,
          modifiedTime: file.modifiedTime,
          link: file.webViewLink,
        })),
        sort,
        order
      );

      return jsonResponse({
        clientName: client.name,
        rootFolderId: client.drive_folder_id,
        currentFolderId: targetFolderId,
        currentFolderLink: folderMeta.data.webViewLink,
        items,
      });
    }

    if (action === "create_folder") {
      if (!name) {
        throw new HttpError(400, "Informe o nome da nova pasta.");
      }

      const existingFolder = await drive.files.list({
        q: `name='${escapeDriveQueryValue(String(name))}' and '${targetFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id, name, webViewLink)",
        pageSize: 1,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const existing = existingFolder.data.files?.[0];
      if (existing?.id) {
        return jsonResponse({
          id: existing.id,
          name: existing.name,
          link: existing.webViewLink,
          alreadyExists: true,
        });
      }

      const res = await drive.files.create({
        requestBody: {
          name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [targetFolderId],
        },
        supportsAllDrives: true,
        fields: "id, name, webViewLink",
      });

      return jsonResponse({
        id: res.data.id,
        name: res.data.name,
        link: res.data.webViewLink,
      });
    }

    throw new HttpError(400, `Ação não suportada: "${action}".`);

  } catch (err) {
    // ── 4. Tratamento de erro global — nunca retorna 500 silencioso ───────
    console.error("[drive-interactor] FUNCTION_ERROR:", err);

    const status  = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error     ? err.message : "Falha interna na função drive-interactor.";

    return jsonResponse({ error: "FUNCTION_ERROR", message }, status);
  }
});
