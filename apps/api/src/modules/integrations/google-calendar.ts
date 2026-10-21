import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env, googleCalendarConfigured, googleCalendarRedirectUri } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { db } from '../../config/supabase.js';
import { HttpError } from '../../utils/http.js';

const SCOPE = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

export type CalendarReturnTo = 'agenda' | 'integracoes';

type Connection = {
  user_id: string;
  google_email: string;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
};

export type CalendarActivity = {
  id: string;
  owner_id: string;
  type: string;
  title: string;
  description: string | null;
  due_at: string | null;
  status: string;
  google_event_id?: string | null;
  lead?: { company_name: string } | null;
};

function tokenKey() {
  return createHash('sha256').update(env.WEBHOOK_SECRET).digest();
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', tokenKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`;
}

export function decryptSecret(packed: string) {
  const [iv, tag, enc] = packed.split('.');
  if (!iv || !tag || !enc) throw new Error('token inválido');
  const decipher = createDecipheriv('aes-256-gcm', tokenKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(enc, 'base64url')), decipher.final()]).toString('utf8');
}

export function signOAuthState(userId: string, returnTo: CalendarReturnTo) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + 10 * 60_000, next: returnTo })).toString('base64url');
  const sig = createHmac('sha256', env.WEBHOOK_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyOAuthState(state: string): { uid: string; next: CalendarReturnTo } {
  const [payload, sig] = state.split('.');
  if (!payload || !sig) throw new HttpError(400, 'invalid_state', 'Estado OAuth inválido');
  const expected = createHmac('sha256', env.WEBHOOK_SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(400, 'invalid_state', 'Estado OAuth inválido');
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { uid?: string; exp?: number; next?: string };
  if (!data.uid || !data.exp || data.exp < Date.now()) throw new HttpError(400, 'invalid_state', 'Estado OAuth expirado');
  return { uid: data.uid, next: data.next === 'integracoes' ? 'integracoes' : 'agenda' };
}

export function googleAuthUrl(userId: string, returnTo: CalendarReturnTo) {
  if (!googleCalendarConfigured()) {
    throw new HttpError(503, 'google_not_configured', 'Google Calendar ainda não foi configurado no servidor');
  }
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CALENDAR_CLIENT_ID!,
    redirect_uri: googleCalendarRedirectUri(),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'false',
    state: signOAuthState(userId, returnTo),
  });
  return `${AUTH_URL}?${params}`;
}

const SKIP_EVENT_TYPES = new Set(['workingLocation', 'birthday', 'focusTime']);

export type GoogleEventInput = {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  eventType?: string;
  start?: { dateTime?: string; date?: string };
};

/** Evento do Google que vira reunião na agenda. `null` quando não é uma reunião. */
export function activityFromGoogleEvent(ev: GoogleEventInput) {
  if (!ev.id || (ev.eventType && SKIP_EVENT_TYPES.has(ev.eventType))) return null;
  const raw = ev.start?.dateTime ?? (ev.start?.date ? `${ev.start.date}T12:00:00.000Z` : null);
  if (!raw) return null;
  const due = new Date(raw);
  if (Number.isNaN(due.getTime())) return null;
  return {
    google_event_id: ev.id,
    title: (ev.summary?.trim() || 'Reunião').slice(0, 200),
    description: ev.description?.trim() ? ev.description.trim().slice(0, 4000) : null,
    due_at: due.toISOString(),
    canceled: ev.status === 'cancelled',
  };
}

export function calendarEventFromActivity(a: Pick<CalendarActivity, 'title' | 'description' | 'due_at' | 'lead'>) {
  const start = new Date(a.due_at!);
  const end = new Date(start.getTime() + 30 * 60_000);
  const leadLine = a.lead?.company_name ? `Lead: ${a.lead.company_name}` : null;
  return {
    summary: a.title,
    description: [a.description, leadLine, 'Registrado no Kidoo Revenue CRM'].filter(Boolean).join('\n\n'),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  };
}

