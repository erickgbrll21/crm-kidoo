import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { fake } from './fake-instance.js';

const app = createApp();
const SECRET = { 'x-webhook-secret': 'test-webhook-secret-0123456789' };

const payload = {
  event_id: 'ag-0001',
  event_type: 'lead.enriched',
  company: { name: 'Clínica Exemplo', industry: 'Saúde', estimated_monthly_revenue: 180000 },
  contact: { name: 'Mariana', phone: '5531999999999', email: 'mariana@example.com' },
  diagnostic: {
    deep_niche: 'Clínica particular',
    specific_pain: 'Demora no atendimento',
    proposed_solution: 'Automação com IA',
    suggested_setup: 6500,
    suggested_mrr: 1200,
    opening_hook: 'Mensagem consultiva',
  },
  source: 'antigravity',
};

function installEvents(opts: { duplicateStatus?: string } = {}) {
  const updates: unknown[] = [];
  fake.handlers.integration_events = (ops) => {
    if (fake.has(ops, 'insert')) {
      return opts.duplicateStatus
        ? { data: null, error: { code: '23505', message: 'duplicate key' } }
        : { data: { id: 'evt-1' }, error: null };
    }
    if (fake.has(ops, 'update')) {
      updates.push(fake.arg(ops, 'update')![0]);
      return { data: null, error: null };
    }
    return { data: { id: 'evt-1', status: opts.duplicateStatus, lead_id: 'lead-old' }, error: null };
  };
  return updates;
}

describe('webhook Antigravity', () => {
  it('rejeita origem sem credencial', async () => {
    expect((await request(app).post('/api/v1/webhooks/antigravity').send(payload)).status).toBe(401);
    expect((await request(app).post('/api/v1/webhooks/antigravity').set({ 'x-webhook-secret': 'errado' }).send(payload)).status).toBe(401);
  });

  it('valida o payload', async () => {
    const res = await request(app).post('/api/v1/webhooks/antigravity').set(SECRET).send({ event_id: 'x' });
    expect(res.status).toBe(422);
  });

  it('cria lead novo em Leads Enriquecidos com diagnóstico', async () => {
    installEvents();
    fake.handlers.leads_view = () => ({ data: [], error: null });
    fake.db.rpc.mockResolvedValueOnce({ data: 'lead-new', error: null });
    const res = await request(app).post('/api/v1/webhooks/antigravity').set(SECRET).send(payload);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'created', lead_id: 'lead-new', matched_by: null });
    const [fn, args] = fake.db.rpc.mock.calls[0]!;
    expect(fn).toBe('ingest_lead_event');
    expect(args).toMatchObject({
      p_event: 'evt-1',
      p_existing_lead: null,
      p_lead: { company_name: 'Clínica Exemplo', niche: 'Saúde', size: 'medium', estimated_setup: 6500, estimated_mrr: 1200 },
      p_contact: { name: 'Mariana', email: 'mariana@example.com' },
    });
  });

  it('é idempotente: evento repetido não é reprocessado', async () => {
    installEvents({ duplicateStatus: 'processed' });
    const res = await request(app).post('/api/v1/webhooks/antigravity').set(SECRET).send(payload);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'duplicate', lead_id: 'lead-old' });
    expect(fake.db.rpc).not.toHaveBeenCalled();
  });

  it('reprocessa evento que havia falhado', async () => {
    installEvents({ duplicateStatus: 'failed' });
    fake.handlers.leads_view = () => ({ data: [], error: null });
    fake.db.rpc.mockResolvedValueOnce({ data: 'lead-new', error: null });
    const res = await request(app).post('/api/v1/webhooks/antigravity').set(SECRET).send(payload);
    expect(res.status).toBe(201);
  });

  it('identifica lead duplicado por e-mail e atualiza em vez de criar', async () => {
    installEvents();
    fake.handlers.leads_view = () => ({
      data: [{ id: 'lead-existing', company_name: 'Outra Razão Social', cnpj: null, contact_email: 'mariana@example.com', contact_phone: null }],
      error: null,
    });
    fake.db.rpc.mockResolvedValueOnce({ data: 'lead-existing', error: null });
    const res = await request(app).post('/api/v1/webhooks/antigravity').set(SECRET).send({ ...payload, event_id: 'ag-0002' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'updated', lead_id: 'lead-existing', matched_by: 'email' });
    expect(fake.db.rpc.mock.calls[0]![1]).toMatchObject({ p_existing_lead: 'lead-existing', p_match: 'email' });
  });

  it('marca o evento como falho quando o processamento quebra', async () => {
    const updates = installEvents();
    fake.handlers.leads_view = () => ({ data: [], error: null });
    fake.db.rpc.mockResolvedValueOnce({ data: null, error: { code: '23514', message: 'check violation' } });
    const res = await request(app).post('/api/v1/webhooks/antigravity').set(SECRET).send(payload);
    expect(res.status).toBe(422);
    expect(updates[0]).toMatchObject({ status: 'failed' });
  });
});
