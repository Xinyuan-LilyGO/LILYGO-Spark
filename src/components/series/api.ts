import { FirmwareSeries } from './types';

async function getApiBase(): Promise<string> {
  if (window.ipcRenderer) {
    return window.ipcRenderer.invoke('get-api-base-url');
  }
  throw new Error('Not in Electron environment');
}

function authHeader(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const resp = await fetch(url, init);
    const ct = resp.headers.get('content-type') || '';
    if (!resp.ok || !ct.includes('application/json')) return null;
    return (await resp.json()) as T;
  } catch {
    return null;
  }
}

export const SeriesApi = {
  async list(): Promise<FirmwareSeries[]> {
    const api = await getApiBase();
    const data = await fetchJson<{ success?: boolean; series?: FirmwareSeries[] }>(`${api}/series`);
    return data?.series || [];
  },

  async create(token: string, body: Partial<FirmwareSeries>): Promise<{ ok: boolean; error?: string; series?: FirmwareSeries }> {
    const api = await getApiBase();
    const resp = await fetch(`${api}/series`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify(body),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.success) return { ok: false, error: data?.error || 'create_failed' };
    return { ok: true, series: data.series };
  },

  async update(token: string, id: string, patch: Partial<FirmwareSeries>): Promise<{ ok: boolean; error?: string; series?: FirmwareSeries }> {
    const api = await getApiBase();
    const resp = await fetch(`${api}/series/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify(patch),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.success) return { ok: false, error: data?.error || 'update_failed' };
    return { ok: true, series: data.series };
  },

  async remove(token: string, id: string): Promise<{ ok: boolean; error?: string }> {
    const api = await getApiBase();
    const resp = await fetch(`${api}/series/${id}`, {
      method: 'DELETE',
      headers: authHeader(token),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.success) return { ok: false, error: data?.error || 'delete_failed' };
    return { ok: true };
  },

  async addFirmware(token: string, seriesId: string, firmwareId16: string): Promise<{ ok: boolean; error?: string }> {
    const api = await getApiBase();
    const resp = await fetch(`${api}/series/${seriesId}/firmware`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader(token) },
      body: JSON.stringify({ firmware_id: firmwareId16 }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.success) return { ok: false, error: data?.error || 'add_failed' };
    return { ok: true };
  },

  async removeFirmware(token: string, seriesId: string, firmwareId16: string): Promise<{ ok: boolean; error?: string }> {
    const api = await getApiBase();
    const resp = await fetch(`${api}/series/${seriesId}/firmware/${firmwareId16}`, {
      method: 'DELETE',
      headers: authHeader(token),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.success) return { ok: false, error: data?.error || 'remove_failed' };
    return { ok: true };
  },
};
