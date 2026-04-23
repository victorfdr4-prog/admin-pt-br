import { supabase } from '@/lib/supabase';
import type { PlanoPlanningTemplate } from './planoService';

export type PlanningRecord = {
  id: string;
  cliente_id: string;
  plano_id: string | null;
  conteudo: Record<string, unknown>;
  created_at?: string | null;
  updated_at?: string | null;
};

type OnboardingAnswer = {
  title?: string | null;
  description?: string | null;
  status?: string | null;
};

const hasAnyToken = (source: string, tokens: string[]) => {
  const normalized = source
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return tokens.some((token) => normalized.includes(token));
};

const pickCanais = (answersText: string) => {
  const canais: string[] = [];
  if (hasAnyToken(answersText, ['instagram'])) canais.push('instagram');
  if (hasAnyToken(answersText, ['facebook'])) canais.push('facebook');
  if (hasAnyToken(answersText, ['youtube'])) canais.push('youtube');
  if (hasAnyToken(answersText, ['linkedin'])) canais.push('linkedin');
  if (hasAnyToken(answersText, ['tiktok', 'tik tok'])) canais.push('tiktok');
  return Array.from(new Set(canais));
};

export const generatePlanning = (
  onboardingAnswers: OnboardingAnswer[],
  template: PlanoPlanningTemplate = {}
): Record<string, unknown> => {
  const texts = onboardingAnswers
    .map((answer) => `${answer.title || ''} ${answer.description || ''}`)
    .join(' ')
    .trim();

  const canais = Array.from(new Set([...(template.canais || []), ...pickCanais(texts)]));
  const objetivoVendas = hasAnyToken(texts, ['vendas', 'conversao', 'conversão', 'leads']);
  const frequencia =
    template.frequencia ||
    (hasAnyToken(texts, ['diario', 'diário', 'todo dia']) ? 'diária' : 'semanal');
  const estrategia_trafego =
    template.estrategia_trafego || (objetivoVendas ? 'campanhas de conversão' : 'campanhas de reconhecimento');

  const proximos_passos = template.proximos_passos?.length
    ? template.proximos_passos
    : [
        'Validar posicionamento com cliente',
        'Definir calendário inicial de produção',
        'Iniciar execução das tarefas do plano',
      ];

  return {
    posicionamento: template.posicionamento || 'Posicionamento inicial definido a partir do onboarding.',
    tipo_conteudo: template.tipo_conteudo || [],
    canais,
    frequencia,
    estrategia_trafego,
    proximos_passos,
    gerado_em: new Date().toISOString(),
  };
};

export const PlanningService = {
  savePlanning: async (payload: {
    clienteId: string;
    planoId?: string | null;
    conteudo: Record<string, unknown>;
  }): Promise<PlanningRecord> => {
    const { data: existing, error: existingError } = await supabase
      .from('planejamentos')
      .select('*')
      .eq('cliente_id', payload.clienteId)
      .limit(1);

    if (existingError) throw existingError;

    if (existing?.[0]) {
      const { data, error } = await supabase
        .from('planejamentos')
        .update({
          plano_id: payload.planoId || null,
          conteudo: payload.conteudo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing[0].id)
        .select('*')
        .single();

      if (error) throw error;
      return data as PlanningRecord;
    }

    const { data, error } = await supabase
      .from('planejamentos')
      .insert({
        cliente_id: payload.clienteId,
        plano_id: payload.planoId || null,
        conteudo: payload.conteudo,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data as PlanningRecord;
  },
};

