import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, HttpError, jsonResponse, requireUser } from "../_shared/auth.ts";
import { buildClientFolderName, getDriveClient, getGoogleDriveConfig, getOfficialFolders } from "../_shared/google-drive.ts";

const escapeDriveQueryValue = (value: string) => String(value || "").replace(/'/g, "\\'");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await requireUser(req);

    const { clientName, ramo } = await req.json();
    if (!clientName) {
      throw new HttpError(400, "O nome do cliente é obrigatório.");
    }

    const rootFolderId = Deno.env.get("GOOGLE_DRIVE_ROOT_FOLDER_ID");
    if (!rootFolderId) {
      throw new Error("A raiz do Google Drive não está configurada.");
    }

    const drive = getDriveClient();
    const driveConfig = await getGoogleDriveConfig();
    const name = buildClientFolderName(clientName, ramo || driveConfig.ramo_fallback, driveConfig);

    const existingRootFolders = await drive.files.list({
      q: `name='${escapeDriveQueryValue(name)}' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name)",
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    let folderId = existingRootFolders.data.files?.[0]?.id || "";
    if (!folderId) {
      const folder = await drive.files.create({
        requestBody: {
          name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [rootFolderId],
        },
        supportsAllDrives: true,
        fields: "id",
      });

      folderId = folder.data.id || "";
    }

    if (!folderId) {
      throw new Error("Não foi possível criar a pasta principal do cliente.");
    }

    const existingSubfolders = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name)",
      pageSize: 200,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const existingMap = new Map(
      (existingSubfolders.data.files || [])
        .filter((item) => item.id && item.name)
        .map((item) => [String(item.name), String(item.id)])
    );

    const subfoldersMap: Record<string, string> = {};
    for (const subfolder of getOfficialFolders(driveConfig)) {
      const existingId = existingMap.get(subfolder);
      if (existingId) {
        subfoldersMap[subfolder] = existingId;
        continue;
      }

      const created = await drive.files.create({
        requestBody: {
          name: subfolder,
          mimeType: "application/vnd.google-apps.folder",
          parents: [folderId],
        },
        supportsAllDrives: true,
        fields: "id",
      });

      if (created.data.id) {
        subfoldersMap[subfolder] = created.data.id;
      }
    }

    return jsonResponse({
      folderId,
      subfolders: subfoldersMap,
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Erro interno ao criar pasta no Drive.";
    return jsonResponse({ error: message }, status);
  }
});
