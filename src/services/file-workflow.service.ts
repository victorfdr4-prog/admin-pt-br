import { supabase } from '@/lib/supabase';
import { getCurrentUser, logActivity } from './_shared';
import { TimelineService } from './timeline.service';
import { ApprovalService } from './approval.service';
import { DriveService } from './drive.service';

// -----------------------------------------------
// Tipos
// -----------------------------------------------

export interface FileVersion {
  id: string;
  file_id: string;
  version_number: number;
  uploaded_by: string | null;
  size_bytes: number;
  change_summary: string | null;
  created_at: string;
  uploader_name?: string | null;
}

export interface FileComment {
  id: string;
  file_id: string;
  task_id: string | null;
  user_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  author_name?: string | null;
  author_avatar?: string | null;
  replies?: FileComment[];
}

export interface FileRecord {
  id: string;
  client_id: string;
  file_id: string; // Google Drive file ID
  name: string;
  mime_type: string;
  folder_name: string | null;
  folder_id: string | null;
  version: number;
  size_bytes: number;
  task_id: string | null;
  uploaded_by: string | null;
  approval_status: 'pending' | 'approved' | 'rejected' | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------
// Serviço
// -----------------------------------------------

export const FileWorkflowService = {
  // ---- Upload com vínculo opcional a task ----
  uploadAndLink: async (params: {
    clientId: string;
    folderId: string;
    file: File;
    taskId?: string | null;
    description?: string | null;
    onProgress?: (progress: number) => void;
  }): Promise<FileRecord> => {
    const user = await getCurrentUser();

    // 1. Upload para o Drive
    const uploaded = await DriveService.upload(
      { clientId: params.clientId, folderId: params.folderId, file: params.file },
      params.onProgress
    );

    const driveFileId = String(uploaded?.id || uploaded?.fileId || '');
    if (!driveFileId) throw new Error('Drive não retornou ID do arquivo.');

    // 2. Registrar/atualizar na tabela drive_files
    const { data: existing } = await supabase
      .from('drive_files')
      .select('id, version')
      .eq('file_id', driveFileId)
      .maybeSingle();

    let fileRecord: FileRecord;

    if (existing) {
      // Nova versão
      const newVersion = (existing.version || 1) + 1;
      const { data, error } = await supabase
        .from('drive_files')
        .update({
          version: newVersion,
          task_id: params.taskId ?? null,
          uploaded_by: user.id,
          description: params.description ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) throw error;
      fileRecord = data as FileRecord;

      // Registrar versão
      await supabase.from('file_versions').insert({
        file_id: existing.id,
        version_number: newVersion,
        uploaded_by: user.id,
        size_bytes: params.file.size,
        change_summary: `Versão ${newVersion} enviada`,
      });
    } else {
      // Primeiro upload
      const { data, error } = await supabase
        .from('drive_files')
        .insert({
          client_id: params.clientId,
          file_id: driveFileId,
          name: params.file.name,
          mime_type: params.file.type || 'application/octet-stream',
          folder_id: params.folderId,
          version: 1,
          size_bytes: params.file.size,
          task_id: params.taskId ?? null,
          uploaded_by: user.id,
          description: params.description ?? null,
        })
        .select('*')
        .single();

      if (error) throw error;
      fileRecord = data as FileRecord;

      // Versão inicial
      await supabase.from('file_versions').insert({
        file_id: fileRecord.id,
        version_number: 1,
        uploaded_by: user.id,
        size_bytes: params.file.size,
        change_summary: 'Upload inicial',
      });
    }

    await Promise.all([
      logActivity('file_upload', 'drive_file', fileRecord.id, params.clientId, {
        name: params.file.name,
        task_id: params.taskId,
      }),
      TimelineService.emit({
        event_type: 'file_upload',
        entity_type: 'drive_file',
        entity_id: fileRecord.id,
        client_id: params.clientId,
        title: `Arquivo enviado: ${params.file.name}`,
        metadata: { task_id: params.taskId, mime_type: params.file.type },
      }),
    ]);

    return fileRecord;
  },

  // ---- Link de arquivo já existente a uma task ----
  linkToTask: async (fileRecordId: string, taskId: string): Promise<void> => {
    const { error } = await supabase
      .from('drive_files')
      .update({ task_id: taskId })
      .eq('id', fileRecordId);

    if (error) throw error;
  },

  // ---- Versões ----
  getVersions: async (fileRecordId: string): Promise<FileVersion[]> => {
    const { data, error } = await supabase
      .from('file_versions')
      .select('*, profiles!uploaded_by(full_name)')
      .eq('file_id', fileRecordId)
      .order('version_number', { ascending: false });

    if (error) throw error;
    return (data || []).map((row: any) => ({
      ...row,
      uploader_name: row.profiles?.full_name ?? null,
    }));
  },

  // ---- Comentários ----
  getComments: async (fileRecordId: string): Promise<FileComment[]> => {
    const { data, error } = await supabase
      .from('file_comments')
      .select('*, profiles!user_id(full_name, avatar_url)')
      .eq('file_id', fileRecordId)
      .is('parent_id', null)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const topLevel: FileComment[] = (data || []).map((row: any) => ({
      ...row,
      author_name: row.profiles?.full_name ?? null,
      author_avatar: row.profiles?.avatar_url ?? null,
      replies: [],
    }));

    // Busca replies
    if (topLevel.length) {
      const parentIds = topLevel.map((c) => c.id);
      const { data: replies } = await supabase
        .from('file_comments')
        .select('*, profiles!user_id(full_name, avatar_url)')
        .in('parent_id', parentIds)
        .order('created_at', { ascending: true });

      for (const reply of replies || []) {
        const parent = topLevel.find((c) => c.id === reply.parent_id);
        if (parent) {
          parent.replies!.push({
            ...reply,
            author_name: (reply as any).profiles?.full_name ?? null,
            author_avatar: (reply as any).profiles?.avatar_url ?? null,
            replies: [],
          });
        }
      }
    }

    return topLevel;
  },

  addComment: async (params: {
    fileRecordId: string;
    content: string;
    taskId?: string | null;
    parentId?: string | null;
  }): Promise<FileComment> => {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('file_comments')
      .insert({
        file_id: params.fileRecordId,
        user_id: user.id,
        content: params.content.trim(),
        task_id: params.taskId ?? null,
        parent_id: params.parentId ?? null,
      })
      .select('*, profiles!user_id(full_name, avatar_url)')
      .single();

    if (error) throw error;

    await logActivity('comment_added', 'drive_file', params.fileRecordId, null, {
      content: params.content.slice(0, 100),
    });

    return {
      ...(data as any),
      author_name: (data as any).profiles?.full_name ?? null,
      author_avatar: (data as any).profiles?.avatar_url ?? null,
      replies: [],
    };
  },

  deleteComment: async (commentId: string): Promise<void> => {
    const { error } = await supabase
      .from('file_comments')
      .delete()
      .eq('id', commentId);

    if (error) throw error;
  },

  // ---- Aprovação de arquivo ----
  requestApproval: async (
    fileRecordId: string,
    title: string,
    clientId?: string | null
  ) => {
    const { data: file } = await supabase
      .from('drive_files')
      .select('client_id')
      .eq('id', fileRecordId)
      .single();

    const resolvedClientId = clientId ?? file?.client_id ?? null;

    // Atualizar approval_status no arquivo
    await supabase
      .from('drive_files')
      .update({ approval_status: 'pending' })
      .eq('id', fileRecordId);

    // Criar aprovação unificada
    return ApprovalService.create({
      entity_type: 'file',
      entity_id: fileRecordId,
      client_id: resolvedClientId,
      title,
      metadata: { file_id: fileRecordId },
    });
  },

  // ---- Arquivos por task ----
  getByTask: async (taskId: string): Promise<FileRecord[]> => {
    const { data, error } = await supabase
      .from('drive_files')
      .select('*')
      .eq('task_id', taskId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []) as FileRecord[];
  },

  // ---- Arquivos por cliente ----
  getByClient: async (clientId: string): Promise<FileRecord[]> => {
    const { data, error } = await supabase
      .from('drive_files')
      .select('*')
      .eq('client_id', clientId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []) as FileRecord[];
  },
};
