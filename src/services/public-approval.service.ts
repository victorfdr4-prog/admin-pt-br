import { supabase } from '@/lib/supabase';

type PublicApprovalDecision = 'approved' | 'rejected' | 'revision_requested';

type ApprovalPublicLinkRow = {
  id: string;
  approval_id: string;
  client_id: string | null;
  slug: string;
  entity_type: string;
  entity_id: string | null;
  is_active: boolean;
  expires_at: string | null;
  used_at: string | null;
  used_by_name: string | null;
  used_by_email: string | null;
  created_at: string;
  updated_at: string;
};

type PublicApprovalBundle = {
  link: ApprovalPublicLinkRow;
  approval: any;
};

const slugifyPublic = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

const padSequence = (value: number) => String(value).padStart(2, '0');

const monthDayFromMetadata = (approval: any) => {
  const metadata = approval?.metadata || {};
  const items = Array.isArray(metadata.items) ? metadata.items : [];
  const firstItem = items[0] || null;

  const firstDate =
    firstItem?.post_date && !Number.isNaN(new Date(firstItem.post_date).getTime())
      ? new Date(firstItem.post_date)
      : null;

  const dateLabel = firstDate
    ? firstDate.toISOString().slice(0, 10)
    : metadata?.year && metadata?.month
    ? `${metadata.year}-${String(metadata.month).padStart(2, '0')}-01`
    : new Date().toISOString().slice(0, 10);

  return {
    dateLabel,
    firstItem,
  };
};

const buildBaseSlug = (approval: any) => {
  const metadata = approval?.metadata || {};
  const clientName =
    metadata?.client_name ||
    approval?.client_name ||
    'cliente';

  const { dateLabel, firstItem } = monthDayFromMetadata(approval);

  const postLabel =
    firstItem?.title ||
    firstItem?.post_type ||
    approval?.title ||
    'postagem';

  const platformLabel =
    firstItem?.post_type ||
    'plataforma';

  return [
    slugifyPublic(clientName),
    slugifyPublic(dateLabel),
    slugifyPublic(postLabel),
    slugifyPublic(platformLabel),
  ]
    .filter(Boolean)
    .join('_');
};

async function buildUniqueSlug(baseSlug: string): Promise<string> {
  for (let i = 1; i <= 999; i += 1) {
    const candidate = `${baseSlug}_${padSequence(i)}`;

    const { data, error } = await supabase
      .from('approval_public_links')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();

    if (error) throw error;
    if (!data) return candidate;
  }

  throw new Error('Não foi possível gerar um slug público único para a aprovação.');
}

export const PublicApprovalService = {
  createOrGetLinkForApproval: async (approval: any) => {
    const existing = await supabase
      .from('approval_public_links')
      .select('*')
      .eq('approval_id', approval.id)
      .eq('is_active', true)
      .maybeSingle();

    if (existing.error) throw existing.error;

    if (existing.data) {
      return {
        ...existing.data,
        public_url: `/portal/aprovacao/${existing.data.slug}`,
      };
    }

    const baseSlug = buildBaseSlug(approval);
    const slug = await buildUniqueSlug(baseSlug);

    const { data, error } = await supabase
      .from('approval_public_links')
      .insert({
        approval_id: approval.id,
        client_id: approval.client_id || null,
        slug,
        entity_type: approval.entity_type || 'calendar_item',
        entity_id: approval.entity_id || null,
        is_active: true,
      })
      .select('*')
      .single();

    if (error) throw error;

    return {
      ...data,
      public_url: `/portal/aprovacao/${data.slug}`,
    };
  },

  getApprovalBySlug: async (slug: string): Promise<PublicApprovalBundle> => {
    const { data: link, error: linkError } = await supabase
      .from('approval_public_links')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (linkError) throw linkError;

    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
      throw new Error('Este link de aprovação expirou.');
    }

    const { data: approval, error: approvalError } = await supabase
      .from('approvals')
      .select('*')
      .eq('id', link.approval_id)
      .single();

    if (approvalError) throw approvalError;

    return {
      link: link as ApprovalPublicLinkRow,
      approval,
    };
  },

  submitDecision: async (params: {
    slug: string;
    decision: PublicApprovalDecision;
    notes?: string;
    reviewerName?: string;
    reviewerEmail?: string;
  }) => {
    const { link, approval } = await PublicApprovalService.getApprovalBySlug(params.slug);

    const { error: approvalError } = await supabase
      .from('approvals')
      .update({
        status: params.decision,
        decision_notes: params.notes || null,
        decided_at: new Date().toISOString(),
      })
      .eq('id', approval.id);

    if (approvalError) throw approvalError;

    const { error: linkError } = await supabase
      .from('approval_public_links')
      .update({
        used_at: new Date().toISOString(),
        used_by_name: params.reviewerName || null,
        used_by_email: params.reviewerEmail || null,
      })
      .eq('id', link.id);

    if (linkError) throw linkError;

    if (approval.entity_type === 'calendar_item' && approval.entity_id) {
      const nextCalendarStatus =
        params.decision === 'approved'
          ? 'approved'
          : params.decision === 'revision_requested'
          ? 'draft'
          : 'draft';

      await supabase
        .from('posting_calendars')
        .update({
          status: nextCalendarStatus,
        })
        .eq('id', approval.entity_id);
    }

    return {
      ok: true,
    };
  },
};
