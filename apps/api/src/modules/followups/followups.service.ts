import type { z } from 'zod';
import {
  buildCadence,
  can,
  canEditLead,
  followupMessage,
  type followupComplete,
  type followupCreate,
  type followupListQuery,
  type followupUpdate,
  type Profile,
} from '@kidoo/shared';
import { db } from '../../config/supabase.js';
import { dbError, forbidden, HttpError, must } from '../../utils/http.js';
import { findRow } from '../leads/leads.repository.js';
import { getSettings } from '../settings/settings.service.js';

type User = Pick<Profile, 'id' | 'role' | 'full_name'>;

const SELECT =
  '*, lead:lead_id(id, company_name, status, owner_id, lead_contacts(name, phone, is_primary), lead_diagnostics(specific_pain, proposed_solution, opening_hook, generated_at))';

type Row = {
  lead: { lead_contacts: { name: string; phone: string | null; is_primary: boolean }[] } & Record<string, unknown>;
} & Record<string, unknown>;

/** Achata o contato principal para o front montar o link do WhatsApp. */
const shape = (r: Row) => {
  const contact = [...(r.lead?.lead_contacts ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0];
  return { ...r, lead: r.lead && { ...r.lead, contact_name: contact?.name ?? null, contact_phone: contact?.phone ?? null } };
};

export async function listFollowups(user: User, q: z.infer<typeof followupListQuery>) {
  let query = db.from('followups').select(SELECT, { count: 'exact' });
  if (!can(user.role, 'leads.write_any')) query = query.eq('owner_id', user.id);
  else if (q.owner_id) query = query.eq('owner_id', q.owner_id);
  if (q.lead_id) query = query.eq('lead_id', q.lead_id);
  if (q.status !== 'all') query = query.eq('status', q.status);
  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (q.view === 'overdue') query = query.eq('status', 'pending').lt('due_at', now.toISOString());
  if (q.view === 'today') query = query.gte('due_at', now.toISOString()).lt('due_at', endOfDay.toISOString());
  if (q.view === 'upcoming') query = query.gte('due_at', endOfDay.toISOString());
  const from = (q.page - 1) * q.page_size;
  const { data, error, count } = await query.order('due_at').range(from, from + q.page_size - 1);
  if (error) throw dbError(error);
  return { data: (data as Row[]).map(shape), total: count ?? 0, page: q.page, page_size: q.page_size };
}

async function editableLead(user: User, leadId: string) {
  const lead = await findRow(leadId);
  if (!canEditLead(user, lead)) throw forbidden('Você só pode agendar follow-ups nos seus leads');
  if (lead.status !== 'open') throw new HttpError(409, 'conflict', 'A cadência fica pausada em negócios ganhos ou perdidos');
  return lead;
}

export async function createFollowup(user: User, input: z.infer<typeof followupCreate>) {
  const lead = await editableLead(user, input.lead_id);
  const row = must(
    await db
      .from('followups')
      .insert({ ...input, owner_id: lead.owner_id ?? user.id })
      .select(SELECT)
      .single(),
  );
  return shape(row as Row);
}

export async function createCadence(user: User, leadId: string, anchorAt: string) {
  const lead = await editableLead(user, leadId);
  const [settings, ctx] = await Promise.all([
    getSettings(),
    db
      .from('leads')
      .select('company_name, owner:owner_id(full_name), lead_contacts(name, is_primary), lead_diagnostics(specific_pain, proposed_solution, opening_hook, generated_at)')
      .eq('id', leadId)
      .single(),
  ]);
  const info = must(ctx) as unknown as {
    company_name: string;
    owner: { full_name: string } | null;
    lead_contacts: { name: string; is_primary: boolean }[];
    lead_diagnostics: { specific_pain: string | null; proposed_solution: string | null; opening_hook: string | null; generated_at: string }[];
  };
  const diag = [...info.lead_diagnostics].sort((a, b) => b.generated_at.localeCompare(a.generated_at))[0];
  const contact = info.lead_contacts.find((c) => c.is_primary) ?? info.lead_contacts[0];
  const messageCtx = {
    company_name: info.company_name,
    contact_name: contact?.name,
    sender_name: info.owner?.full_name ?? user.full_name,
    specific_pain: diag?.specific_pain,
    proposed_solution: diag?.proposed_solution,
  };
  const rows = buildCadence(new Date(anchorAt), settings.cadence.steps).map((s) => ({
    lead_id: leadId,
    owner_id: lead.owner_id ?? user.id,
    step: s.step,
    title: s.title,
    due_at: s.due_at,
    anchor_at: anchorAt,
    message: followupMessage(s.step, messageCtx),
  }));
  const created = must(await db.from('followups').insert(rows).select('id'));
  // Substitui a cadência anterior somente depois de gravar a nova.
  const keep = created.map((r) => r.id);
  must(
    await db
      .from('followups')
      .update({ status: 'canceled' })
      .eq('lead_id', leadId)
      .eq('status', 'pending')
      .in('step', settings.cadence.steps.map((s) => s.key))
      .not('id', 'in', `(${keep.join(',')})`)
      .select('id'),
  );
  return created.length;
}

async function loadOwned(user: User, id: string) {
  const f = must(await db.from('followups').select('id, owner_id, status, lead_id').eq('id', id).maybeSingle());
  if (f.owner_id !== user.id && !can(user.role, 'leads.write_any')) throw forbidden();
  return f;
}

export async function updateFollowup(user: User, id: string, input: z.infer<typeof followupUpdate>) {
  const f = await loadOwned(user, id);
  if (f.status === 'done') throw new HttpError(409, 'conflict', 'Follow-up já concluído');
  const row = must(await db.from('followups').update(input).eq('id', id).select(SELECT).single());
  return shape(row as Row);
}

export async function completeFollowup(user: User, id: string, input: z.infer<typeof followupComplete>) {
  await loadOwned(user, id);
  return must(
    await db.rpc('complete_followup', {
      p_actor: user.id,
      p_followup: id,
      p_channel: input.channel,
      p_outcome: input.outcome ?? null,
      p_next_due: input.next_due_at ?? null,
    }),
  );
}
