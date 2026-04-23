import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  corsHeaders,
  HttpError,
  jsonResponse,
  normalizeProfileRole,
  requireAdmin,
} from "../_shared/auth.ts";

const fallbackEmail = (username: string) => `${String(username || "user").toLowerCase()}@cromia.local`;
const toLegacyRole = (role: unknown) => {
  const normalized = String(role || "").trim();
  if (normalized === "admin_estrategico" || normalized === "admin_operacional" || normalized === "sistema") {
    return "admin";
  }
  if (normalized === "gestor") return "manager";
  return "user";
};

const persistProfile = async (
  serviceClient: Awaited<ReturnType<typeof requireAdmin>>["serviceClient"],
  mode: "create" | "update",
  userId: string,
  payload: Record<string, unknown>
) => {
  const action = mode === "create"
    ? serviceClient.from("profiles").upsert(payload, { onConflict: "id" }).select("*").single()
    : serviceClient.from("profiles").update(payload).eq("id", userId).select("*").single();

  let response = await action;

  if (
    response.error &&
    (
      String(response.error.message || "").toLowerCase().includes("access_scope") ||
      String(response.error.message || "").toLowerCase().includes("functional_profile")
    )
  ) {
    const fallbackPayload = { ...payload };
    delete fallbackPayload.access_scope;
    delete fallbackPayload.functional_profile;

    response = mode === "create"
      ? await serviceClient.from("profiles").upsert(fallbackPayload, { onConflict: "id" }).select("*").single()
      : await serviceClient.from("profiles").update(fallbackPayload).eq("id", userId).select("*").single();
  }

  if (
    response.error &&
    String(response.error.message || "").toLowerCase().includes("role")
  ) {
    const fallbackPayload = {
      ...payload,
      role: toLegacyRole(payload.role),
    };
    delete fallbackPayload.access_scope;
    delete fallbackPayload.functional_profile;

    response = mode === "create"
      ? await serviceClient.from("profiles").upsert(fallbackPayload, { onConflict: "id" }).select("*").single()
      : await serviceClient.from("profiles").update(fallbackPayload).eq("id", userId).select("*").single();
  }

  if (response.error) throw response.error;
  return response.data;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { serviceClient, profile } = await requireAdmin(req);
    const normalizedRole = normalizeProfileRole(profile as Record<string, unknown>);

    if (!["admin_estrategico", "admin_operacional"].includes(normalizedRole)) {
      throw new HttpError(403, "unauthorized");
    }

    const { action, userId, payload } = await req.json();

    if (!action || !payload) {
      throw new HttpError(400, "Ação e payload são obrigatórios.");
    }

    if (action === "create_user") {
      const email = String(payload.email || fallbackEmail(payload.username));
      const password = String(payload.password || "");
      const fullName = String(payload.full_name || "");
      const username = String(payload.username || "");

      if (!fullName || !username) {
        throw new HttpError(400, "Nome e username são obrigatórios.");
      }

      if (!password) {
        throw new HttpError(400, "Informe uma senha para o novo membro.");
      }

      const { data: createdUser, error: createError } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          username,
        },
      });

      if (createError || !createdUser.user) {
        throw new Error(createError?.message || "Falha ao criar usuário.");
      }

      const profilePayload = {
        id: createdUser.user.id,
        email,
        full_name: fullName,
        username,
        role: String(payload.role || payload.legacy_role || "user"),
        access_scope: payload.access_scope ? String(payload.access_scope) : null,
        functional_profile: payload.functional_profile ? String(payload.functional_profile) : null,
        phone: payload.phone ? String(payload.phone) : null,
        bio: payload.bio ? String(payload.bio) : "",
        avatar_url: payload.avatar_url ? String(payload.avatar_url) : null,
        specialties: Array.isArray(payload.specialties) ? payload.specialties : [],
        active: payload.active !== false,
      };

      const profile = await persistProfile(serviceClient, "create", createdUser.user.id, profilePayload);

      return jsonResponse(profile);
    }

    if (action === "update_user") {
      if (!userId) {
        throw new HttpError(400, "ID do usuário é obrigatório para atualização.");
      }

      const authUpdate: Record<string, unknown> = {};
      if (payload.email) authUpdate.email = String(payload.email);
      if (payload.full_name || payload.username) {
        authUpdate.user_metadata = {
          ...(payload.full_name ? { full_name: String(payload.full_name) } : {}),
          ...(payload.username ? { username: String(payload.username) } : {}),
        };
      }

      if (Object.keys(authUpdate).length > 0) {
        const { error: authError } = await serviceClient.auth.admin.updateUserById(userId, authUpdate);
        if (authError) {
          throw authError;
        }
      }

      const profilePatch: Record<string, unknown> = {};
      if ("email" in payload) profilePatch.email = String(payload.email || "");
      if ("full_name" in payload) profilePatch.full_name = String(payload.full_name || "");
      if ("username" in payload) profilePatch.username = String(payload.username || "");
      if ("role" in payload) profilePatch.role = String(payload.role || payload.legacy_role || "user");
      if ("access_scope" in payload) profilePatch.access_scope = payload.access_scope ? String(payload.access_scope) : null;
      if ("functional_profile" in payload) profilePatch.functional_profile = payload.functional_profile ? String(payload.functional_profile) : null;
      if ("phone" in payload) profilePatch.phone = payload.phone ? String(payload.phone) : null;
      if ("bio" in payload) profilePatch.bio = payload.bio ? String(payload.bio) : "";
      if ("avatar_url" in payload) profilePatch.avatar_url = payload.avatar_url ? String(payload.avatar_url) : null;
      if ("specialties" in payload) profilePatch.specialties = Array.isArray(payload.specialties) ? payload.specialties : [];
      if ("active" in payload) profilePatch.active = payload.active !== false;

      const profile = await persistProfile(serviceClient, "update", userId, profilePatch);

      return jsonResponse(profile);
    }

    if (action === "change_password") {
      if (!userId) {
        throw new HttpError(400, "ID do usuário é obrigatório para redefinir senha.");
      }

      const newPassword = String(payload.password || "");
      if (!newPassword) {
        throw new HttpError(400, "Informe a nova senha.");
      }

      const { error: pwError } = await serviceClient.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (pwError) throw pwError;

      return jsonResponse({ success: true });
    }

    throw new HttpError(400, "Ação administrativa não suportada.");
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Erro ao gerenciar usuários.";
    return jsonResponse({ error: message }, status);
  }
});