async function googleJson(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const desc = typeof body?.error_description === 'string' ? body.error_description : typeof body?.error === 'string' ? body.error : `HTTP ${res.status}`;
    const err = new Error(desc) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return body ?? {};
}

export async function exchangeCode(code: string) {
  const body = await googleJson(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CALENDAR_CLIENT_ID!,
      client_secret: env.GOOGLE_CALENDAR_CLIENT_SECRET!,
      redirect_uri: googleCalendarRedirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  const refresh = typeof body.refresh_token === 'string' ? body.refresh_token : null;
  const access = typeof body.access_token === 'string' ? body.access_token : null;
  const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : 3600;
  if (!refresh || !access) throw new HttpError(422, 'google_token_failed', 'O Google não devolveu o token de atualização. Tente conectar de novo.');
  const info = await googleJson(USERINFO_URL, { headers: { Authorization: `Bearer ${access}` } });
  const email = typeof info.email === 'string' ? info.email : '';
  if (!email) throw new HttpError(422, 'google_token_failed', 'Não foi possível ler o e-mail da conta Google.');
  return { refresh, access, expiresIn, email };
}

async function getConnection(userId: string): Promise<Connection | null> {
  const { data, error } = await db.from('google_calendar_connections').select('*').eq('user_id', userId).maybeSingle<Connection>();
  if (error) throw error;
  return data;
}

async function accessTokenFor(conn: Connection): Promise<string> {
  const stillValid =
    conn.access_token && conn.access_token_expires_at && new Date(conn.access_token_expires_at).getTime() > Date.now() + 60_000;
  if (stillValid) return conn.access_token!;

  const body = await googleJson(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: decryptSecret(conn.refresh_token),
      client_id: env.GOOGLE_CALENDAR_CLIENT_ID!,
      client_secret: env.GOOGLE_CALENDAR_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  });
  const access = typeof body.access_token === 'string' ? body.access_token : null;
  const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : 3600;
  if (!access) throw new Error('refresh sem access_token');
  const expiry = new Date(Date.now() + expiresIn * 1000).toISOString();
  await db
    .from('google_calendar_connections')
    .update({ access_token: access, access_token_expires_at: expiry })
    .eq('user_id', conn.user_id);
  conn.access_token = access;
  conn.access_token_expires_at = expiry;
  return access;
}

