import { beforeEach, vi } from 'vitest';
import { fake } from './fake-instance.js';
import { PROFILES } from './fake-db.js';

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-for-tests-only';
process.env.WEBHOOK_SECRET = 'test-webhook-secret-0123456789';
process.env.ENABLE_SCHEDULER = 'false';

vi.mock('../src/config/supabase.js', async () => ({ db: (await import('./fake-instance.js')).fake.db }));

export const STAGES = [
  { id: 's-enriched', key: 'enriched', name: 'Leads Enriquecidos', position: 1, is_won: false },
  { id: 's-approach', key: 'approach', name: 'Abordagem C-Level', position: 2, is_won: false },
  { id: 's-call', key: 'call_scheduled', name: 'Call 15 Min Agendada', position: 3, is_won: false },
  { id: 's-proposal', key: 'proposal_sent', name: 'Proposta Enviada', position: 4, is_won: false },
  { id: 's-followup', key: 'followup', name: 'Follow-up Ativo', position: 5, is_won: false },
  { id: 's-won', key: 'won', name: 'Fechado / Ganho', position: 6, is_won: true },
];

/** Handlers padrão: autenticação por token = papel, configurações padrão e etapas. */
export function installDefaults() {
  fake.db.auth.getUser.mockImplementation(async (token: string) => {
    const p = PROFILES[token as keyof typeof PROFILES];
    return p ? { data: { user: { id: p.id } }, error: null } : { data: { user: null }, error: { message: 'expired' } };
  });
  fake.handlers.profiles = (ops) => {
    const roles = ops.find(([m, a]) => m === 'in' && a[0] === 'role')?.[1][1] as string[] | undefined;
    if (roles) return { data: Object.values(PROFILES).filter((p) => roles.includes(p.role) && p.is_active), error: null };
    const id = ops.find(([m, a]) => m === 'eq' && a[0] === 'id')?.[1][1];
    const p = Object.values(PROFILES).find((x) => x.id === id) ?? null;
    return { data: p, error: null };
  };
  fake.handlers.app_settings = () => ({ data: [], error: null });
  fake.handlers.pipeline_stages = () => ({ data: STAGES, error: null });
  fake.handlers.audit_logs = () => ({ data: null, error: null });
  fake.handlers.notifications = () => ({ data: [], error: null });
}

beforeEach(() => {
  fake.reset();
  installDefaults();
});
