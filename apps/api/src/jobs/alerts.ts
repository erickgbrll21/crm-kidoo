import { stagnationLevel } from '@kidoo/shared';
import { db } from '../config/supabase.js';
import { logger } from '../config/logger.js';
import { must } from '../utils/http.js';
import { notify, type NewNotification } from '../modules/notifications/notifications.service.js';
import { getSettings } from '../modules/settings/settings.service.js';

const day = (d = new Date()) => d.toISOString().slice(0, 10);

export async function stagnantLeads(now = new Date()): Promise<NewNotification[]> {
  const { stagnation } = await getSettings();
  const leads = must(
    await db
      .from('leads_view')
      .select('id, company_name, owner_id, status, created_at, last_interaction_at, next_activity_at')
      .eq('status', 'open')
      .is('archived_at', null)
      .not('owner_id', 'is', null),
  );
  return leads
    .filter((l) => stagnationLevel(l, stagnation, now).level === 'cold')
    .map((l) => ({
      user_id: l.owner_id,
      type: 'lead_stagnant',
      title: `Lead esfriando: ${l.company_name}`,
      body: `Mais de ${stagnation.cold_hours}h sem interação comercial`,
      lead_id: l.id,
      link: `/pipeline?lead=${l.id}`,
      dedupe_key: `lead_stagnant:${l.id}:${day(now)}`,
    }));
}

export async function overdueFollowups(now = new Date()): Promise<NewNotification[]> {
  const rows = must(
    await db
      .from('followups')
      .select('id, title, owner_id, lead_id, lead:lead_id!inner(company_name, status)')
      .eq('status', 'pending')
      .lt('due_at', now.toISOString())
      .eq('lead.status', 'open')
      .limit(500),
  ) as unknown as { id: string; title: string; owner_id: string; lead_id: string; lead: { company_name: string } }[];
  return rows.map((f) => ({
    user_id: f.owner_id,
    type: 'followup_overdue',
    title: `Follow-up vencido: ${f.lead.company_name}`,
    body: f.title,
    lead_id: f.lead_id,
    link: '/follow-ups?view=overdue',
    dedupe_key: `followup_overdue:${f.id}`,
  }));
}

export async function upcomingMeetings(now = new Date()): Promise<NewNotification[]> {
  const rows = must(
    await db
      .from('activities')
      .select('id, title, owner_id, lead_id, due_at')
      .eq('type', 'meeting')
      .eq('status', 'pending')
      .gte('due_at', now.toISOString())
      .lte('due_at', new Date(now.getTime() + 60 * 60_000).toISOString()),
  );
  return rows.map((a) => ({
    user_id: a.owner_id,
    type: 'meeting_soon',
    title: `Reunião em breve: ${a.title}`,
    body: `Começa às ${new Date(a.due_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    lead_id: a.lead_id,
    link: '/agenda?view=today',
    dedupe_key: `meeting_soon:${a.id}`,
  }));
}

export async function expiringProposals(now = new Date()): Promise<NewNotification[]> {
  const { proposal_expiry_warning_days } = await getSettings();
  // Propostas vencidas mudam de status automaticamente.
  must(
    await db
      .from('proposals')
      .update({ status: 'expired' })
      .in('status', ['sent', 'negotiating'])
      .lt('valid_until', day(now))
      .select('id'),
  );
  const limit = new Date(now.getTime() + proposal_expiry_warning_days * 86_400_000);
  const rows = must(
    await db
      .from('proposals')
      .select('id, title, owner_id, lead_id, valid_until')
      .in('status', ['sent', 'negotiating'])
      .gte('valid_until', day(now))
      .lte('valid_until', day(limit)),
  );
  return rows.map((p) => ({
    user_id: p.owner_id,
    type: 'proposal_expiring',
    title: `Proposta vence em breve: ${p.title}`,
    body: `Validade até ${new Date(`${p.valid_until}T12:00:00`).toLocaleDateString('pt-BR')}`,
    lead_id: p.lead_id,
    link: '/propostas',
    dedupe_key: `proposal_expiring:${p.id}`,
  }));
}

/** Executa todas as verificações; falha em uma não impede as demais. */
export async function runAlerts(now = new Date()) {
  const checks = { stagnantLeads, overdueFollowups, upcomingMeetings, expiringProposals };
  const result: Record<string, number> = {};
  for (const [name, check] of Object.entries(checks)) {
    try {
      result[name] = await notify(await check(now));
    } catch (err) {
      logger.error({ err, check: name }, 'Falha em verificação agendada');
      result[name] = -1;
    }
  }
  logger.info({ result }, 'Verificações agendadas concluídas');
  return result;
}
