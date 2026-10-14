/**
 * Seed de demonstração. Cria Pedro, Arthur e Erick no Auth e popula o CRM
 * com leads fictícios em todas as etapas. Não substitui a integração real.
 *
 *   npm run db:seed
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_PASSWORD ?? 'KidooHub!demo';
if (!url || !key) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const daysAgo = (d: number) => hoursAgo(d * 24);
const soon = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

const TEAM = [
  { email: 'pedro@kidoohub.com', full_name: 'Pedro', role: 'admin', title: 'CEO & Tecnologia' },
  { email: 'arthur@kidoohub.com', full_name: 'Arthur', role: 'manager', title: 'Aquisição & Tráfego' },
  { email: 'erick@kidoohub.com', full_name: 'Erick', role: 'closer', title: 'Infraestrutura & Produto' },
] as const;

async function upsertUser(u: (typeof TEAM)[number]) {
  const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
  const existing = list.users.find((x) => x.email === u.email);
  if (existing) {
    await db.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name },
      app_metadata: { role: u.role },
    });
    await db.from('profiles').update({ full_name: u.full_name, role: u.role, title: u.title, is_active: true }).eq('id', existing.id);
    return existing.id;
  }
  const { data, error } = await db.auth.admin.createUser({
    email: u.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: u.full_name },
    app_metadata: { role: u.role },
  });
  if (error || !data.user) throw error ?? new Error(`falha ao criar ${u.email}`);
  await db.from('profiles').update({ role: u.role, title: u.title, full_name: u.full_name }).eq('id', data.user.id);
  return data.user.id;
}

type DemoLead = {
  company_name: string;
  niche: string;
  source: string;
  stage: string;
  status?: 'open' | 'won' | 'lost';
  owner: 'pedro' | 'arthur' | 'erick';
  contact: { name: string; role: string; phone: string; email: string };
  revenue: number;
  setup: number;
  mrr: number;
  last?: number;
  next?: number;
  lost_reason?: string;
  closed_setup?: number;
  closed_mrr?: number;
  diagnostic?: { deep_niche: string; specific_pain: string; proposed_solution: string; opening_hook: string };
};

const LEADS: DemoLead[] = [
  {
    company_name: 'Clínica Vida Plena',
    niche: 'Clínica médica',
    source: 'antigravity',
    stage: 'enriched',
    owner: 'arthur',
    contact: { name: 'Mariana Alves', role: 'Diretora', phone: '31998881111', email: 'mariana@vidaplena.example' },
    revenue: 180000,
    setup: 6500,
    mrr: 1200,
    last: 6,
    diagnostic: {
      deep_niche: 'Clínica particular de especialidades com alta demanda de retorno',
      specific_pain: 'Demora no atendimento e no retorno de exames',
      proposed_solution: 'Automação de triagem e follow-up com IA',
      opening_hook: 'Vi que a Vida Plena cresce no retorno, mas a fila ainda come o dia da equipe.',
    },
  },
  {
    company_name: 'Sorriso & Cia Odontologia',
    niche: 'Clínica odontológica',
    source: 'antigravity',
    stage: 'approach',
    owner: 'pedro',
    contact: { name: 'Rafael Nunes', role: 'Sócio', phone: '31997772222', email: 'rafael@sorrisoecia.example' },
    revenue: 72000,
    setup: 4500,
    mrr: 900,
    last: 30,
    diagnostic: {
      deep_niche: 'Clínica odontológica de bairro com agenda de implantes',
      specific_pain: 'No-show alto nas consultas de avaliação',
      proposed_solution: 'Confirmação automática e recuperação de faltas',
      opening_hook: 'Cada avaliação que falta é um implante que não entra no mês.',
    },
  },
  {
    company_name: 'Desentupidora Minas Norte',
    niche: 'Desentupidora',
    source: 'make',
    stage: 'call_scheduled',
    owner: 'erick',
    contact: { name: 'Carla Mota', role: 'Gerente comercial', phone: '31996663333', email: 'carla@minasnorte.example' },
    revenue: 95000,
    setup: 3800,
    mrr: 800,
    last: 8,
    next: 6,
    diagnostic: {
      deep_niche: 'Atendimento emergencial 24h na RMBH',
      specific_pain: 'Leads do Google somem no WhatsApp da operação',
      proposed_solution: 'Central de disparo e qualificação automática',
      opening_hook: 'O Google traz o chamado; o WhatsApp ainda decide se vocês ganham ou perdem.',
    },
  },
  {
    company_name: 'Locar Fleet B2B',
    niche: 'Locadora B2B',
    source: 'inbound',
    stage: 'proposal_sent',
    owner: 'arthur',
    contact: { name: 'Thiago Reis', role: 'Head comercial', phone: '11995554444', email: 'thiago@locarfleet.example' },
    revenue: 420000,
    setup: 12000,
    mrr: 3500,
    last: 20,
    diagnostic: {
      deep_niche: 'Locação de utilitários para manutenção industrial',
      specific_pain: 'Proposta demora três dias e o concorrente fecha no mesmo dia',
      proposed_solution: 'CRM + gerador de proposta e assinatura',
      opening_hook: 'Três dias de proposta é tempo demais para quem precisa do veículo amanhã.',
    },
  },
  {
    company_name: 'Contábil Horizonte',
    niche: 'Escritório contábil',
    source: 'referral',
    stage: 'followup',
    owner: 'pedro',
    contact: { name: 'Patrícia Gomes', role: 'Sócia', phone: '31994445555', email: 'patricia@horizonte.example' },
    revenue: 140000,
    setup: 8000,
    mrr: 1800,
    last: 55,
    diagnostic: {
      deep_niche: 'Escritório com carteira de clínicas e prestadores',
      specific_pain: 'Onboarding de cliente novo ainda é planilha',
      proposed_solution: 'Portal de coleta e automação fiscal inicial',
      opening_hook: 'O cliente assina; a equipe ainda persegue documento por WhatsApp.',
    },
  },
  {
    company_name: 'Manutenção Alfa Predial',
    niche: 'Manutenção predial',
    source: 'outbound',
    stage: 'followup',
    owner: 'erick',
    contact: { name: 'Bruno Pires', role: 'Diretor', phone: '31993336666', email: 'bruno@alfapredial.example' },
    revenue: 260000,
    setup: 9000,
    mrr: 2200,
    last: 72,
    diagnostic: {
      deep_niche: 'Facilities para condomínios comerciais',
      specific_pain: 'Ordens de serviço se perdem entre o app e o WhatsApp do técnico',
      proposed_solution: 'App de OS + painel do síndico',
      opening_hook: 'O síndico cobra; o técnico já resolveu — e o sistema não sabe.',
    },
  },
  {
    company_name: 'Nexus Serviços Empresariais',
    niche: 'Serviços empresariais',
    source: 'antigravity',
    stage: 'won',
    status: 'won',
    owner: 'pedro',
    contact: { name: 'Helena Castro', role: 'CEO', phone: '11992227777', email: 'helena@nexus.example' },
    revenue: 580000,
    setup: 15000,
    mrr: 4800,
    last: 120,
    closed_setup: 14200,
    closed_mrr: 4500,
    diagnostic: {
      deep_niche: 'BPO de atendimento para indústrias médias',
      specific_pain: 'Handoff comercial-operação gera retrabalho',
      proposed_solution: 'CRM + onboarding e base de conhecimento com IA',
      opening_hook: 'O contrato fecha; a operação ainda reaprende o cliente.',
    },
  },
  {
    company_name: 'Odonto Prime Centro',
    niche: 'Clínica odontológica',
    source: 'manual',
    stage: 'enriched',
    status: 'lost',
    owner: 'arthur',
    contact: { name: 'Igor Santos', role: 'Sócio', phone: '31991118888', email: 'igor@odontoprime.example' },
    revenue: 48000,
    setup: 3200,
    mrr: 700,
    last: 200,
    lost_reason: 'Decidiu internamente “esperar o próximo trimestre”.',
  },
  {
    company_name: 'Clínica Cardio Sul',
    niche: 'Clínica médica',
    source: 'make',
    stage: 'approach',
    owner: 'erick',
    contact: { name: 'Ana Beatriz Lima', role: 'Administradora', phone: '31990009999', email: 'ana@cardiosul.example' },
    revenue: 310000,
    setup: 11000,
    mrr: 2600,
    last: 4,
    diagnostic: {
      deep_niche: 'Cardiologia com exames de imagem próprios',
      specific_pain: 'Laudos atrasam e o paciente liga cobrando',
      proposed_solution: 'Fila de laudo e aviso automático ao paciente',
      opening_hook: 'O exame já foi feito; o paciente ainda não sabe.',
    },
  },
  {
    company_name: 'Locação Serra Utilitários',
    niche: 'Locadora B2B',
    source: 'inbound',
    stage: 'call_scheduled',
    owner: 'pedro',
    contact: { name: 'Diego Faria', role: 'Comercial', phone: '31998880000', email: 'diego@serrautil.example' },
    revenue: 88000,
    setup: 5000,
    mrr: 1100,
    last: 12,
    next: 20,
  },
];

async function main() {
  const ids = {
    pedro: await upsertUser(TEAM[0]),
    arthur: await upsertUser(TEAM[1]),
    erick: await upsertUser(TEAM[2]),
  };
  const stages = Object.fromEntries(
    ((await db.from('pipeline_stages').select('id, key')).data ?? []).map((s) => [s.key, s.id]),
  ) as Record<string, string>;

  const { data: existing } = await db.from('leads').select('company_name');
  const have = new Set((existing ?? []).map((l) => l.company_name));

  for (const L of LEADS) {
    if (have.has(L.company_name)) continue;
    const owner_id = ids[L.owner];
    const won = L.status === 'won';
    const lost = L.status === 'lost';
    const { data: lead, error } = await db
      .from('leads')
      .insert({
        company_name: L.company_name,
        niche: L.niche,
        source: L.source,
        stage_id: stages[won ? 'won' : L.stage],
        status: L.status ?? 'open',
        owner_id,
        estimated_monthly_revenue: L.revenue,
        size: L.revenue <= 50_000 ? 'micro' : L.revenue <= 100_000 ? 'small' : L.revenue <= 300_000 ? 'medium' : L.revenue <= 500_000 ? 'large' : 'enterprise',
        estimated_setup: L.setup,
        estimated_mrr: L.mrr,
        last_interaction_at: L.last ? hoursAgo(L.last) : null,
        lost_reason: L.lost_reason ?? null,
        lost_at: lost ? daysAgo(14) : null,
        won_at: won ? daysAgo(10) : null,
        closed_setup: L.closed_setup ?? null,
        closed_mrr: L.closed_mrr ?? null,
        created_by: owner_id,
      })
      .select('id')
      .single();
    if (error || !lead) throw error ?? new Error(L.company_name);

    await db.from('lead_contacts').insert({ lead_id: lead.id, ...L.contact, is_primary: true });
    if (L.diagnostic) {
      await db.from('lead_diagnostics').insert({
        lead_id: lead.id,
        ...L.diagnostic,
        suggested_setup: L.setup,
        suggested_mrr: L.mrr,
        source: L.source,
        is_ai_generated: L.source === 'antigravity' || L.source === 'make',
      });
    }

    if (L.stage === 'call_scheduled' && L.next) {
      await db.from('activities').insert({
        lead_id: lead.id,
        owner_id,
        type: 'meeting',
        title: `Call 15 min · ${L.company_name}`,
        due_at: soon(L.next),
        status: 'pending',
        priority: 'high',
      });
    }
    if (L.stage === 'followup') {
      await db.from('followups').insert({
        lead_id: lead.id,
        owner_id,
        step: 'd3',
        title: 'D+3 · Reforço de valor',
        message: `Olá, ${L.contact.name.split(' ')[0]}! Queria retomar o impacto do que conversamos na ${L.company_name}.`,
        due_at: L.last && L.last > 48 ? hoursAgo(10) : soon(24),
        status: 'pending',
      });
    }
    if (L.stage === 'proposal_sent') {
      await db.from('proposals').insert({
        lead_id: lead.id,
        owner_id,
        title: `Proposta Kidoo · ${L.company_name}`,
        services: ['Automação comercial', 'Site institucional'],
        setup_value: L.setup,
        mrr_value: L.mrr,
        valid_until: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10),
        status: 'sent',
        sent_at: daysAgo(3),
      });
    }
    if (won) {
      const { data: client } = await db
        .from('clients')
        .insert({
          lead_id: lead.id,
          company_name: L.company_name,
          setup_value: L.closed_setup,
          mrr_value: L.closed_mrr,
          services: ['CRM', 'Automações', 'Tráfego'],
          start_date: new Date().toISOString().slice(0, 10),
          tech_owner_id: ids.erick,
          onboarding_stage: 'kickoff_pending',
          contract_ref: 'KID-2026-014',
        })
        .select('id')
        .single();
      if (client) {
        await db.from('onboarding_tasks').insert([
          { client_id: client.id, stage: 'contract_confirmed', title: 'Contrato assinado arquivado', status: 'done', position: 1, completed_at: daysAgo(8) },
          { client_id: client.id, stage: 'kickoff_pending', title: 'Agendar kickoff com o cliente', status: 'todo', position: 2, owner_id: ids.erick },
          { client_id: client.id, stage: 'info_collection', title: 'Coletar acessos e briefing', status: 'todo', position: 3, owner_id: ids.erick },
        ]);
      }
    }
  }

  console.log(`Seed ok. Login: pedro@kidoohub.com / arthur@kidoohub.com / erick@kidoohub.com`);
  console.log(`Senha de demonstração: ${password}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
