import type { z } from 'zod';
import { can, canEditLead, type activityCreate, type activityListQuery, type activityUpdate, type Profile } from '@kidoo/shared';
import { db } from '../../config/supabase.js';
import { dbError, forbidden, HttpError, must } from '../../utils/http.js';
import { googleCalendarConfigured } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { importGoogleMeetings, placeMeetingOnPipeline, pushActivityToCalendar } from '../integrations/google-calendar.js';
import { findRow } from '../leads/leads.repository.js';

type User = Pick<Profile, 'id' | 'role'>;

const ACTIVITY_SELECT =
  '*, lead:lead_id(id, company_name, niche, estimated_setup, estimated_mrr, stage:stage_id(name, key), lead_contacts(name, email, is_primary))';

function pastedMeetingUrl(description: string | null | undefined) {
  const found = description?.match(/https?:\/\/\S+/);
  return found ? found[0].replace(/[),.;]+$/, '').slice(0, 500) : null;
}

function isScheduledMeeting(a: { type?: string; lead_id?: string | null; due_at?: string | null; status?: string }) {
  return (a.type === 'call' || a.type === 'meeting') && !!a.lead_id && !!a.due_at && a.status === 'pending';
}

async function scheduleOnPipeline(actorId: string, activity: { type: string; lead_id: string | null; due_at: string | null; status: string; lead?: { stage?: { name: string; key?: string } | null } | null }) {
  if (!isScheduledMeeting(activity) || !activity.lead_id) return;
  try {
    const stageName = await placeMeetingOnPipeline(actorId, activity.lead_id);
    if (stageName && activity.lead) activity.lead.stage = { name: stageName, key: 'call_scheduled' };
  } catch (err) {
    logger.warn({ err, lead_id: activity.lead_id }, 'Falha ao colocar a reunião no pipeline');
  }
}

const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function googleWindow(q: z.infer<typeof activityListQuery>) {
  if (q.from && q.to) return { timeMin: q.from, timeMax: q.to };
  const now = Date.now();
  const day = 86_400_000;
  if (q.view === 'today') {
    const s = startOfDay();
    return { timeMin: s.toISOString(), timeMax: new Date(s.getTime() + day).toISOString() };
  }
  if (q.view === 'next7') return { timeMin: new Date(now).toISOString(), timeMax: new Date(now + 7 * day).toISOString() };
  if (q.view === 'overdue') return { timeMin: new Date(now - 30 * day).toISOString(), timeMax: new Date(now).toISOString() };
  return { timeMin: new Date(now - 30 * day).toISOString(), timeMax: new Date(now + 90 * day).toISOString() };
}

async function calendarOwners(user: User, q: z.infer<typeof activityListQuery>) {
  if (!can(user.role, 'leads.write_any')) return [user.id];
  if (q.owner_id) return [q.owner_id];
  const { data, error } = await db.from('google_calendar_connections').select('user_id');
  if (error) throw error;
  return (data ?? []).map((row) => row.user_id as string);
}

export async function listActivities(user: User, q: z.infer<typeof activityListQuery>) {
  if (!q.lead_id && googleCalendarConfigured()) {
    try {
      const window = googleWindow(q);
      await importGoogleMeetings(await calendarOwners(user, q), window.timeMin, window.timeMax);
    } catch (err) {
      logger.warn({ err }, 'Falha ao importar reuniões do Google Calendar');
    }
  }
  let query = db.from('activities').select(ACTIVITY_SELECT, { count: 'exact' });
  // Closers enxergam a própria agenda; gestão vê a de todos.
  if (!can(user.role, 'leads.write_any')) query = query.eq('owner_id', user.id);
  else if (q.owner_id) query = query.eq('owner_id', q.owner_id);
  if (q.lead_id) query = query.eq('lead_id', q.lead_id);
  if (q.status !== 'all') query = query.eq('status', q.status);
  const now = new Date();
  if (q.view === 'today') {
    const s = startOfDay(now);
    query = query.gte('due_at', s.toISOString()).lt('due_at', new Date(s.getTime() + 86_400_000).toISOString());
  } else if (q.view === 'next7') {
    query = query.gte('due_at', now.toISOString()).lt('due_at', new Date(now.getTime() + 7 * 86_400_000).toISOString());
  } else if (q.view === 'overdue') {
    query = query.eq('status', 'pending').lt('due_at', now.toISOString());
  }
  if (q.from) query = query.gte('due_at', q.from);
  if (q.to) query = query.lte('due_at', q.to);
  const from = (q.page - 1) * q.page_size;
  const { data, error, count } = await query
    .order('due_at', { ascending: true, nullsFirst: false })
    .range(from, from + q.page_size - 1);
  if (error) throw dbError(error);
  return { data, total: count ?? 0, page: q.page, page_size: q.page_size };
}

