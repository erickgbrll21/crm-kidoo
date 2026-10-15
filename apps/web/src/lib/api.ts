import type { ApiErrorBody } from '@kidoo/shared';
import { supabase } from './supabase';

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/v1`;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

const qs = (q?: Query) => {
  if (!q) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${qs(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network_error', 'Sem conexão com o servidor. Verifique sua internet e tente novamente.');
  }

  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => null)) as T | ApiErrorBody | null;
  if (!res.ok) {
    const err = (json as ApiErrorBody | null)?.error;
    if (res.status === 401) window.dispatchEvent(new CustomEvent('kidoo:unauthorized', { detail: err?.code }));
    throw new ApiError(res.status, err?.code ?? 'http_error', err?.message ?? 'Algo deu errado. Tente novamente.', err?.details);
  }
  return json as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  upload: <T>(path: string, form: FormData) => request<T>('POST', path, form),
};