export async function saveConnection(userId: string, tokens: { refresh: string; access: string; expiresIn: number; email: string }) {
  const row = {
    user_id: userId,
    google_email: tokens.email,
    refresh_token: encryptSecret(tokens.refresh),
    access_token: tokens.access,
    access_token_expires_at: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
  };
  const { error } = await db.from('google_calendar_connections').upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function connectionStatus(userId: string) {
  if (!googleCalendarConfigured()) return { configured: false, connected: false, email: null as string | null };
  const conn = await getConnection(userId);
  return { configured: true, connected: !!conn, email: conn?.google_email ?? null };
}

export async function disconnectCalendar(userId: string) {
  const { error } = await db.from('google_calendar_connections').delete().eq('user_id', userId);
  if (error) throw error;
}

function shouldSync(a: CalendarActivity) {
  return a.type !== 'note' && !!a.due_at && a.status !== 'done';
}

async function upsertGoogleEvent(token: string, activity: CalendarActivity) {
  const payload = calendarEventFromActivity(activity);
  if (activity.google_event_id) {
    const res = await fetch(`${EVENTS_URL}/${encodeURIComponent(activity.google_event_id)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.status !== 404) {
      if (!res.ok) throw new Error(`patch event ${res.status}`);
      const body = (await res.json()) as { id?: string };
      return body.id ?? activity.google_event_id;
    }
  }
  const created = await googleJson(EVENTS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (typeof created.id !== 'string') throw new Error('evento sem id');
  return created.id;
}

async function deleteGoogleEvent(token: string, eventId: string) {
  const res = await fetch(`${EVENTS_URL}/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`delete event ${res.status}`);
}

async function listGoogleEvents(token: string, timeMin: string, timeMax: string) {
  const events: GoogleEventInput[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 4; page++) {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      showDeleted: 'true',
      maxResults: '250',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const body = await googleJson(`${EVENTS_URL}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    if (Array.isArray(body.items)) events.push(...(body.items as GoogleEventInput[]));
    pageToken = typeof body.nextPageToken === 'string' ? body.nextPageToken : undefined;
    if (!pageToken) break;
  }
  return events;
}

/** Traz reuniões do Google para `activities`, casando pelo id do evento. Falha de um usuário não interrompe os outros. */
export async function importGoogleMeetings(ownerIds: string[], timeMin: string, timeMax: string) {
  if (!googleCalendarConfigured() || ownerIds.length === 0) return;
  for (const ownerId of ownerIds) {
    try {
      await importOwnerMeetings(ownerId, timeMin, timeMax);
    } catch (err) {
      logger.warn({ err, owner_id: ownerId }, 'Falha ao importar reuniões do Google Calendar');
    }
  }
}

async function importOwnerMeetings(ownerId: string, timeMin: string, timeMax: string) {
  const conn = await getConnection(ownerId);
  if (!conn) return;
  const token = await accessTokenFor(conn);
  const mapped = new Map<string, NonNullable<ReturnType<typeof activityFromGoogleEvent>>>();
  for (const ev of await listGoogleEvents(token, timeMin, timeMax)) {
    const row = activityFromGoogleEvent(ev);
    if (row) mapped.set(row.google_event_id, row);
  }
  if (mapped.size === 0) return;

  const { data, error } = await db
    .from('activities')
    .select('id, google_event_id, status, title, due_at')
    .eq('owner_id', ownerId)
    .in('google_event_id', [...mapped.keys()]);
  if (error) throw error;
  const existing = new Map((data ?? []).map((row) => [row.google_event_id as string, row]));

  const toInsert: Record<string, unknown>[] = [];
  for (const meeting of mapped.values()) {
    const row = existing.get(meeting.google_event_id);
    if (!row) {
      if (!meeting.canceled) {
        toInsert.push({
          owner_id: ownerId,
          created_by: ownerId,
          type: 'meeting',
          title: meeting.title,
          description: meeting.description,
          due_at: meeting.due_at,
          google_event_id: meeting.google_event_id,
          status: 'pending',
        });
      }
      continue;
    }
    if (row.status !== 'pending') continue;
    if (meeting.canceled) {
      await db.from('activities').update({ status: 'canceled' }).eq('id', row.id);
      continue;
    }
    const sameTime = row.due_at && new Date(row.due_at).getTime() === new Date(meeting.due_at).getTime();
    if (row.title === meeting.title && sameTime) continue;
    await db.from('activities').update({ title: meeting.title, due_at: meeting.due_at }).eq('id', row.id);
  }
  if (toInsert.length) {
    const { error: insertError } = await db.from('activities').insert(toInsert);
    if (insertError) throw insertError;
  }
}

/** shortcut: só o calendário do owner atual; troca de responsável deixa o evento antigo no Google. */
export async function pushActivityToCalendar(activity: CalendarActivity) {
  if (!googleCalendarConfigured() || !shouldSync(activity)) return;
  const conn = await getConnection(activity.owner_id);
  if (!conn) return;
  try {
    const token = await accessTokenFor(conn);
    if (activity.status === 'canceled') {
      if (activity.google_event_id) {
        await deleteGoogleEvent(token, activity.google_event_id);
        await db.from('activities').update({ google_event_id: null }).eq('id', activity.id);
      }
      return;
    }
    const eventId = await upsertGoogleEvent(token, activity);
    if (eventId !== activity.google_event_id) {
      await db.from('activities').update({ google_event_id: eventId }).eq('id', activity.id);
    }
  } catch (err) {
    logger.warn({ err, activity_id: activity.id }, 'Falha ao sincronizar Google Calendar');
  }
}

export function calendarAppPath(next: CalendarReturnTo, google: 'connected' | 'error' | 'denied') {
  const path = next === 'integracoes' ? '/integracoes' : '/agenda';
  return `${env.APP_URL.replace(/\/$/, '')}${path}?google=${google}`;
}