async function assertCanUseLead(user: User, leadId: string | null | undefined) {
  if (!leadId) return;
  if (!canEditLead(user, await findRow(leadId))) throw forbidden('Você só pode registrar atividades nos seus leads');
}

export async function createActivity(user: User, input: z.infer<typeof activityCreate>) {
  await assertCanUseLead(user, input.lead_id);
  if (input.owner_id && input.owner_id !== user.id && !can(user.role, 'leads.assign')) {
    throw forbidden('Somente gestores podem criar atividades para outra pessoa');
  }
  if (!input.done && !input.due_at && input.type !== 'note') {
    throw new HttpError(422, 'validation_error', 'Informe data e horário da atividade');
  }
  const { done, ...fields } = input;
  const isDone = done || input.type === 'note';
  const meetingUrl = fields.type === 'call' || fields.type === 'meeting' ? pastedMeetingUrl(fields.description) : null;
  const created = must(
    await db
      .from('activities')
      .insert({
        ...fields,
        ...(meetingUrl ? { meeting_url: meetingUrl } : {}),
        owner_id: input.owner_id ?? user.id,
        created_by: user.id,
        status: isDone ? 'done' : 'pending',
        completed_at: isDone ? new Date().toISOString() : null,
      })
      .select(ACTIVITY_SELECT)
      .single(),
  );
  await scheduleOnPipeline(user.id, created);
  await pushActivityToCalendar(created);
  return created;
}

async function loadOwned(user: User, id: string) {
  const a = must(await db.from('activities').select('id, owner_id, status, lead_id, type, meeting_url').eq('id', id).maybeSingle());
  if (a.owner_id !== user.id && !can(user.role, 'leads.write_any')) throw forbidden();
  return a;
}

export async function updateActivity(user: User, id: string, input: z.infer<typeof activityUpdate>) {
  const a = await loadOwned(user, id);
  if (a.status === 'done') throw new HttpError(409, 'conflict', 'Atividades concluídas não podem ser editadas');
  if (input.owner_id && input.owner_id !== a.owner_id && !can(user.role, 'leads.assign')) throw forbidden();
  const patch: Record<string, unknown> = { ...input };
  const type = (typeof patch.type === 'string' ? patch.type : a.type) as string;
  if ((type === 'call' || type === 'meeting') && !a.meeting_url && typeof patch.description === 'string') {
    const url = pastedMeetingUrl(patch.description);
    if (url) patch.meeting_url = url;
  }
  const updated = must(await db.from('activities').update(patch).eq('id', id).select(ACTIVITY_SELECT).single());
  await scheduleOnPipeline(user.id, updated);
  await pushActivityToCalendar(updated);
  return updated;
}

export async function completeActivity(user: User, id: string, outcome: string | null | undefined) {
  const a = await loadOwned(user, id);
  if (a.status !== 'pending') throw new HttpError(409, 'conflict', 'Esta atividade não está pendente');
  return must(
    await db
      .from('activities')
      .update({ status: 'done', completed_at: new Date().toISOString(), outcome: outcome ?? null })
      .eq('id', id)
      .select(ACTIVITY_SELECT)
      .single(),
  );
}
