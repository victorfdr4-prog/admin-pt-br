import { supabase } from '@/lib/supabase';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '/api';

async function buildHeaders(init?: RequestInit) {
  const headers = new Headers(init?.headers);

  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return headers;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const payload = await response.json();
      message = String(payload?.details || payload?.message || message);
    } catch {
      const text = await response.text();
      if (text) message = text;
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = await buildHeaders(init);
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });

    return parseResponse<T>(response);
  },

  get<T>(path: string) {
    return apiClient.request<T>(path, { method: 'GET' });
  },
};
