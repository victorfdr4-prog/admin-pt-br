import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios nas Edge Functions.");
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Cliente com service_role — apenas para uso interno nas Edge Functions (NUNCA expor no frontend). */
export const getServiceClient = () =>
  createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

// ── Auth ───────────────────────────────────────────────────────────────────────

/**
 * Extrai e valida o JWT do header Authorization.
 * Usa o serviceClient para verificar o token — mais confiável que o client anon.
 */
export const requireUser = async (req: Request) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    console.error("[EDGE_AUTH] Token ausente no header Authorization.");
    throw new HttpError(401, "Requisição sem token de autenticação.");
  }

  const serviceClient = getServiceClient();
  const { data: { user }, error } = await serviceClient.auth.getUser(token);

  if (error || !user) {
    console.error("[EDGE_AUTH] Falha ao validar JWT.", {
      message: error?.message ?? "Usuário ausente.",
    });
    throw new HttpError(401, "Sessão inválida ou expirada. Faça login novamente.");
  }

  return { user, token };
};

/**
 * Requer usuário autenticado e com papel de administrador (admin_estrategico | admin_operacional).
 * Lança 403 se o papel não for suficiente.
 */
export const requireAdmin = async (req: Request) => {
  const { user, token } = await requireUser(req);
  const serviceClient = getServiceClient();

  const { data: profile, error } = await serviceClient
    .from("profiles")
    .select("id, role, active, full_name, username, email, access_scope, functional_profile")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    throw new HttpError(403, "Perfil não encontrado.");
  }

  if (!profile.active) {
    throw new HttpError(403, "Conta desativada.");
  }

  const role = normalizeProfileRole(profile);
  const isAdmin = role === "admin_estrategico" || role === "admin_operacional";

  if (!isAdmin) {
    throw new HttpError(403, "Apenas administradores podem executar esta ação.");
  }

  return { user, profile, serviceClient, token };
};

/**
 * Requer acesso ao cliente especificado — admin vê todos, outros apenas clientes próprios.
 */
export const requireClientAccess = async (
  req: Request,
  clientId?: string,
  fallbackFolderId?: string
) => {
  const { user, token } = await requireUser(req);
  const serviceClient = getServiceClient();

  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("id, role, active, full_name, username, email, access_scope, functional_profile")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.active) {
    throw new HttpError(403, "Usuário sem acesso ativo.");
  }

  let query = serviceClient.from("clients").select("id, owner_id, name, drive_folder_id, drive_subfolders");
  if (clientId) {
    query = query.eq("id", clientId);
  } else if (fallbackFolderId) {
    query = query.eq("drive_folder_id", fallbackFolderId);
  } else {
    throw new HttpError(400, "Cliente não informado.");
  }

  const { data: client, error: clientError } = await query.single();
  if (clientError || !client) {
    console.error("[EDGE_AUTH] Cliente não encontrado para acesso.", {
      clientId: clientId ?? null,
      fallbackFolderId: fallbackFolderId ?? null,
      message: clientError?.message ?? null,
    });
    throw new HttpError(404, "Cliente não encontrado.");
  }

  const role = normalizeProfileRole(profile);
  const isAdmin = role === "admin_estrategico" || role === "admin_operacional";

  if (!isAdmin && client.owner_id !== user.id) {
    console.error("[EDGE_AUTH] Acesso ao cliente negado.", {
      userId: user.id,
      clientId: client.id,
      ownerId: client.owner_id,
      role,
    });
    throw new HttpError(403, "Você não tem acesso a este cliente.");
  }

  return { user, profile, client, serviceClient, token };
};

// ── Role helpers ───────────────────────────────────────────────────────────────

const normalizeToken = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");

const inferLeadershipRole = (profile: Record<string, unknown>) => {
  const scope = normalizeToken(profile.access_scope);
  if (scope === "full") return "admin_operacional";
  return "gestor";
};

export const normalizeProfileRole = (profile: Record<string, unknown>) => {
  const role = normalizeToken(profile.role);
  if (role === "admin_estrategico" || role === "admin_operacional") return role;
  // retrocompat: legado 'admin' → inferir pelo escopo
  if (role === "admin") return inferLeadershipRole(profile);
  return role;
};

export const hasFullAccess = (profile: Record<string, unknown>) => {
  const role = normalizeProfileRole(profile);
  const scope = normalizeToken(profile.access_scope);
  return (
    scope === "full" ||
    role === "admin_estrategico" ||
    role === "admin_operacional"
  );
};
