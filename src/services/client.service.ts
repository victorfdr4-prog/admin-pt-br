import { supabase } from '@/lib/supabase';
import {
  getCurrentUser,
  slugify,
  logActivity,
  invokeFunction,
  readFileAsDataUrl,
  provisionOnboardingTasks,
  isQuietClient,
  PORTAL_FALLBACK_DOMAIN,
} from './_shared';

export const ClientService = {
  getAll: async (params?: { search?: string; status?: string; include_free_or_trade?: boolean }) => {
    let query = supabase.from('clients').select('*').order('created_at', { ascending: false });

    if (params?.status && params.status !== 'all') query = query.eq('status', params.status);
    if (params?.search) query = query.or(`name.ilike.%${params.search}%,email.ilike.%${params.search}%`);

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao carregar clientes:', error);
      return [];
    }

    return (data || []).filter((item) => params?.include_free_or_trade || !isQuietClient(item as Record<string, unknown>));
  },

  getById: async (id: string) => {
    const { data, error } = await supabase.from('clients').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  create: async (payload: Record<string, any>) => {
    const user = await getCurrentUser();
    const insertPayload = {
      owner_id: user.id,
      name: String(payload.name || '').trim(),
      email: String(payload.email || '').trim() || `${slugify(payload.name || 'cliente')}@${PORTAL_FALLBACK_DOMAIN}`,
      phone: payload.phone ? String(payload.phone).trim() : null,
      plan: String(payload.plan || 'Social Media Mensal'),
      industry: payload.industry ? String(payload.industry).trim() : null,
      notes: payload.notes ? String(payload.notes).trim() : null,
      site_url: payload.site_url ? String(payload.site_url).trim() : null,
      site_description: payload.site_description ? String(payload.site_description).trim() : null,
      display_order: Number(payload.display_order || 0),
      is_visible_site: payload.is_visible_site !== false,
      is_featured_site: Boolean(payload.is_featured_site),
      testimonial_content: payload.testimonial_content ? String(payload.testimonial_content).trim() : null,
      testimonial_author_name: payload.testimonial_author_name ? String(payload.testimonial_author_name).trim() : null,
      testimonial_author_role: payload.testimonial_author_role ? String(payload.testimonial_author_role).trim() : null,
      testimonial_author_avatar: payload.testimonial_author_avatar ? String(payload.testimonial_author_avatar).trim() : null,
      testimonial_rating: Number(payload.testimonial_rating || 5),
      testimonial_display_order: Number(payload.testimonial_display_order || 0),
      is_testimonial_visible: Boolean(payload.is_testimonial_visible),
      is_free_or_trade: Boolean(payload.is_free_or_trade),
      one_time_payment: Boolean(payload.one_time_payment),
      generate_drive_folder: payload.generate_drive_folder !== false,
      status: payload.status || 'active',
      portal_active: !isQuietClient(payload),
    };


    const { data, error } = await supabase.from('clients').insert(insertPayload).select('*').single();
    if (error) throw error;

    let clientRow = data;

    if (payload.provision_onboarding !== false) {
      try {
        await provisionOnboardingTasks(clientRow.id);
      } catch (provisionError) {
        console.error('Falha ao provisionar onboarding:', provisionError);
      }
    }

    if (clientRow.generate_drive_folder !== false) {
      try {
        const driveData = await invokeFunction<{ folderId?: string; subfolders?: Record<string, string> }>('create-drive-folder', {
          clientName: clientRow.name,
          ramo: clientRow.industry || clientRow.segment || 'GERAL',
        });

        if (driveData?.folderId) {
          const { data: updatedClient, error: updateError } = await supabase
            .from('clients')
            .update({
              drive_folder_id: driveData.folderId,
              drive_subfolders: driveData.subfolders || {},
            })
            .eq('id', clientRow.id)
            .select('*')
            .single();

          if (!updateError && updatedClient) clientRow = updatedClient;
        }
      } catch (driveError) {
        console.error('Falha ao criar pasta inicial do Drive:', driveError);
      }
    }

    if (clientRow.is_free_or_trade) {
      // Don't create boards for restricted clients as requested
      await logActivity('client_created', 'client', clientRow.id, clientRow.id, {
        name: clientRow.name,
        plan: clientRow.plan,
        restricted: true,
      });
      return clientRow;
    }

    try {
      const { data: existingBoard } = await supabase
        .from('boards')
        .select('id')
        .eq('client_id', clientRow.id)
        .limit(1)
        .maybeSingle();

      if (!existingBoard) {
        const { data: board } = await supabase
          .from('boards')
          .insert({
            name: `Board - ${clientRow.name}`,
            client_id: clientRow.id,
            color: '#111827',
            icon: 'kanban',
            sort_order: 1,
          })
          .select('id')
          .single();

        if (board?.id) {
          await supabase.from('board_statuses').insert([
            { board_id: board.id, name: 'A Fazer', color: '#94a3b8', sort_order: 0, is_done: false },
            { board_id: board.id, name: 'Em Andamento', color: '#f59e0b', sort_order: 1, is_done: false },
            { board_id: board.id, name: 'Em Revisão', color: '#8b5cf6', sort_order: 2, is_done: false },
            { board_id: board.id, name: 'Concluído', color: '#10b981', sort_order: 3, is_done: true },
          ]);
        }
      }
    } catch (boardError) {
      console.error('Falha ao provisionar client_board:', boardError);
    }

    await logActivity('client_created', 'client', clientRow.id, clientRow.id, {
      name: clientRow.name,
      plan: clientRow.plan,
    });

    return clientRow;
  },

  update: async (id: string, payload: any) => {
    const { data, error } = await supabase.from('clients').update(payload).eq('id', id).select('*').single();
    if (error) throw error;

    await logActivity('client_updated', 'client', id, id, {
      fields: Object.keys(payload || {}),
    });

    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
    await logActivity('client_deleted', 'client', id, id);
  },

  uploadLogo: async (clientId: string, file: File) => {
    const logoUrl = await readFileAsDataUrl(file);
    const { data, error } = await supabase
      .from('clients')
      .update({ logo_url: logoUrl })
      .eq('id', clientId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  removeLogo: async (clientId: string) => {
    const { data, error } = await supabase
      .from('clients')
      .update({ logo_url: null })
      .eq('id', clientId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  runAudit: async (clientId: string) => {
    const { data: client, error: fetchError } = await supabase
      .from('clients')
      .select('drive_folder_id')
      .eq('id', clientId)
      .single();

    if (fetchError || !client?.drive_folder_id) throw new Error('Cliente sem pasta vinculada.');

    const data = await invokeFunction<{ success?: boolean; message?: string; error?: string }>('auditoria-drive', {
      clientId,
      clienteFolderId: client.drive_folder_id,
    });

    if (data?.success === false) throw new Error(data.error || 'Falha ao executar auditoria.');

    await logActivity('drive_audit', 'client', clientId, clientId);
    return data;
  },
};
