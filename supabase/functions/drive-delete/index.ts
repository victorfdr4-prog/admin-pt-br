import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, HttpError, jsonResponse, requireClientAccess } from "../_shared/auth.ts";
import { getDriveClient } from "../_shared/google-drive.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { clientId, fileId } = await req.json();
    if (!clientId || !fileId) {
      throw new HttpError(400, "Cliente e arquivo são obrigatórios.");
    }

    const { client, serviceClient } = await requireClientAccess(req, clientId);
    const drive = getDriveClient();

    await drive.files.update({
      fileId,
      requestBody: { trashed: true },
      supportsAllDrives: true,
    });

    await serviceClient.from("drive_files").delete().eq("client_id", client.id).eq("file_id", fileId);

    return jsonResponse({
      success: true,
      fileId,
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Erro ao excluir arquivo do Drive.";
    return jsonResponse({ error: message }, status);
  }
});
