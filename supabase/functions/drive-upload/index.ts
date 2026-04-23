import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, HttpError, jsonResponse, requireClientAccess } from "../_shared/auth.ts";
import { getDriveClient } from "../_shared/google-drive.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const clientId = String(formData.get("clientId") || "");
    const folderId = String(formData.get("folderId") || "");
    const file = formData.get("file");

    if (!clientId) {
      throw new HttpError(400, "Cliente não informado.");
    }
    if (!(file instanceof File)) {
      throw new HttpError(400, "Arquivo inválido.");
    }

    const { client, serviceClient } = await requireClientAccess(req, clientId);
    const drive = getDriveClient();
    const targetFolderId = folderId || client.drive_folder_id;
    if (!targetFolderId) {
      throw new HttpError(400, "Pasta de destino não definida.");
    }

    const folderMeta = await drive.files.get({
      fileId: targetFolderId,
      fields: "id, name",
      supportsAllDrives: true,
    });

    const escapedName = file.name.replace(/'/g, "\\'");
    const existingFileRes = await drive.files.list({
      q: `name='${escapedName}' and '${targetFolderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name)",
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const existingFile = existingFileRes.data.files?.[0];
    let driveFileId = existingFile?.id || "";
    let version = 1;
    let uploaded;

    if (existingFile?.id) {
      const { data: currentRow } = await serviceClient
        .from("drive_files")
        .select("version")
        .eq("file_id", existingFile.id)
        .maybeSingle();

      version = Number(currentRow?.version || 0) + 1;
      uploaded = await drive.files.update({
        fileId: existingFile.id,
        media: {
          mimeType: file.type || "application/octet-stream",
          body: file.stream() as any,
        },
        fields: "id, name, webViewLink, modifiedTime, size",
        supportsAllDrives: true,
      });
    } else {
      uploaded = await drive.files.create({
        requestBody: {
          name: file.name,
          parents: [targetFolderId],
        },
        media: {
          mimeType: file.type || "application/octet-stream",
          body: file.stream() as any,
        },
        fields: "id, name, webViewLink, modifiedTime, size",
        supportsAllDrives: true,
      });
    }

    driveFileId = uploaded.data.id || driveFileId;
    if (!driveFileId) {
      throw new Error("Upload realizado sem retornar ID do arquivo.");
    }

    const { error: syncError } = await serviceClient.from("drive_files").upsert(
      {
        client_id: client.id,
        file_id: driveFileId,
        name: file.name,
        mime_type: file.type || "application/octet-stream",
        folder_name: folderMeta.data.name || null,
        folder_id: targetFolderId,
        version,
        size_bytes: Number(uploaded.data.size || file.size || 0),
      },
      { onConflict: "file_id" }
    );

    if (syncError) {
      throw syncError;
    }

    return jsonResponse({
      success: true,
      file: {
        id: driveFileId,
        name: file.name,
        version,
        webViewLink: uploaded.data.webViewLink,
        modifiedTime: uploaded.data.modifiedTime,
      },
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Erro ao enviar arquivo para o Drive.";
    return jsonResponse({ error: message }, status);
  }
});
