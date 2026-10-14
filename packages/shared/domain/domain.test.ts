import { describe, expect, it } from 'vitest';
import { classifySize, findDuplicate, stagnationLevel } from './leads.js';
import { buildCadence, followupMessage, whatsappLink } from './followups.js';
import { computeFunnel, computeSummary, type MetricLead } from './metrics.js';
import { can, canEditLead } from './permissions.js';
import { DEFAULT_SETTINGS } from './settings.js';
import { antigravityWebhook, leadUpdate } from '../schemas/index.js';

const now = new Date('2026-10-14T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
const t = DEFAULT_SETTINGS.stagnation;

describe('termômetro de estagnação', () => {
  it('classifica pelas faixas de 24h e 48h', () => {
    expect(stagnationLevel({ last_interaction_at: hoursAgo(10), created_at: hoursAgo(100) }, t, now).level).toBe('normal');
    expect(stagnationLevel({ last_interaction_at: hoursAgo(30), created_at: hoursAgo(100) }, t, now).level).toBe('warning');
    expect(stagnationLevel({ last_interaction_at: hoursAgo(49), created_at: hoursAgo(100) }, t, now).level).toBe('cold');
  });
  it('usa a criação quando nunca houve contato', () => {
    expect(stagnationLevel({ last_interaction_at: null, created_at: hoursAgo(60) }, t, now).level).toBe('cold');
  });
  it('suspende o alerta quando há atividade futura agendada', () => {
    const lead = { last_interaction_at: hoursAgo(72), created_at: hoursAgo(100), next_activity_at: hoursAgo(-5) };
    expect(stagnationLevel(lead, t, now).level).toBe('normal');
  });
  it('não alerta negócios fechados', () => {
    expect(stagnationLevel({ last_interaction_at: hoursAgo(200), created_at: hoursAgo(300), status: 'won' }, t, now).level).toBe('normal');
  });
});

describe('porte', () => {
  const r = DEFAULT_SETTINGS.size_ranges;
  it('respeita limites inclusivos', () => {
    expect(classifySize(50_000, r)).toBe('micro');
    expect(classifySize(50_001, r)).toBe('small');
    expect(classifySize(180_000, r)).toBe('medium');
    expect(classifySize(500_000, r)).toBe('large');
    expect(classifySize(500_001, r)).toBe('enterprise');
    expect(classifySize(null, r)).toBeNull();
  });
});

describe('deduplicação', () => {
  const candidates = [
    { id: 'a', company_name: 'Clínica Sorriso Ltda', cnpj: '12.345.678/0001-90', contact_email: 'ana@sorriso.com', contact_phone: '(31) 99999-0000' },
    { id: 'b', company_name: 'Desentupidora Rápida', cnpj: null, contact_email: null, contact_phone: null },
  ];
  it('casa por CNPJ, e-mail, telefone e nome normalizado', () => {
    expect(findDuplicate({ company_name: 'X', cnpj: '12345678000190' }, candidates)).toEqual({ id: 'a', by: 'cnpj' });
    expect(findDuplicate({ company_name: 'X', email: 'ANA@sorriso.com' }, candidates)).toEqual({ id: 'a', by: 'email' });
    expect(findDuplicate({ company_name: 'X', phone: '5531999990000' }, candidates)).toEqual({ id: 'a', by: 'phone' });
    expect(findDuplicate({ company_name: 'desentupidora rapida ME' }, candidates)).toEqual({ id: 'b', by: 'company' });
  });
  it('não casa leads distintos', () => {
    expect(findDuplicate({ company_name: 'Contábil Norte', phone: '3133334444' }, candidates)).toBeNull();
  });
});

describe('follow-ups', () => {
  it('gera D+1, D+3, D+5 e D+8 a partir do marco', () => {
    const cadence = buildCadence(new Date('2026-10-01T15:00:00'), DEFAULT_SETTINGS.cadence.steps);
    expect(cadence.map((c) => c.step)).toEqual(['d1', 'd3', 'd5', 'd8']);
    expect(new Date(cadence[0]!.due_at).getDate()).toBe(2);
    expect(new Date(cadence[3]!.due_at).getDate()).toBe(9);
  });
  it('não inventa dados ausentes na mensagem', () => {
    const msg = followupMessage('d1', { company_name: 'Clínica X' });
    expect(msg).toContain('Clínica X');
    expect(msg).not.toMatch(/undefined|null/);
    const rich = followupMessage('d3', { company_name: 'Clínica X', contact_name: 'Mariana Souza', specific_pain: 'Demora no atendimento.' });
    expect(rich).toContain('Mariana');
    expect(rich).toContain('demora no atendimento');
  });
  it('monta link wa.me com DDI', () => {
    expect(whatsappLink('(31) 99999-0000', 'oi')).toBe('https://wa.me/5531999990000?text=oi');
    expect(whatsappLink('123')).toBeNull();
  });
});

describe('métricas', () => {
  const base: MetricLead = {
    id: '1', status: 'open', owner_id: 'p', source: 'manual', niche: 'Saúde', created_at: hoursAgo(500),
    won_at: null, lost_at: null, lost_reason: null, estimated_setup: 5000, estimated_mrr: 1000,
    closed_setup: null, closed_mrr: null, last_interaction_at: hoursAgo(1), next_activity_at: null, stage_key: 'approach',
  };
  const leads: MetricLead[] = [
    base,
    { ...base, id: '2', last_interaction_at: hoursAgo(80) },
    { ...base, id: '3', status: 'won', won_at: hoursAgo(24), closed_setup: 8000, closed_mrr: 1500, stage_key: 'won' },
    { ...base, id: '4', status: 'lost', lost_at: hoursAgo(24), lost_reason: 'Preço' },
    { ...base, id: '5', status: 'won', won_at: hoursAgo(24 * 90), closed_setup: 99999, closed_mrr: 9999 },
  ];
  const range = { from: new Date(now.getTime() - 30 * 86_400_000), to: now };

  it('separa potencial de contratado e respeita o período', () => {
    const s = computeSummary(leads, range, { thresholds: t, overdueFollowups: 2, now });
    expect(s.active_leads).toBe(2);
    expect(s.pipeline_setup).toBe(10000);
    expect(s.closed_setup).toBe(8000);
    expect(s.closed_mrr).toBe(1500);
    expect(s.conversion).toEqual({ rate: 0.5, won: 1, decided: 2 });
    expect(s.stagnant_leads).toBe(1);
    expect(s.overdue_followups).toBe(2);
  });
  it('funil conta abertos por etapa e ganhos do período', () => {
    const f = computeFunnel(leads, [{ key: 'approach', name: 'Abordagem' }, { key: 'won', name: 'Ganho' }], range);
    expect(f).toEqual([
      { key: 'approach', name: 'Abordagem', count: 2, setup: 10000, mrr: 2000 },
      { key: 'won', name: 'Ganho', count: 1, setup: 8000, mrr: 1500 },
    ]);
  });
});

describe('permissões', () => {
  it('aplica papéis, não nomes', () => {
    expect(can('admin', 'users.manage')).toBe(true);
    expect(can('manager', 'users.manage')).toBe(false);
    expect(can('closer', 'reports.view')).toBe(false);
    expect(canEditLead({ id: 'u1', role: 'closer' }, { owner_id: 'u1' })).toBe(true);
    expect(canEditLead({ id: 'u1', role: 'closer' }, { owner_id: 'u2' })).toBe(false);
    expect(canEditLead({ id: 'u1', role: 'manager' }, { owner_id: 'u2' })).toBe(true);
  });
});

describe('schemas', () => {
  it('PATCH de lead não injeta valores padrão', () => {
    expect(leadUpdate.parse({ niche: 'Saúde' })).toEqual({ niche: 'Saúde' });
  });
  it('aceita o payload de exemplo do Antigravity', () => {
    const r = antigravityWebhook.safeParse({
      event_id: 'ag-0001',
      event_type: 'lead.enriched',
      company: { name: 'Clínica Exemplo', industry: 'Saúde', estimated_monthly_revenue: 180000 },
      contact: { name: 'Mariana', phone: '5531999999999', email: 'mariana@example.com' },
      diagnostic: { deep_niche: 'Clínica particular', specific_pain: 'Demora', proposed_solution: 'IA', suggested_setup: 6500, suggested_mrr: 1200, opening_hook: 'Oi' },
      source: 'antigravity',
    });
    expect(r.success).toBe(true);
  });
});
