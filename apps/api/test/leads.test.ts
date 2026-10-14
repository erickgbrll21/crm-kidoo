import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { fake } from './fake-instance.js';
import { PROFILES } from './fake-db.js';

const app = createApp();
const LEAD_ID = '11111111-1111-4111-8111-111111111111';
const auth = (role: keyof typeof PROFILES) => ({ Authorization: `Bearer ${role}` });

function leadRow(overrides: Record<string, unknown> = {}) {
  return { id: LEAD_ID, owner_id: PROFILES.closer.id, status: 'open', stage_id: 's-enriched', company_name: 'Clínica Sorriso', ...overrides };
}

/** leads (tabela) devolve a linha; leads_view devolve a mesma linha "expandida". */
function installLead(row = leadRow()) {
  fake.handlers.leads = () => ({ data: row, error: null });
  fake.handlers.leads_view = () => ({ data: { ...row, stage_key: 'enriched' }, error: null, count: 1 });
}

describe('autenticação e autorização', () => {
  it('recusa requisição sem token', async () => {
    const res = await request(app).get('/api/v1/leads');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('informa sessão expirada', async () => {
    const res = await request(app).get('/api/v1/leads').set({ Authorization: 'Bearer token-vencido' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('session_expired');
  });

  it('bloqueia usuário desativado', async () => {
    const res = await request(app).get('/api/v1/users/me').set(auth('inactive'));
    expect(res.status).toBe(403);
  });

  it('closer não acessa relatórios nem configurações', async () => {
    const q = '?from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z';
    expect((await request(app).get(`/api/v1/reports${q}`).set(auth('closer'))).status).toBe(403);
    expect((await request(app).patch('/api/v1/settings').set(auth('manager')).send({ closer_sees_all_leads: false })).status).toBe(403);
  });

  it('webhook de jobs exige segredo', async () => {
    expect((await request(app).post('/api/v1/jobs/run')).status).toBe(401);
  });
});

describe('CRUD de leads', () => {
  it('valida a entrada', async () => {
    const res = await request(app).post('/api/v1/leads').set(auth('admin')).send({ company_name: 'X' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('validation_error');
  });

  it('closer cria lead sempre para si, com porte calculado e CNPJ normalizado', async () => {
    installLead();
    fake.db.rpc.mockResolvedValueOnce({ data: LEAD_ID, error: null });
    const res = await request(app)
      .post('/api/v1/leads')
      .set(auth('closer'))
      .send({
        company_name: 'Clínica Sorriso',
        cnpj: '12.345.678/0001-90',
        estimated_monthly_revenue: 180000,
        owner_id: PROFILES.admin.id,
        contact: { name: 'Ana', phone: '(31) 99999-0000' },
      });
    expect(res.status).toBe(201);
    const [fn, args] = fake.db.rpc.mock.calls[0]!;
    expect(fn).toBe('save_lead');
    expect(args.p_lead).toMatchObject({ owner_id: PROFILES.closer.id, size: 'medium', cnpj: '12345678000190' });
    expect(args.p_contact).toMatchObject({ phone: '31999990000' });
  });

  it('lista com paginação', async () => {
    fake.handlers.leads_view = () => ({ data: [leadRow()], error: null, count: 1 });
    const res = await request(app).get('/api/v1/leads?page=1&page_size=20&status=pipeline').set(auth('manager'));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 1, page: 1, page_size: 20 });
  });

  it('PATCH não altera campos não enviados', async () => {
    installLead();
    fake.db.rpc.mockResolvedValueOnce({ data: LEAD_ID, error: null });
    await request(app).patch(`/api/v1/leads/${LEAD_ID}`).set(auth('closer')).send({ niche: 'Odontologia' }).expect(200);
    expect(fake.db.rpc.mock.calls[0]![1].p_lead).toEqual({ niche: 'Odontologia' });
  });

  it('somente gestão arquiva', async () => {
    installLead();
    const res = await request(app).patch(`/api/v1/leads/${LEAD_ID}`).set(auth('closer')).send({ archived: true });
    expect(res.status).toBe(403);
  });

  it('mapeia lead inexistente para 404', async () => {
    fake.handlers.leads = () => ({ data: null, error: null });
    const res = await request(app).patch(`/api/v1/leads/${LEAD_ID}/stage`).set(auth('admin')).send({ stage: 'approach' });
    expect(res.status).toBe(404);
  });

  it('erro do banco vira 500 padronizado sem vazar detalhes', async () => {
    fake.handlers.leads_view = () => ({ data: null, error: { code: '08006', message: 'connection failure' } });
    const res = await request(app).get('/api/v1/leads').set(auth('admin'));
    expect(res.status).toBe(500);
    expect(res.body.error).toMatchObject({ code: 'database_error' });
    expect(JSON.stringify(res.body)).not.toContain('connection failure');
  });
});

describe('movimentação no Kanban', () => {
  it('persiste a nova etapa com o autor da mudança', async () => {
    installLead();
    const res = await request(app).patch(`/api/v1/leads/${LEAD_ID}/stage`).set(auth('closer')).send({ stage: 'approach' });
    expect(res.status).toBe(200);
    const update = fake.calls.find((c) => c.table === 'leads' && fake.has(c.ops, 'update'));
    expect(fake.arg(update!.ops, 'update')![0]).toEqual({ stage_id: 's-approach', updated_by: PROFILES.closer.id });
  });

  it('closer não move lead de outro closer', async () => {
    installLead(leadRow({ owner_id: PROFILES.admin.id }));
    const res = await request(app).patch(`/api/v1/leads/${LEAD_ID}/stage`).set(auth('closer')).send({ stage: 'approach' });
    expect(res.status).toBe(403);
  });

  it('lead perdido precisa ser reativado antes de mover', async () => {
    installLead(leadRow({ status: 'lost' }));
    const res = await request(app).patch(`/api/v1/leads/${LEAD_ID}/stage`).set(auth('admin')).send({ stage: 'approach' });
    expect(res.status).toBe(409);
  });

  it('não permite arrastar direto para ganho sem registrar valores', async () => {
    const res = await request(app).patch(`/api/v1/leads/${LEAD_ID}/stage`).set(auth('admin')).send({ stage: 'won' });
    expect(res.status).toBe(422);
  });

  it('closer não redistribui leads', async () => {
    const res = await request(app).patch(`/api/v1/leads/${LEAD_ID}/owner`).set(auth('closer')).send({ owner_id: PROFILES.admin.id });
    expect(res.status).toBe(403);
  });
});

describe('fechamento e perda', () => {
  it('fecha como ganho via transação no banco e cria o cliente', async () => {
    installLead();
    fake.db.rpc.mockResolvedValueOnce({ data: 'client-1', error: null });
    const res = await request(app)
      .post(`/api/v1/leads/${LEAD_ID}/close`)
      .set(auth('closer'))
      .send({ closed_setup: 6500, closed_mrr: 1200, services: ['Automação com IA'] });
    expect(res.status).toBe(200);
    expect(res.body.client_id).toBe('client-1');
    expect(fake.db.rpc).toHaveBeenCalledWith('close_lead_won', expect.objectContaining({ p_lead: LEAD_ID, p_setup: 6500, p_mrr: 1200 }));
  });

  it('não fecha lead que já não está aberto', async () => {
    installLead();
    fake.db.rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'lead_not_open' } });
    const res = await request(app).post(`/api/v1/leads/${LEAD_ID}/close`).set(auth('admin')).send({ closed_setup: 1, closed_mrr: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Este lead não está mais em aberto');
  });

  it('exige motivo da perda', async () => {
    installLead();
    expect((await request(app).post(`/api/v1/leads/${LEAD_ID}/lose`).set(auth('admin')).send({})).status).toBe(422);
    const ok = await request(app).post(`/api/v1/leads/${LEAD_ID}/lose`).set(auth('admin')).send({ reason: 'Sem orçamento' });
    expect(ok.status).toBe(200);
    const update = fake.calls.find((c) => c.table === 'leads' && fake.has(c.ops, 'update'));
    expect(fake.arg(update!.ops, 'update')![0]).toMatchObject({ status: 'lost', lost_reason: 'Sem orçamento' });
  });
});

describe('follow-ups', () => {
  it('não cria cadência em negócio ganho', async () => {
    installLead(leadRow({ status: 'won' }));
    const res = await request(app)
      .post('/api/v1/followups/cadence')
      .set(auth('closer'))
      .send({ lead_id: LEAD_ID, anchor_at: '2026-10-14T15:00:00-03:00' });
    expect(res.status).toBe(409);
  });

  it('gera D+1, D+3, D+5 e D+8 com mensagens a partir do diagnóstico', async () => {
    fake.handlers.leads = (ops) =>
      fake.has(ops, 'single')
        ? {
            data: {
              company_name: 'Clínica Sorriso',
              owner: { full_name: 'Closer Teste' },
              lead_contacts: [{ name: 'Ana Lima', is_primary: true }],
              lead_diagnostics: [{ specific_pain: 'Demora no atendimento', proposed_solution: null, opening_hook: null, generated_at: '2026-10-01T00:00:00Z' }],
            },
            error: null,
          }
        : { data: leadRow(), error: null };
    let inserted: { step: string; message: string }[] = [];
    fake.handlers.followups = (ops) => {
      if (fake.has(ops, 'insert')) {
        inserted = fake.arg(ops, 'insert')![0] as typeof inserted;
        return { data: inserted.map((_, i) => ({ id: `f${i}` })), error: null };
      }
      return { data: [], error: null };
    };
    const res = await request(app)
      .post('/api/v1/followups/cadence')
      .set(auth('closer'))
      .send({ lead_id: LEAD_ID, anchor_at: '2026-10-14T15:00:00-03:00' });
    expect(res.status).toBe(201);
    expect(inserted.map((r) => r.step)).toEqual(['d1', 'd3', 'd5', 'd8']);
    expect(inserted[0]!.message).toContain('Ana');
    expect(inserted[1]!.message).toContain('demora no atendimento');
  });
});
