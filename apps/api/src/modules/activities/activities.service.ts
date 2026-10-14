import type { z } from 'zod';
import { can, canEditLead, type activityCreate, type activityListQuery, type activityUpdate, type Profile } from '@kidoo/shared';
import { db } from '../../config/supabase.js';
import { dbError, forbidden, HttpError, must } from '../../utils/http.js';
import { findRow } from '../leads/leads.repository.js';

type User = Pick<Profile, 'id' | 'role'>;

const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export async function listActivities(user: User, q: z.infer<typeof activityListQuery>) {
  let query = db.from('activities').select('*, lead:lead_id(id, company_name)', { count: 'exact' });
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
  return must(
    await db
      .from('activities')
      .insert({
        ...fields,
        owner_id: input.owner_id ?? user.id,
        created_by: user.id,
        status: isDone ? 'done' : 'pending',
        completed_at: isDone ? new Date().toISOString() : null,
      })
      .select('*, lead:lead_id(id, company_name)')
      .single(),
  );
}

async function loadOwned(user: User, id: string) {
  const a = must(await db.from('activities').select('id, owner_id, status, lead_id').eq('id', id).maybeSingle());
  if (a.owner_id !== user.id && !can(user.role, 'leads.write_any')) throw forbidden();
  return a;
}

export async function updateActivity(user: User, id: string, input: z.infer<typeof activityUpdate>) {
  const a = await loadOwned(user, id);
  if (a.status === 'done') throw new HttpError(409, 'conflict', 'Atividades concluídas não podem ser editadas');
  if (input.owner_id && input.owner_id !== a.owner_id && !can(user.role, 'leads.assign')) throw forbidden();
  return must(await db.from('activities').update(input).eq('id', id).select('*, lead:lead_id(id, company_name)').single());
}

export async function completeActivity(user: User, id: string, outcome: string | null | undefined) {
  const a = await loadOwned(user, id);
  if (a.status !== 'pending') throw new HttpError(409, 'conflict', 'Esta atividade não está pendente');
  return must(
    await db
      .from('activities')
      .update({ status: 'done', completed_at: new Date().toISOString(), outcome: outcome ?? null })
      .eq('id', id)
      .select('*, lead:lead_id(id, company_name)')
      .single(),
  );
}
