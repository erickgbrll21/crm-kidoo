import type { z } from 'zod';
import {
  avgDaysToClose,
  can,
  computeBreakdown,
  computeByOwner,
  computeFunnel,
  computeLossReasons,
  computeRevenueByMonth,
  computeSummary,
  type dashboardQuery,
  type DateRange,
  type MetricLead,
  type Profile,
  type StageKey,
} from '@kidoo/shared';
import { db } from '../../config/supabase.js';
import { dbError, must } from '../../utils/http.js';
import { getSettings } from '../settings/settings.service.js';
import { listStages } from '../leads/leads.repository.js';

type User = Pick<Profile, 'id' | 'role'>;
type Query = z.infer<typeof dashboardQuery>;

const FIELDS =
  'id, status, owner_id, source, niche, created_at, won_at, lost_at, lost_reason, estimated_setup, estimated_mrr, closed_setup, closed_mrr, last_interaction_at, next_activity_at, stage_key';

/** Escopo efetivo: closers sem visão do time veem só os próprios números. */
async function scopeOwner(user: User, ownerId?: string) {
  if (can(user.role, 'leads.write_any')) return ownerId;
  const { closer_sees_all_leads } = await getSettings();
  return closer_sees_all_leads ? ownerId : user.id;
}

async function fetchLeads(ownerId?: string): Promise<MetricLead[]> {
  const out: MetricLead[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from('leads_view').select(FIELDS).is('archived_at', null).order('id').range(from, from + 999);
    if (ownerId) q = q.eq('owner_id', ownerId);
    const { data, error } = await q;
    if (error) throw dbError(error);
    out.push(...(data as MetricLead[]));
    if (data.length < 1000) return out;
  }
}

const rangeOf = (q: Query): DateRange => ({ from: new Date(q.from), to: new Date(q.to) });

export async function summary(user: User, q: Query) {
  const owner = await scopeOwner(user, q.owner_id);
  let overdue = db
    .from('followups')
    .select('id, lead:lead_id!inner(status)', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lt('due_at', new Date().toISOString())
    .eq('lead.status', 'open');
  if (owner) overdue = overdue.eq('owner_id', owner);
  const [leads, settings, overdueRes] = await Promise.all([fetchLeads(owner), getSettings(), overdue]);
  if (overdueRes.error) throw dbError(overdueRes.error);
  return computeSummary(leads, rangeOf(q), { thresholds: settings.stagnation, overdueFollowups: overdueRes.count ?? 0 });
}

export async function funnel(user: User, q: Query) {
  const [leads, stages] = await Promise.all([fetchLeads(await scopeOwner(user, q.owner_id)), listStages()]);
  return computeFunnel(leads, stages as { key: StageKey; name: string }[], rangeOf(q));
}

export async function revenue(user: User, q: Query) {
  return computeRevenueByMonth(await fetchLeads(await scopeOwner(user, q.owner_id)), rangeOf(q));
}

async function owners() {
  return must(await db.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'));
}

export async function closers(user: User, q: Query) {
  const owner = await scopeOwner(user, q.owner_id);
  const [leads, people] = await Promise.all([fetchLeads(owner), owners()]);
  return computeByOwner(leads, owner ? people.filter((p) => p.id === owner) : people, rangeOf(q));
}

export async function breakdown(user: User, q: Query) {
  const leads = await fetchLeads(await scopeOwner(user, q.owner_id));
  const r = rangeOf(q);
  return { by_source: computeBreakdown(leads, 'source', r), by_niche: computeBreakdown(leads, 'niche', r) };
}

export async function report(q: Query) {
  const r = rangeOf(q);
  const [leads, people, stages, history, proposals, activities] = await Promise.all([
    fetchLeads(q.owner_id),
    owners(),
    listStages(),
    db.from('lead_stage_history').select('lead_id, to_stage_id, lead:lead_id!inner(owner_id)').in('event', ['created', 'stage_changed', 'won']).gte('created_at', q.from).lte('created_at', q.to).limit(10000),
    (() => {
      let p = db.from('proposals').select('status, setup_value, mrr_value').gte('created_at', q.from).lte('created_at', q.to);
      if (q.owner_id) p = p.eq('owner_id', q.owner_id);
      return p;
    })(),
    (() => {
      let a = db.from('activities').select('type').eq('status', 'done').gte('completed_at', q.from).lte('completed_at', q.to).limit(10000);
      if (q.owner_id) a = a.eq('owner_id', q.owner_id);
      return a;
    })(),
  ]);

  const hist = must(history) as unknown as { lead_id: string; to_stage_id: string; lead: { owner_id: string | null } }[];
  const reached = stages.map((s) => {
    const ids = new Set(hist.filter((h) => h.to_stage_id === s.id && (!q.owner_id || h.lead.owner_id === q.owner_id)).map((h) => h.lead_id));
    return { key: s.key, name: s.name, reached: ids.size };
  });
  const stageConversion = reached.map((s, i) => ({
    ...s,
    to_next: i < reached.length - 1 && s.reached ? Math.round((reached[i + 1]!.reached / s.reached) * 10_000) / 10_000 : null,
  }));

  const props = must(proposals);
  const proposalStats = ['draft', 'sent', 'negotiating', 'accepted', 'rejected', 'expired'].map((status) => ({
    status,
    count: props.filter((p) => p.status === status).length,
  }));

  const acts = must(activities);
  const activityStats = Object.entries(
    acts.reduce<Record<string, number>>((m, a) => ({ ...m, [a.type]: (m[a.type] ?? 0) + 1 }), {}),
  ).map(([type, count]) => ({ type, count }));

  const won = leads.filter((l) => l.status === 'won' && l.won_at && new Date(l.won_at) >= r.from && new Date(l.won_at) <= r.to);
  return {
    period: { from: q.from, to: q.to },
    stage_conversion: stageConversion,
    closers: computeByOwner(leads, q.owner_id ? people.filter((p) => p.id === q.owner_id) : people, r),
    avg_days_to_close: avgDaysToClose(leads, r),
    loss_reasons: computeLossReasons(leads, r),
    by_source: computeBreakdown(leads, 'source', r),
    by_niche: computeBreakdown(leads, 'niche', r),
    closed_setup: won.reduce((a, l) => a + Number(l.closed_setup ?? 0), 0),
    closed_mrr: won.reduce((a, l) => a + Number(l.closed_mrr ?? 0), 0),
    proposals: proposalStats,
    activities: activityStats,
  };
}
