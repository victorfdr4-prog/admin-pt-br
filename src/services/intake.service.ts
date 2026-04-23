/**
 * =========================================================
 * INTAKE SERVICE (FULL SaaS VERSION)
 * =========================================================
 *
 * Este service controla:
 * ✔ intake_requests (CRUD)
 * ✔ templates (dinâmicos)
 * ✔ criação de tarefas (kanban)
 *
 * 🔥 Fluxo:
 * intake → triagem → task → kanban
 */

import { supabase } from '@/lib/supabase';

export const intakeService = {
  // =========================
  // GET ALL REQUESTS
  // =========================
  getAll: async () => {
    const { data, error } = await supabase
      .from('intake_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return data ?? [];
  },

  // =========================
  // GET ONE
  // =========================
  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('intake_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // =========================
  // CREATE REQUEST
  // =========================
  create: async (payload: any) => {
    const { data, error } = await supabase
      .from('intake_requests')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // =========================
  // UPDATE REQUEST
  // =========================
  update: async (id: string, payload: any) => {
    const { data, error } = await supabase
      .from('intake_requests')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // =========================
  // DELETE
  // =========================
  remove: async (id: string) => {
    const { error } = await supabase
      .from('intake_requests')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  // =========================
  // COUNT (RPC)
  // =========================
  getPendingCount: async (): Promise<number> => {
    const { data, error } = await supabase.rpc('get_pending_intake_count');

    if (error) return 0;
    return data ?? 0;
  },

  // =========================
  // 🔥 TEMPLATES (REAL DB)
  // =========================
  getTemplates: async () => {
    const { data, error } = await supabase
      .from('intake_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  // =========================
  // 🔥 CREATE TASK FROM INTAKE
  // =========================
  createTaskFromIntake: async (intakeId: string) => {
    // 1. busca intake
    const intake = await intakeService.getById(intakeId);

    if (!intake) throw new Error('Intake não encontrado');

    // 2. cria task no kanban
    const { data: task, error } = await supabase
      .from('tasks')
      .insert([
        {
          title: intake.title,
          description: intake.description,
          client_id: intake.client_id,
          status: 'todo',
          source: 'intake',
          source_id: intake.id,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // 3. atualiza intake → vinculado
    await supabase
      .from('intake_requests')
      .update({
        status: 'in_progress',
        task_id: task.id,
      })
      .eq('id', intakeId);

    return task;
  },
};