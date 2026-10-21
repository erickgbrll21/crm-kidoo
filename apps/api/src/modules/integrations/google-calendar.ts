import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env, googleCalendarConfigured, googleCalendarRedirectUri } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { db } from '../../config/supabase.js';
import { HttpError } from '../../utils/http.js';
import { stageId } from '../leads/leads.repository.js';

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
  meeting_url?: string | null;
  lead?: {
    company_name: string;
    estimated_setup?: number | string | null;
    estimated_mrr?: number | string | null;
    stage?: { name?: string | null } | { name?: string | null }[] | null;
    lead_contacts?: { name?: string | null; email?: string | null; is_primary?: boolean }[] | null;
  } | null;
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
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
  attendees?: { email?: string; self?: boolean }[];
  start?: { dateTime?: string; date?: string };
};

/** Liga ou reunião só avança o lead enquanto ele ainda está no começo do funil. */
export function stageAfterScheduledMeeting(stageKey: string | null | undefined) {
  return stageKey === 'enriched' || stageKey === 'approach' ? 'call_scheduled' : null;
}

export function meetingUrlFromEvent(ev: Pick<GoogleEventInput, 'hangoutLink' | 'conferenceData'>) {
  const direct = ev.hangoutLink?.trim();
  if (direct) return direct.slice(0, 500);
  const uri = ev.conferenceData?.entryPoints?.find((p) => p.entryPointType === 'video' && p.uri)?.uri?.trim();
  return uri ? uri.slice(0, 500) : null;
}

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
    meeting_url: meetingUrlFromEvent(ev),
    emails: (ev.attendees ?? []).flatMap((a) => (a.self || !a.email ? [] : [a.email.trim().toLowerCase()])),
    canceled: ev.status === 'cancelled',
  };
}

function embeddedName(stage: { name?: string | null } | { name?: string | null }[] | null | undefined) {
  if (!stage) return null;
  const row = Array.isArray(stage) ? stage[0] : stage;
  return row?.name?.trim() || null;
}

function moneyLine(label: string, value: number | string | null | undefined) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `${label}: ${n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}`;
}

