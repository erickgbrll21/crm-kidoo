import type { z } from 'zod';
import {
  ACTIVITY_LABEL,
  can,
  canEditLead,
  canViewLead,
  classifySize,
  digits,
  type ActivityType,
  type CloseLeadInput,
  type LeadCreateInput,
  type LeadUpdateInput,
  type leadListQuery,
  type Profile,
  type StageKey,
  type TimelineItem,
} from '@kidoo/shared';
import { db } from '../../config/supabase.js';
import { forbidden, HttpError, must, notFound } from '../../utils/http.js';
import { getSettings } from '../settings/settings.service.js';
import { adminIds, notify } from '../notifications/notifications.service.js';
import * as repo from './leads.repository.js';

type User = Pick<Profile, 'id' | 'role' | 'full_name'>;

export async function listLeads(user: User, q: z.infer<typeof leadListQuery>) {
  const settings = await getSettings();
  const visibleOwner = can(user.role, 'leads.write_any') || settings.closer_sees_all_leads ? null : user.id;
  const result = await repo.list(q, visibleOwner);
  return { ...result, page: q.page, page_size: q.page_size };
}

async function loadVisible(user: User, id: string) {
  const [lead, settings] = await Promise.all([repo.findView(id), getSettings()]);
  if (!canViewLead(user, lead, settings.closer_sees_all_leads)) throw notFound('Lead');
  return lead;
}

async function loadEditable(user: User, id: string) {
  const row = await repo.findRow(id);
  if (!canEditLead(user, row)) throw forbidden('Somente o closer responsável, um gestor ou um administrador pode alterar este lead');
  return row;
}

const normalizeContact = (c?: { phone?: string | null; email?: string | null } & Record<string, unknown>) =>
  c && {
    ...c,
    ...(c.phone !== undefined && { phone: c.phone ? digits(c.phone) : null }),
    ...(c.email !== undefined && { email: c.email?.toLowerCase() ?? null }),
  };

export async function getLead(user: User, id: string) {
  const lead = await loadVisible(user, id);
  const d = await repo.details(id);
  return { lead, ...d, timeline: buildTimeline(d) };
}

export async function createLead(user: User, input: LeadCreateInput) {
  const settings = await getSettings();
  // Closers só criam leads para si; gestores e admins podem atribuir.
  const owner = can(user.role, 'leads.assign') ? (input.owner_id ?? user.id) : user.id;
  if (owner !== user.id && !(await repo.ownerExists(owner))) throw new HttpError(422, 'invalid_owner', 'Responsável inválido');
  const { contact, owner_id: _ignored, ...fields } = input;
  const id = await repo.save(
    user.id,
    null,
    {
      ...fields,
      cnpj: fields.cnpj ? digits(fields.cnpj) : null,
      size: classifySize(fields.estimated_monthly_revenue, settings.size_ranges),
      owner_id: owner,
    },
    normalizeContact(contact),
  );
  if (owner !== user.id) await notifyAssigned(owner, id, fields.company_name, user.full_name);
  return repo.findView(id);
}

export async function updateLead(user: User, id: string, input: LeadUpdateInput) {
  await loadEditable(user, id);
  const { contact, archived, ...fields } = input;
  const patch: Record<string, unknown> = { ...fields };
  if (fields.cnpj !== undefined) patch.cnpj = fields.cnpj ? digits(fields.cnpj) : null;
  if (fields.estimated_monthly_revenue !== undefined) {
    patch.size = classifySize(fields.estimated_monthly_revenue, (await getSettings()).size_ranges);
  }
  if (archived !== undefined) {
    if (!can(user.role, 'leads.archive')) throw forbidden('Somente gestores e administradores podem arquivar leads');
    patch.archived_at = archived ? new Date().toISOString() : null;
  }
  await repo.save(user.id, id, patch, normalizeContact(contact));
  return repo.findView(id);
}

export async function moveStage(user: User, id: string, stage: StageKey) {
  const row = await loadEditable(user, id);
  if (row.status !== 'open') throw new HttpError(409, 'conflict', 'Reative o lead antes de movê-lo no pipeline');
  await repo.update(id, { stage_id: await repo.stageId(stage), updated_by: user.id });
  return repo.findView(id);
}

export async function changeOwner(user: User, id: string, ownerId: string) {
  if (!can(user.role, 'leads.assign')) throw forbidden('Somente gestores e administradores podem redistribuir leads');
  const row = await repo.findRow(id);
  if (!(await repo.ownerExists(ownerId))) throw new HttpError(422, 'invalid_owner', 'Responsável inválido ou inativo');
  await repo.update(id, { owner_id: ownerId, updated_by: user.id });
  if (ownerId !== user.id) await notifyAssigned(ownerId, id, row.company_name, user.full_name);
  return repo.findView(id);
}

