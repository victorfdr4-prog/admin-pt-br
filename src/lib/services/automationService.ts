import { supabase } from '@/lib/supabase';
import { logActivity } from '@/services/_shared';
import { PlanoService } from './planoService';
import { PlanningService, generatePlanning } from './planningService';

const DONE_STATUSES = new Set(['completed', 'done', 'concluido', 'finalizado']);

const normalizeToken = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const isDone = (value: unknown) => DONE_STATUSES.has(normalizeToken(value));

const ROLE_MAP: Record<string, string[]> = {
  design: ['designer', 'design'],
  trafego: ['gestor_trafego', 'trafego', 'tráfego', 'ads'],
  site: ['dev', 'desenvolvedor', 'developer'],
  social: ['social', 'social media'],
  conteudo: ['conteudo', 'conteúdo', 'copy'],
};

const findAssigneeIdByType = async (type: string): Promise<string | null> => {
  const tokens = ROLE_MAP[normalizeToken(type)] || [];
  if (!tokens.length) return null;

  const { data, error } = await supabase.from('profiles').select('id, role').limit(200);
  if (error) throw error;

  const match = (data || []).find((profile: any) => {
    const role = normalizeToken(profile.role);
    return tokens.some((token) => role.includes(normalizeToken(token)));
  });

  return match?.id ? String(match.id) : null;
};

const buildTaskFingerprint = (title: string, type: string) =>
  `${normalizeToken(title)}::${normalizeToken(type)}`;

export const AutomationService = {
  runClientOnboardingAutomation: async (clientId: string) => {
    const { data: onboardingRows, error: onboardingError } = await supabase
      .from('onboarding_tasks')
      .select('id, client_id, title, description, status, automacao_executada')
      .eq('client_id', clientId)
      .order('order_index', { ascending: true });

    if (onboardingError) throw onboardingError;
    if (!onboardingRows?.length) return { executed: false, reason: 'onboarding-empty' };

    const alreadyExecuted = onboardingRows.every((row: any) => row.automacao_executada === true);
    if (alreadyExecuted) return { executed: false, reason: 'already-executed' };

    const allCompleted = onboardingRows.every((row: any) => isDone(row.status));
    if (!allCompleted) return { executed: false, reason: 'onboarding-not-completed' };

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, plan, onboarding_status')
      .eq('id', clientId)
      .single();

    if (clientError) throw clientError;

    const plano = await PlanoService.getByClientPlan(client.plan ? String(client.plan) : null);
    if (!plano) return { executed: false, reason: 'plan-not-found' };

    const planning = generatePlanning(onboardingRows, plano.template_planejamento);
    await PlanningService.savePlanning({
      clienteId: clientId,
      planoId: plano.id,
      conteudo: planning,
    });

    const { data: existingTasks, error: existingTasksError } = await supabase
      .from('tasks')
      .select('id, title, custom_fields, order_index')
      .eq('client_id', clientId);

    if (existingTasksError) throw existingTasksError;

    const knownFingerprints = new Set<string>(
      (existingTasks || []).map((task: any) => {
        const existingType = String((task.custom_fields as any)?.auto_tipo || '');
        return buildTaskFingerprint(String(task.title || ''), existingType);
      })
    );

    const maxOrder = Math.max(
      0,
      ...(existingTasks || []).map((task: any) => Number(task.order_index || 0)).filter((value) => Number.isFinite(value))
    );

    let nextOrder = maxOrder + 1;
    const createdTaskIds: string[] = [];

    for (const item of plano.template_tarefas) {
      const fingerprint = buildTaskFingerprint(item.titulo, item.tipo);
      if (knownFingerprints.has(fingerprint)) {
        continue;
      }

      const assigneeId = await findAssigneeIdByType(item.tipo);
      const customFields = {
        auto_seed: true,
        auto_tipo: item.tipo,
        plano_id: plano.id,
      };

      const { data: created, error: createError } = await supabase
        .from('tasks')
        .insert({
          client_id: clientId,
          title: item.titulo,
          description: item.descricao || null,
          status: 'pending',
          priority: 'medium',
          order_index: nextOrder,
          assignee_id: assigneeId,
          custom_fields: customFields,
        })
        .select('id')
        .single();

      if (createError) throw createError;
      createdTaskIds.push(String(created.id));
      knownFingerprints.add(fingerprint);
      nextOrder += 1;
    }

    await supabase
      .from('onboarding_tasks')
      .update({ automacao_executada: true })
      .eq('client_id', clientId);

    await supabase
      .from('clients')
      .update({ onboarding_status: 'completed' })
      .eq('id', clientId);

    await logActivity('onboarding_automation_generated', 'onboarding', clientId, clientId, {
      client_name: client.name,
      plan: client.plan,
      plan_id: plano.id,
      generated_tasks: createdTaskIds.length,
    });

    return {
      executed: true,
      generatedTasks: createdTaskIds.length,
      planId: plano.id,
      planning,
    };
  },
};

