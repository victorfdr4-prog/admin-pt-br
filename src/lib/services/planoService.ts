import { supabase } from '@/lib/supabase';

export type PlanoTaskTemplate = {
  titulo: string;
  tipo: string;
  descricao?: string | null;
};

export type PlanoPlanningTemplate = {
  posicionamento?: string;
  tipo_conteudo?: string[];
  canais?: string[];
  frequencia?: string;
  estrategia_trafego?: string;
  proximos_passos?: string[];
};

export type PlanoRecord = {
  id: string;
  nome: string;
  descricao: string | null;
  template_tarefas: PlanoTaskTemplate[];
  template_planejamento: PlanoPlanningTemplate;
};

const normalizeToken = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizeTasksTemplate = (value: unknown): PlanoTaskTemplate[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const titulo = String(record.titulo || '').trim();
      const tipo = String(record.tipo || '').trim();
      if (!titulo || !tipo) return null;
      return {
        titulo,
        tipo,
        descricao: record.descricao ? String(record.descricao) : null,
      };
    })
    .filter((item): item is PlanoTaskTemplate => Boolean(item));
};

const normalizePlanningTemplate = (value: unknown): PlanoPlanningTemplate => {
  if (!value || typeof value !== 'object') return {};
  const record = value as Record<string, unknown>;
  return {
    posicionamento: record.posicionamento ? String(record.posicionamento) : '',
    tipo_conteudo: Array.isArray(record.tipo_conteudo)
      ? record.tipo_conteudo.map((item) => String(item)).filter(Boolean)
      : [],
    canais: Array.isArray(record.canais) ? record.canais.map((item) => String(item)).filter(Boolean) : [],
    frequencia: record.frequencia ? String(record.frequencia) : '',
    estrategia_trafego: record.estrategia_trafego ? String(record.estrategia_trafego) : '',
    proximos_passos: Array.isArray(record.proximos_passos)
      ? record.proximos_passos.map((item) => String(item)).filter(Boolean)
      : [],
  };
};

const mapPlano = (row: any): PlanoRecord => ({
  id: String(row.id),
  nome: String(row.nome || ''),
  descricao: row.descricao ? String(row.descricao) : null,
  template_tarefas: normalizeTasksTemplate(row.template_tarefas),
  template_planejamento: normalizePlanningTemplate(row.template_planejamento),
});

export const PlanoService = {
  getByClientPlan: async (planName: string | null | undefined): Promise<PlanoRecord | null> => {
    const normalizedPlan = normalizeToken(planName);
    if (!normalizedPlan) return null;

    const { data: exactRows, error: exactError } = await supabase
      .from('planos')
      .select('*')
      .ilike('nome', normalizedPlan)
      .limit(1);

    if (exactError) throw exactError;
    if (exactRows?.[0]) return mapPlano(exactRows[0]);

    const { data: allRows, error: allError } = await supabase.from('planos').select('*');
    if (allError) throw allError;

    const match = (allRows || []).find((row) => normalizeToken(row.nome) === normalizedPlan);
    return match ? mapPlano(match) : null;
  },
};

