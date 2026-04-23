import { supabase } from '@/lib/supabase';
import { invokeFunction, buildDriveFileUrl, SUPABASE_URL, SUPABASE_ANON_KEY } from './_shared';

export const FileService = {
  setupClient: async (clientId: string) => {
    const { data: client, error } = await supabase
      .from('clients')
      .select('id, name, industry, segment, drive_folder_id, drive_subfolders, generate_drive_folder')
      .eq('id', clientId)
      .single();

    if (error) throw error;
    if (client.drive_folder_id || client.generate_drive_folder === false) return client;

    const driveData = await invokeFunction<{ folderId?: string; subfolders?: Record<string, string> }>('create-drive-folder', {
      clientName: client.name,
      ramo: client.industry || client.segment || 'GERAL',
    });

    if (!driveData?.folderId) return client;

    const { data: updatedClient, error: updateError } = await supabase
      .from('clients')
      .update({
        drive_folder_id: driveData.folderId,
        drive_subfolders: driveData.subfolders || {},
      })
      .eq('id', clientId)
      .select('*')
      .single();

    if (updateError) throw updateError;
    return updatedClient;
  },

  listByClient: async (clientId: string) => {
    const { data, error } = await supabase
      .from('drive_files')
      .select('*')
      .eq('client_id', clientId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      ...item,
      modifiedTime: item.updated_at,
      webViewLink: buildDriveFileUrl(String(item.file_id)),
    }));
  },
};

export const DriveService = {
  list: async (params: { clientId: string; folderId?: string; sort?: string; order?: string }) => {
    return invokeFunction<{
      rootFolderId: string;
      currentFolderId: string;
      currentFolderLink?: string;
      clientName?: string;
      items: any[];
    }>('drive-interactor', {
      action: 'list',
      clientId: params.clientId,
      folderId: params.folderId,
      sort: params.sort,
      order: params.order,
    });
  },

  upload: async (
    params: { clientId: string; folderId: string; file: File },
    onProgress?: (progress: number) => void
  ) => {
    const formData = new FormData();
    formData.append('clientId', params.clientId);
    formData.append('folderId', params.folderId);
    formData.append('file', params.file);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      throw new Error('NOT_AUTHENTICATED: sessão inválida. Faça login novamente.');
    }

    return new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${SUPABASE_URL}/functions/v1/drive-upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);

      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
      }

      xhr.onload = () => {
        const body = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body);
        } else {
          reject(new Error(body?.error || `Upload falhou (${xhr.status}).`));
        }
      };

      xhr.onerror = () => reject(new Error('Erro de rede durante o upload.'));
      xhr.send(formData);
    });
  },

  delete: async (params: { clientId: string; fileId: string }) => {
    return invokeFunction('drive-delete', params);
  },

  createFolder: async (params: { clientId: string; parentId: string; name: string }) => {
    return invokeFunction('drive-interactor', {
      action: 'create_folder',
      clientId: params.clientId,
      folderId: params.parentId,
      name: params.name,
    });
  },

  getByClient: async (clientId: string) => FileService.listByClient(clientId),
};
