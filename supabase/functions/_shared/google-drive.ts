import { google } from "https://esm.sh/googleapis@126.0.1";
import { getServiceClient } from "./auth.ts";

export const DIRETORIOS_INTELIGENTES = {
  pdf: "04_CONTRATOS",
  doc: "04_CONTRATOS",
  docx: "04_CONTRATOS",
  xls: "04_CONTRATOS",
  xlsx: "04_CONTRATOS",
  ppt: "04_CONTRATOS",
  pptx: "04_CONTRATOS",
  ai: "01_LOGO",
  eps: "01_LOGO",
  svg: "01_LOGO",
  cdr: "01_LOGO",
  jpg: "02_FOTOS",
  jpeg: "02_FOTOS",
  png: "02_FOTOS",
  webp: "02_FOTOS",
  raw: "02_FOTOS",
  heic: "02_FOTOS",
  mp4: "05_ANUNCIOS",
  mov: "05_ANUNCIOS",
  avi: "05_ANUNCIOS",
  mkv: "05_ANUNCIOS",
  mp3: "06_AUDIO",
  wav: "06_AUDIO",
  psd: "03_EDITAVEIS",
  fig: "03_EDITAVEIS",
  xd: "03_EDITAVEIS",
} as const;

export const PASTAS_OFICIAIS = [
  "00_OUTROS",
  "01_LOGO",
  "02_FOTOS",
  "03_EDITAVEIS",
  "04_CONTRATOS",
  "05_ANUNCIOS",
  "06_AUDIO",
];

export interface GoogleDriveConfig {
  folder_pattern: string;
  uppercase: boolean;
  ramo_fallback: string;
  fallback_folder: string;
  subfolders: string[];
  extension_rules: Record<string, string>;
}

export const DEFAULT_GOOGLE_DRIVE_CONFIG: GoogleDriveConfig = {
  folder_pattern: "[CROMIA]_{cliente}_{ramo}",
  uppercase: true,
  ramo_fallback: "GERAL",
  fallback_folder: "00_OUTROS",
  subfolders: [...PASTAS_OFICIAIS],
  extension_rules: { ...DIRETORIOS_INTELIGENTES },
};

const getCredentials = () => {
  const base64 = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_BASE64");
  const rawJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT") || Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

  const source = base64 ? atob(base64) : rawJson;
  if (!source) {
    throw new Error("Credenciais do Google Drive não configuradas.");
  }

  const credentials = JSON.parse(source);
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error("Credenciais do Google Drive inválidas.");
  }

  return credentials;
};

const uniqueLines = (items: string[]) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

const normalizeDriveText = (item: unknown) => {
  if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
    const cleaned = String(item).trim();
    if (
      !cleaned ||
      cleaned === "[object Object]" ||
      cleaned === "[object Undefined]" ||
      cleaned === "[object Null]"
    ) {
      return "";
    }
    return cleaned.toUpperCase() === "06_OUTROS" ? "00_OUTROS" : cleaned;
  }

  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;
    const candidate =
      record.name ??
      record.label ??
      record.title ??
      record.value ??
      record.folder ??
      record.path ??
      record.key ??
      record.text;

    if (typeof candidate === "string" || typeof candidate === "number" || typeof candidate === "boolean") {
      const cleaned = String(candidate).trim();
      if (
        !cleaned ||
        cleaned === "[object Object]" ||
        cleaned === "[object Undefined]" ||
        cleaned === "[object Null]"
      ) {
        return "";
      }
      return cleaned.toUpperCase() === "06_OUTROS" ? "00_OUTROS" : cleaned;
    }
  }

  return "";
};

const sortLinesAlphabetically = (items: string[]) =>
  uniqueLines(items).sort((left, right) => left.localeCompare(right, "pt-BR", { sensitivity: "base" }));

const applyConfiguredCase = (value: string, uppercase: boolean) => (uppercase ? value.toUpperCase() : value);

export const normalizeFolderKey = (value: string) => value.trim().toUpperCase();

export const normalizeGoogleDriveConfig = (value: unknown): GoogleDriveConfig => {
  if (!value || typeof value !== "object") return DEFAULT_GOOGLE_DRIVE_CONFIG;
  const source = value as Partial<GoogleDriveConfig>;

  const subfolders = sortLinesAlphabetically(
    Array.isArray(source.subfolders) ? source.subfolders.map((item) => normalizeDriveText(item)) : DEFAULT_GOOGLE_DRIVE_CONFIG.subfolders
  );

  const extensionRules =
    source.extension_rules && typeof source.extension_rules === "object"
      ? Object.entries(source.extension_rules as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, folder]) => {
          const extension = String(key || "").trim().toLowerCase();
          const folderName = normalizeDriveText(folder);
          if (extension && folderName) acc[extension] = folderName;
          return acc;
        }, {})
      : DEFAULT_GOOGLE_DRIVE_CONFIG.extension_rules;
  const orderedExtensionRules = Object.fromEntries(
    Object.entries(extensionRules).sort(([left], [right]) => left.localeCompare(right, "pt-BR", { sensitivity: "base" }))
  );

  return {
    folder_pattern: String(source.folder_pattern || DEFAULT_GOOGLE_DRIVE_CONFIG.folder_pattern),
    uppercase: source.uppercase !== false,
    ramo_fallback: String(source.ramo_fallback || DEFAULT_GOOGLE_DRIVE_CONFIG.ramo_fallback),
    fallback_folder:
      normalizeDriveText(source.fallback_folder) || DEFAULT_GOOGLE_DRIVE_CONFIG.fallback_folder,
    subfolders: subfolders.length ? subfolders : DEFAULT_GOOGLE_DRIVE_CONFIG.subfolders,
    extension_rules: Object.keys(orderedExtensionRules).length ? orderedExtensionRules : DEFAULT_GOOGLE_DRIVE_CONFIG.extension_rules,
  };
};

export const getGoogleDriveConfig = async (): Promise<GoogleDriveConfig> => {
  const serviceClient = getServiceClient();
  const { data } = await serviceClient.from("system_settings").select("value").eq("key", "google_drive").maybeSingle();
  return normalizeGoogleDriveConfig(data?.value);
};

export const getOfficialFolders = (config: GoogleDriveConfig = DEFAULT_GOOGLE_DRIVE_CONFIG) =>
  sortLinesAlphabetically(config.subfolders).map((folder) => applyConfiguredCase(folder, config.uppercase));

export const buildClientFolderName = (
  clientName: string,
  ramo?: string | null,
  config: GoogleDriveConfig = DEFAULT_GOOGLE_DRIVE_CONFIG
) => {
  const resolvedClient = String(clientName || "CLIENTE").trim();
  const resolvedRamo = String(ramo || config.ramo_fallback || "GERAL").trim();
  const formatted = config.folder_pattern
    .replace(/\{cliente\}/gi, resolvedClient)
    .replace(/\{ramo\}/gi, resolvedRamo)
    .trim()
    .replace(/\s+/g, " ");

  return applyConfiguredCase(formatted, config.uppercase);
};

export const getDestinationFolderName = (
  fileName: string,
  config: GoogleDriveConfig = DEFAULT_GOOGLE_DRIVE_CONFIG
) => {
  const extension = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() || "" : "";
  const targetFolder =
    config.extension_rules[extension] ||
    config.fallback_folder ||
    getOfficialFolders(config).at(-1) ||
    DEFAULT_GOOGLE_DRIVE_CONFIG.fallback_folder;

  return applyConfiguredCase(String(targetFolder), config.uppercase);
};

export const getDriveClient = () => {
  const credentials = getCredentials();
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({ version: "v3", auth });
};
