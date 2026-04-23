const BASE = import.meta.env.VITE_WHATSAPP_API_URL ?? 'http://localhost:3001';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch {
    throw new Error('Backend WhatsApp offline. Inicie o servidor em /whatsapp-backend.');
  }
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
  return json.data as T;
}

export interface WaStatus {
  status: 'DISCONNECTED' | 'QR_READY' | 'CONNECTING' | 'READY' | 'AUTH_FAILURE';
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduledMessage {
  id: string;
  recipient: string;
  content: string;
  scheduled_at: string;
  status: 'pending' | 'sent' | 'failed';
  sent_at: string | null;
  error: string | null;
  created_at: string;
}

export interface MessageLog {
  id: string;
  recipient: string;
  content: string;
  status: string;
  message_type: string;
  error: string | null;
  created_at: string;
}

export const WhatsAppService = {
  getStatus: () => api<WaStatus>('/whatsapp/status'),
  disconnect: () => api<void>('/whatsapp/disconnect', { method: 'POST' }),
  reconnect: () => api<void>('/whatsapp/reconnect', { method: 'POST' }),

  getTemplates: () => api<MessageTemplate[]>('/messages/templates'),
  createTemplate: (data: { name: string; content: string }) =>
    api<MessageTemplate>('/messages/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (id: string, data: { name?: string; content?: string }) =>
    api<MessageTemplate>(`/messages/templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTemplate: (id: string) =>
    api<void>(`/messages/templates/${id}`, { method: 'DELETE' }),

  sendMessage: (recipient: string, content: string) =>
    api<void>('/messages/send', { method: 'POST', body: JSON.stringify({ recipient, content }) }),

  getLogs: () => api<MessageLog[]>('/messages/logs'),

  getScheduled: () => api<ScheduledMessage[]>('/scheduling'),
  scheduleMessage: (data: { recipient: string; content: string; scheduledAt: string }) =>
    api<ScheduledMessage>('/scheduling', { method: 'POST', body: JSON.stringify(data) }),
  cancelScheduled: (id: string) =>
    api<void>(`/scheduling/${id}`, { method: 'DELETE' }),
};
