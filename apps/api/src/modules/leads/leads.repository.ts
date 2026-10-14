import type { z } from 'zod';
import type { Lead, leadListQuery, Profile, StageKey } from '@kidoo/shared';
import { db } from '../../config/supabase.js';
import { dbError, must } from '../../utils/http.js';

type ListQuery = z.infer<typeof leadListQuery>;

const stageIds = new Map<string, string>();
export async function stageId(key: StageKey): Promise<string> {
  if (!stageIds.size) {
    const rows = must(await db.from('pipeline_stages').select('id, key'));
    rows.forEach((r) => stageIds.set(r.key, r.id));
  }
  const id = stageIds.get(key);
  if (!id) throw new Error(`Etapa desconhecida: ${key}`);
  return id;
}

export async function listStages() {
  return must(await db.from('pipeline_stages').select('id, key, name, position, is_won').order('position'));
}

export async function list(q: ListQuery, visibleOwner: string | null) {
  let query = db.from('leads_view').select('*', { count: 'exact' });
  if (!q.archived) query = query.is('archived_at', null);
  else query = query.not('archived_at', 'is', null);
  if (q.status === 'pipeline') query = query.in('status', ['open', 'won']);
  else if (q.status !== 'all') query = query.eq('status', q.status);
  if (visibleOwner) query = query.eq('owner_id', visibleOwner);
  if (q.owner_id) query = query.eq('owner_id', q.owner_id);
  if (q.stage) query = query.eq('stage_key', q.stage);
  if (q.niche) query = query.eq('niche', q.niche);
  if (q.priority) query = query.eq('priority', q.priority);
  if (q.search) {
    const s = q.search.replace(/[%,()]/g, ' ');
    query = query.or(`company_name.ilike.%${s}%,contact_name.ilike.%${s}%,niche.ilike.%${s}%`);
  }
  if (q.sort === 'value') query = query.order('estimated_mrr', { ascending: false, nullsFirst: false }).order('estimated_setup', { ascending: false, nullsFirst: false });
  // Mais tempo sem contato primeiro: quem nunca foi contatado aparece no topo.
  else if (q.sort === 'last_interaction') query = query.order('last_interaction_at', { ascending: true, nullsFirst: true });
  else query = query.order('created_at', { ascending: false });

  const from = (q.page - 1) * q.page_size;
  const { data, error, count } = await query.range(from, from + q.page_size - 1);
  if (error) throw dbError(error);
  return { data: data as Lead[], total: count ?? 0 };
}

export const findView = async (id: string) =>
  must(await db.from('leads_view').select('*').eq('id', id).maybeSingle<Lead>());

export const findRow = async (id: string) =>
  must(await db.from('leads').select('id, owner_id, status, stage_id, company_name').eq('id', id).maybeSingle<Pick<Lead, 'id' | 'owner_id' | 'status' | 'stage_id' | 'company_name'>>());

export async function save(actorId: string | null, id: string | null, lead: Record<string, unknown>, contact?: Record<string, unknown>) {
  return must(
    await db.rpc('save_lead', { p_actor: actorId, p_lead_id: id, p_lead: lead, p_contact: contact ?? null }),
  ) as string;
}

export async function update(id: string, patch: Record<string, unknown>) {
  must(await db.from('leads').update(patch).eq('id', id).select('id').single());
}

export async function details(id: string) {
  const [contacts, diagnostics, history, activities, followups, proposals] = await Promise.all([
    db.from('lead_contacts').select('*').eq('lead_id', id).order('is_primary', { ascending: false }),
    db.from('lead_diagnostics').select('*').eq('lead_id', id).order('generated_at', { ascending: false }),
    db
      .from('lead_stage_history')
      .select('*, from_stage:from_stage_id(name), to_stage:to_stage_id(name), actor:actor_id(full_name), from_owner:from_owner_id(full_name), to_owner:to_owner_id(full_name)')
      .eq('lead_id', id)
      .order('created_at', { ascending: false }),
    db.from('activities').select('*, owner:owner_id(full_name)').eq('lead_id', id).order('created_at', { ascending: false }).limit(200),
    db.from('followups').select('*').eq('lead_id', id).order('due_at'),
    db.from('proposals').select('*, owner:owner_id(full_name)').eq('lead_id', id).order('created_at', { ascending: false }),
  ]);
  return {
    contacts: must(contacts),
    diagnostics: must(diagnostics),
    history: must(history),
    activities: must(activities),
    followups: must(followups),
    proposals: must(proposals),
  };
}

/** Pré-filtro no banco; a decisão final é de findDuplicate (packages/shared). CNPJ e telefone são gravados só com dígitos. */
export async function dedupeCandidates(input: { company_name: string; email?: string | null; phone?: string | null; cnpj?: string | null }) {
  const clean = (v: string) => v.replace(/[%,()"]/g, '');
  const word = input.company_name.split(/\s+/).find((w) => w.length > 3) ?? input.company_name;
  const filters = [`company_name.ilike.%${clean(word)}%`];
  if (input.email) filters.push(`contact_email.ilike.${clean(input.email)}`);
  const cnpj = input.cnpj?.replace(/\D/g, '');
  if (cnpj) filters.push(`cnpj.eq.${cnpj}`);
  const phone = input.phone?.replace(/\D/g, '').slice(-10);
  if (phone && phone.length === 10) filters.push(`contact_phone.like.%${phone}`);
  const { data, error } = await db
    .from('leads_view')
    .select('id, company_name, cnpj, contact_email, contact_phone')
    .or(filters.join(','))
    .is('archived_at', null)
    .limit(200);
  if (error) throw dbError(error);
  return data;
}

export const ownerExists = async (id: string) =>
  !!(await db.from('profiles').select('id').eq('id', id).eq('is_active', true).maybeSingle<Pick<Profile, 'id'>>()).data;
