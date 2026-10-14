import type { Lead, StageKey } from '../types/index.js';
import { stagnationLevel } from './leads.js';

export interface DateRange {
  from: Date;
  to: Date;
}

export type MetricLead = Pick<
  Lead,
  | 'id'
  | 'status'
  | 'owner_id'
  | 'source'
  | 'niche'
  | 'created_at'
  | 'won_at'
  | 'lost_at'
  | 'lost_reason'
  | 'estimated_setup'
  | 'estimated_mrr'
  | 'closed_setup'
  | 'closed_mrr'
  | 'last_interaction_at'
  | 'next_activity_at'
  | 'stage_key'
>;

const inRange = (iso: string | null, r: DateRange) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= r.from.getTime() && t <= r.to.getTime();
};
const sum = (xs: (number | null)[]) => Math.round(xs.reduce<number>((a, x) => a + Number(x ?? 0), 0) * 100) / 100;
const ratio = (a: number, b: number) => (b === 0 ? null : Math.round((a / b) * 10_000) / 10_000);

/**
 * Conversão = ganhos ÷ (ganhos + perdidos) decididos no período.
 * Valores potenciais (leads abertos, snapshot atual) nunca se misturam com contratados (ganhos no período).
 */
export function computeSummary(
  leads: MetricLead[],
  range: DateRange,
  opts: { thresholds: { warning_hours: number; cold_hours: number }; overdueFollowups: number; now?: Date },
) {
  const open = leads.filter((l) => l.status === 'open');
  const won = leads.filter((l) => l.status === 'won' && inRange(l.won_at, range));
  const lost = leads.filter((l) => l.status === 'lost' && inRange(l.lost_at, range));
  const closedSetup = sum(won.map((l) => l.closed_setup));
  const closedMrr = sum(won.map((l) => l.closed_mrr));
  return {
    period: { from: range.from.toISOString(), to: range.to.toISOString() },
    active_leads: open.length,
    pipeline_setup: sum(open.map((l) => l.estimated_setup)),
    pipeline_mrr: sum(open.map((l) => l.estimated_mrr)),
    won_count: won.length,
    lost_count: lost.length,
    closed_setup: closedSetup,
    closed_mrr: closedMrr,
    conversion: { rate: ratio(won.length, won.length + lost.length), won: won.length, decided: won.length + lost.length },
    avg_ticket_setup: won.length ? Math.round((closedSetup / won.length) * 100) / 100 : null,
    avg_ticket_mrr: won.length ? Math.round((closedMrr / won.length) * 100) / 100 : null,
    stagnant_leads: open.filter((l) => stagnationLevel(l, opts.thresholds, opts.now).level === 'cold').length,
    overdue_followups: opts.overdueFollowups,
  };
}

export function computeFunnel(leads: MetricLead[], stages: { key: StageKey; name: string }[], range: DateRange) {
  return stages.map((s) => {
    const items =
      s.key === 'won'
        ? leads.filter((l) => l.status === 'won' && inRange(l.won_at, range))
        : leads.filter((l) => l.status === 'open' && l.stage_key === s.key);
    return {
      key: s.key,
      name: s.name,
      count: items.length,
      setup: sum(items.map((l) => (s.key === 'won' ? l.closed_setup : l.estimated_setup))),
      mrr: sum(items.map((l) => (s.key === 'won' ? l.closed_mrr : l.estimated_mrr))),
    };
  });
}

export function computeRevenueByMonth(leads: MetricLead[], range: DateRange) {
  const months = new Map<string, { month: string; won: number; setup: number; mrr: number }>();
  const cursor = new Date(range.from.getFullYear(), range.from.getMonth(), 1);
  while (cursor <= range.to) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    months.set(key, { month: key, won: 0, setup: 0, mrr: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  for (const l of leads) {
    if (l.status !== 'won' || !inRange(l.won_at, range)) continue;
    const d = new Date(l.won_at!);
    const m = months.get(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    if (!m) continue;
    m.won += 1;
    m.setup = sum([m.setup, l.closed_setup]);
    m.mrr = sum([m.mrr, l.closed_mrr]);
  }
  return [...months.values()];
}

export function computeByOwner(leads: MetricLead[], owners: { id: string; full_name: string }[], range: DateRange) {
  return owners.map((o) => {
    const mine = leads.filter((l) => l.owner_id === o.id);
    const won = mine.filter((l) => l.status === 'won' && inRange(l.won_at, range));
    const lost = mine.filter((l) => l.status === 'lost' && inRange(l.lost_at, range));
    return {
      owner_id: o.id,
      name: o.full_name,
      open: mine.filter((l) => l.status === 'open').length,
      won: won.length,
      lost: lost.length,
      conversion: ratio(won.length, won.length + lost.length),
      closed_setup: sum(won.map((l) => l.closed_setup)),
      closed_mrr: sum(won.map((l) => l.closed_mrr)),
    };
  });
}

/** Leads criados no período, agrupados, com quantos desses já foram ganhos. */
export function computeBreakdown(leads: MetricLead[], field: 'source' | 'niche', range: DateRange) {
  const groups = new Map<string, { key: string; leads: number; won: number }>();
  for (const l of leads) {
    if (!inRange(l.created_at, range)) continue;
    const key = (l[field] as string | null) || 'Não informado';
    const g = groups.get(key) ?? { key, leads: 0, won: 0 };
    g.leads += 1;
    if (l.status === 'won') g.won += 1;
    groups.set(key, g);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, conversion: ratio(g.won, g.leads) }))
    .sort((a, b) => b.leads - a.leads);
}

export function computeLossReasons(leads: MetricLead[], range: DateRange) {
  const counts = new Map<string, number>();
  for (const l of leads) {
    if (l.status !== 'lost' || !inRange(l.lost_at, range)) continue;
    const r = l.lost_reason?.trim() || 'Não informado';
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  return [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}

export function avgDaysToClose(leads: MetricLead[], range: DateRange) {
  const won = leads.filter((l) => l.status === 'won' && inRange(l.won_at, range));
  if (!won.length) return null;
  const days = won.map((l) => (new Date(l.won_at!).getTime() - new Date(l.created_at).getTime()) / 86_400_000);
  return Math.round((days.reduce((a, b) => a + b, 0) / won.length) * 10) / 10;
}