export async function closeLead(user: User, id: string, input: CloseLeadInput) {
  const row = await loadEditable(user, id);
  const clientId = must(
    await db.rpc('close_lead_won', {
      p_actor: user.id,
      p_lead: id,
      p_setup: input.closed_setup,
      p_mrr: input.closed_mrr,
      p_services: input.services,
      p_contract_ref: input.contract_ref ?? null,
      p_start_date: input.start_date ?? null,
      p_tech_owner: input.tech_owner_id ?? null,
    }),
  ) as string;
  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const recipients = new Set([...(await adminIds()), ...(input.tech_owner_id ? [input.tech_owner_id] : [])]);
  recipients.delete(user.id);
  await notify(
    [...recipients].map((uid) => ({
      user_id: uid,
      type: 'deal_won',
      title: `Negócio ganho: ${row.company_name}`,
      body: `${user.full_name} fechou Setup ${brl(input.closed_setup)} + MRR ${brl(input.closed_mrr)}`,
      lead_id: id,
      link: `/clientes?client=${clientId}`,
      dedupe_key: `deal_won:${id}:${uid}`,
    })),
  );
  return { lead: await repo.findView(id), client_id: clientId };
}

export async function loseLead(user: User, id: string, reason: string) {
  const row = await loadEditable(user, id);
  if (row.status !== 'open') throw new HttpError(409, 'conflict', 'Este lead não está em aberto');
  await repo.update(id, { status: 'lost', lost_at: new Date().toISOString(), lost_reason: reason, updated_by: user.id });
  return repo.findView(id);
}

export async function reactivateLead(user: User, id: string, stage: StageKey) {
  const row = await loadEditable(user, id);
  if (row.status !== 'lost') throw new HttpError(409, 'conflict', 'Somente leads perdidos podem ser reativados');
  await repo.update(id, {
    status: 'open',
    stage_id: await repo.stageId(stage),
    lost_at: null,
    lost_reason: null,
    updated_by: user.id,
  });
  return repo.findView(id);
}

async function notifyAssigned(ownerId: string, leadId: string, company: string, by: string) {
  await notify([
    {
      user_id: ownerId,
      type: 'lead_assigned',
      title: `Novo lead atribuído: ${company}`,
      body: `Atribuído por ${by}`,
      lead_id: leadId,
      link: `/pipeline?lead=${leadId}`,
      dedupe_key: `lead_assigned:${leadId}:${ownerId}:${new Date().toISOString().slice(0, 16)}`,
    },
  ]);
}

type Details = Awaited<ReturnType<typeof repo.details>>;
type Named = { full_name: string } | null;
type HistoryRow = {
  id: string;
  event: string;
  created_at: string;
  note: string | null;
  from_stage: { name: string } | null;
  to_stage: { name: string } | null;
  actor: Named;
  from_owner: Named;
  to_owner: Named;
};

export function buildTimeline(d: Pick<Details, 'history' | 'activities' | 'followups' | 'proposals'>): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const h of d.history as HistoryRow[]) {
    const actor = h.actor?.full_name ?? (h.event === 'created' ? 'Integração' : null);
    const map: Record<string, [string, string | null]> = {
      created: ['Lead criado', h.to_stage ? `Entrou em ${h.to_stage.name}` : null],
      stage_changed: ['Movido no pipeline', `${h.from_stage?.name ?? '—'} → ${h.to_stage?.name ?? '—'}`],
      owner_changed: ['Responsável alterado', `${h.from_owner?.full_name ?? 'Sem responsável'} → ${h.to_owner?.full_name ?? 'Sem responsável'}`],
      won: ['Negócio ganho', null],
      lost: ['Marcado como perdido', h.note],
      reactivated: ['Lead reativado', h.to_stage ? `Voltou para ${h.to_stage.name}` : null],
    };
    const [title, detail] = map[h.event] ?? [h.event, null];
    items.push({ id: `h-${h.id}`, kind: h.event as TimelineItem['kind'], at: h.created_at, title, detail, actor_name: actor });
  }
  for (const a of d.activities as { id: string; type: ActivityType; title: string; status: string; completed_at: string | null; created_at: string; outcome: string | null; description: string | null; owner: Named }[]) {
    if (a.status === 'canceled') continue;
    const label = ACTIVITY_LABEL[a.type];
    items.push({
      id: `a-${a.id}`,
      kind: 'activity',
      at: a.completed_at ?? a.created_at,
      title: a.status === 'done' ? `${label}: ${a.title}` : `${label} agendada: ${a.title}`,
      detail: a.outcome ?? a.description,
      actor_name: a.owner?.full_name ?? null,
    });
  }
  for (const p of d.proposals as { id: string; title: string; status: string; created_at: string; owner: Named }[]) {
    items.push({ id: `p-${p.id}`, kind: 'proposal', at: p.created_at, title: `Proposta: ${p.title}`, detail: null, actor_name: p.owner?.full_name ?? null });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}
