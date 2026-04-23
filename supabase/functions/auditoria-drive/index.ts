import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders, HttpError, jsonResponse, requireClientAccess } from "../_shared/auth.ts";
import {
  getDestinationFolderName,
  getDriveClient,
  getGoogleDriveConfig,
  getOfficialFolders,
  normalizeFolderKey,
} from "../_shared/google-drive.ts";

interface DriveAuditItem {
  id?: string | null;
  name?: string | null;
  parents?: string[] | null;
}

const listAllDriveFiles = async (
  drive: ReturnType<typeof getDriveClient>,
  query: string,
  fields: string
): Promise<DriveAuditItem[]> => {
  const files: DriveAuditItem[] = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: query,
      fields: `nextPageToken, files(${fields})`,
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    files.push(...((response.data.files || []) as DriveAuditItem[]));
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  return files;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { clientId, clienteFolderId } = await req.json();
    if (!clienteFolderId) {
      throw new HttpError(400, "ID da pasta não fornecido.");
    }

    await requireClientAccess(req, clientId, clienteFolderId);

    const drive = getDriveClient();
    const driveConfig = await getGoogleDriveConfig();
    const relatorio = { pastasRenomeadas: 0, pastasCriadas: 0, arquivosMovidos: 0 };
    const mapaPastas: Record<string, string> = {};
    const pastaEsperadaMap = new Map(
      getOfficialFolders(driveConfig).map((folderName) => [normalizeFolderKey(folderName), folderName])
    );

    const existingFolders = await listAllDriveFiles(
      drive,
      `'${clienteFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      "id, name"
    );

    for (const folder of existingFolders) {
      const normalizedName = normalizeFolderKey(String(folder.name || ""));
      const desiredName = pastaEsperadaMap.get(normalizedName);
      if (desiredName && folder.name !== desiredName) {
        await drive.files.update({
          fileId: folder.id || "",
          requestBody: { name: desiredName },
          supportsAllDrives: true,
        });
        relatorio.pastasRenomeadas += 1;
      }

      if (folder.id) {
        mapaPastas[normalizedName] = folder.id;
      }
    }

    for (const officialFolder of getOfficialFolders(driveConfig)) {
      const officialKey = normalizeFolderKey(officialFolder);
      if (!mapaPastas[officialKey]) {
        const created = await drive.files.create({
          requestBody: {
            name: officialFolder,
            mimeType: "application/vnd.google-apps.folder",
            parents: [clienteFolderId],
          },
          supportsAllDrives: true,
          fields: "id",
        });

        if (created.data.id) {
          mapaPastas[officialKey] = created.data.id;
          relatorio.pastasCriadas += 1;
        }
      }
    }

    const rootFiles = await listAllDriveFiles(
      drive,
      `'${clienteFolderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
      "id, name, parents"
    );

    for (const file of rootFiles) {
      const fileName = String(file.name || "");
      const targetFolderName = getDestinationFolderName(fileName, driveConfig);
      const destinationFolderId = mapaPastas[normalizeFolderKey(targetFolderName)];

      if (!destinationFolderId || file.parents?.includes(destinationFolderId)) continue;

      await drive.files.update({
        fileId: file.id || "",
        addParents: destinationFolderId,
        removeParents: (file.parents || []).join(","),
        fields: "id",
        supportsAllDrives: true,
      });

      relatorio.arquivosMovidos += 1;
    }

    return jsonResponse({
      success: true,
      message: `Auditoria concluída. ${relatorio.pastasRenomeadas} pastas corrigidas, ${relatorio.pastasCriadas} pastas criadas e ${relatorio.arquivosMovidos} arquivos organizados.`,
      relatorio,
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Erro inesperado na auditoria do Drive.";
    return jsonResponse({ success: false, error: message }, status);
  }
});