export function calendarEventFromActivity(a: Pick<CalendarActivity, 'title' | 'description' | 'due_at' | 'lead'>) {
  const start = new Date(a.due_at!);
  const end = new Date(start.getTime() + 30 * 60_000);
  const contacts = a.lead?.lead_contacts ?? [];
  const contact = contacts.find((c) => c.is_primary) ?? contacts[0];
  const contactLine = contact?.name
    ? `Contato: ${contact.name}${contact.email ? ` (${contact.email})` : ''}`
    : null;
  const stage = embeddedName(a.lead?.stage);
  return {
    summary: a.title,
    description: [
      a.description,
      a.lead?.company_name ? `Lead: ${a.lead.company_name}` : null,
      stage ? `Etapa: ${stage}` : null,
      contactLine,
      moneyLine('Setup est.', a.lead?.estimated_setup),
      moneyLine('MRR est.', a.lead?.estimated_mrr),
      'Registrado no Kidoo Revenue CRM',
    ]
      .filter(Boolean)
      .join('\n\n'),
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

function meetRequest() {
  return {
    conferenceData: {
      createRequest: {
        requestId: randomBytes(8).toString('hex'),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };
}

async function upsertGoogleEvent(token: string, activity: CalendarActivity) {
  const payload = calendarEventFromActivity(activity);
  const wantsMeet = activity.type === 'call' || activity.type === 'meeting';
  const askMeet = wantsMeet && !activity.meeting_url;
  const body = askMeet ? { ...payload, ...meetRequest() } : payload;
  const version = wantsMeet ? '?conferenceDataVersion=1' : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  if (activity.google_event_id) {
    const url = `${EVENTS_URL}/${encodeURIComponent(activity.google_event_id)}${version}`;
    let res = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify(body) });
    if (res.status === 400 && askMeet) res = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify(payload) });
    if (res.status !== 404) {
      if (!res.ok) throw new Error(`patch event ${res.status}`);
      const patched = (await res.json()) as GoogleEventInput;
      return { id: patched.id ?? activity.google_event_id, meetingUrl: meetingUrlFromEvent(patched) };
    }
  }
  try {
    const created = await googleJson(`${EVENTS_URL}${version}`, { method: 'POST', headers, body: JSON.stringify(body) });
    if (typeof created.id !== 'string') throw new Error('evento sem id');
    return { id: created.id, meetingUrl: meetingUrlFromEvent(created as GoogleEventInput) };
  } catch (err) {
    if (!askMeet) throw err;
    const created = await googleJson(EVENTS_URL, { method: 'POST', headers, body: JSON.stringify(payload) });
    if (typeof created.id !== 'string') throw new Error('evento sem id');
    return { id: created.id, meetingUrl: null };
  }
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
      conferenceDataVersion: '1',
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

async function leadsByAttendee(emails: string[]) {
  const filter = emails
    .map((email) => email.replace(/[%,()]/g, ''))
    .filter((email) => email.includes('@'))
    .map((email) => `contact_email.ilike.${email}`)
    .join(',');
  const byEmail = new Map<string, string>();
  if (!filter) return byEmail;
  const { data, error } = await db.from('leads_view').select('id, contact_email').or(filter).eq('status', 'open');
  if (error) throw error;
  for (const lead of data ?? []) {
    const email = typeof lead.contact_email === 'string' ? lead.contact_email.trim().toLowerCase() : '';
    if (email && !byEmail.has(email)) byEmail.set(email, lead.id as string);
  }
  return byEmail;
}

function leadFor(emails: string[], byEmail: Map<string, string>) {
  for (const email of emails) {
    const id = byEmail.get(email);
    if (id) return id;
  }
  return null;
}

/** Call ou reunião com lead aberto em Leads Enriquecidos ou Abordagem vai para Call 15 Min Agendada. */
export async function placeMeetingOnPipeline(actorId: string, leadId: string) {
  const { data, error } = await db.from('leads').select('status, stage_id').eq('id', leadId).maybeSingle();
  if (error) throw error;
  if (!data || data.status !== 'open' || !data.stage_id) return null;
  const enriched = await stageId('enriched');
  const approach = await stageId('approach');
  const key = data.stage_id === enriched ? 'enriched' : data.stage_id === approach ? 'approach' : null;
  if (!stageAfterScheduledMeeting(key)) return null;
  const callId = await stageId('call_scheduled');
  const named = await db.from('pipeline_stages').select('name').eq('id', callId).maybeSingle();
  if (named.error) throw named.error;
  const { error: upd } = await db.from('leads').update({ stage_id: callId, updated_by: actorId }).eq('id', leadId);
  if (upd) throw upd;
  return (typeof named.data?.name === 'string' && named.data.name) || 'Call 15 Min Agendada';
}

async function importOwnerMeetings(ownerId: string, timeMin: string, timeMax: string) {
  const conn = await getConnection(ownerId);
  if (!conn) return;
  const token = await accessTokenFor(conn);
  const own = conn.google_email.trim().toLowerCase();
  const mapped = new Map<string, NonNullable<ReturnType<typeof activityFromGoogleEvent>>>();
  for (const ev of await listGoogleEvents(token, timeMin, timeMax)) {
    const row = activityFromGoogleEvent(ev);
    if (row) mapped.set(row.google_event_id, row);
  }
  if (mapped.size === 0) return;

  const byEmail = await leadsByAttendee([...new Set([...mapped.values()].flatMap((m) => m.emails.filter((email) => email !== own)))]);
  const { data, error } = await db
    .from('activities')
    .select('id, google_event_id, status, title, due_at, lead_id, meeting_url')
    .eq('owner_id', ownerId)
    .in('google_event_id', [...mapped.keys()]);
  if (error) throw error;
  const existing = new Map((data ?? []).map((row) => [row.google_event_id as string, row]));

  const toInsert: Record<string, unknown>[] = [];
  const linked: string[] = [];
  for (const meeting of mapped.values()) {
    const leadId = leadFor(meeting.emails, byEmail);
    const row = existing.get(meeting.google_event_id);
    if (!row) {
      if (!meeting.canceled) {
        toInsert.push({
          owner_id: ownerId,
          created_by: ownerId,
          lead_id: leadId,
          type: 'meeting',
          title: meeting.title,
          description: meeting.description,
          due_at: meeting.due_at,
          meeting_url: meeting.meeting_url,
          google_event_id: meeting.google_event_id,
          status: 'pending',
        });
        if (leadId) linked.push(leadId);
      }
      continue;
    }
    if (row.status !== 'pending') continue;
    if (meeting.canceled) {
      await db.from('activities').update({ status: 'canceled' }).eq('id', row.id);
      continue;
    }
    const patch: Record<string, unknown> = {};
    const sameTime = row.due_at && new Date(row.due_at).getTime() === new Date(meeting.due_at).getTime();
    if (row.title !== meeting.title) patch.title = meeting.title;
    if (!sameTime) patch.due_at = meeting.due_at;
    if (meeting.meeting_url && row.meeting_url !== meeting.meeting_url) patch.meeting_url = meeting.meeting_url;
    if (!row.lead_id && leadId) {
      patch.lead_id = leadId;
      linked.push(leadId);
    }
    if (Object.keys(patch).length) await db.from('activities').update(patch).eq('id', row.id);
  }
  if (toInsert.length) {
    const { error: insertError } = await db.from('activities').insert(toInsert);
    if (insertError) throw insertError;
  }
  for (const leadId of new Set(linked)) {
    try {
      await placeMeetingOnPipeline(ownerId, leadId);
    } catch (err) {
      logger.warn({ err, lead_id: leadId }, 'Falha ao colocar reunião importada no pipeline');
    }
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
    const { id: eventId, meetingUrl } = await upsertGoogleEvent(token, activity);
    const patch: Record<string, string> = {};
    if (eventId !== activity.google_event_id) patch.google_event_id = eventId;
    if (meetingUrl && meetingUrl !== activity.meeting_url) patch.meeting_url = meetingUrl;
    if (Object.keys(patch).length) await db.from('activities').update(patch).eq('id', activity.id);
  } catch (err) {
    logger.warn({ err, activity_id: activity.id }, 'Falha ao sincronizar Google Calendar');
  }
}

export function calendarAppPath(next: CalendarReturnTo, google: 'connected' | 'error' | 'denied') {
  const path = next === 'integracoes' ? '/integracoes' : '/agenda';
  return `${env.APP_URL.replace(/\/$/, '')}${path}?google=${google}`;
}
