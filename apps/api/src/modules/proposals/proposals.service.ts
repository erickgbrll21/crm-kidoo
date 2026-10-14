import type { z } from 'zod';
import { can, canEditLead, canViewLead, type Profile, type ProposalCreateInput, type proposalListQuery, type proposalUpdate } from '@kidoo/shared';
import { randomUUID } from 'node:crypto';
import { db } from '../../config/supabase.js';
import { dbError, forbidden, HttpError, must, notFound } from '../../utils/http.js';
import { findRow } from '../leads/leads.repository.js';
import { getSettings } from '../settings/settings.service.js';

type User = Pick<Profile, 'id' | 'role'>;
const SELECT = '*, lead:lead_id(id, company_name, owner_id)';
const BUCKET = 'proposals';

const statusDates = (status?: string) => ({
  ...(status === 'sent' && { sent_at: new Date().toISOString() }),
  ...((status === 'accepted' || status === 'rejected') && { decided_at: new Date().toISOString() }),
});

export async function listProposals(user: User, q: z.infer<typeof proposalListQuery>) {
  let query = db.from('proposals').select(SELECT, { count: 'exact' });
  const { closer_sees_all_leads } = await getSettings();
  if (!can(user.role, 'leads.write_any') && !closer_sees_all_leads) query = query.eq('owner_id', user.id);
  if (q.owner_id) query = query.eq('owner_id', q.owner_id);
  if (q.lead_id) query = query.eq('lead_id', q.lead_id);
  if (q.status !== 'all') query = query.eq('status', q.status);
  const from = (q.page - 1) * q.page_size;
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, from + q.page_size - 1);
  if (error) throw dbError(error);
  return { data, total: count ?? 0, page: q.page, page_size: q.page_size };
}

export async function createProposal(user: User, input: ProposalCreateInput) {
  const lead = await findRow(input.lead_id);
  if (!canEditLead(user, lead)) throw forbidden('Você só pode criar propostas nos seus leads');
  return must(
    await db
      .from('proposals')
      .insert({ ...input, owner_id: lead.owner_id ?? user.id, ...statusDates(input.status) })
      .select(SELECT)
      .single(),
  );
}

async function loadEditable(user: User, id: string) {
  const p = must(await db.from('proposals').select('id, lead_id, owner_id, status, document_path').eq('id', id).maybeSingle());
  const lead = await findRow(p.lead_id);
  if (!canEditLead(user, lead)) throw forbidden();
  return p;
}

export async function updateProposal(user: User, id: string, input: z.infer<typeof proposalUpdate>) {
  const p = await loadEditable(user, id);
  const dates = input.status && input.status !== p.status ? statusDates(input.status) : {};
  return must(await db.from('proposals').update({ ...input, ...dates }).eq('id', id).select(SELECT).single());
}

const ALLOWED = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
]);

export async function attachDocument(user: User, id: string, file: Express.Multer.File | undefined) {
  if (!file) throw new HttpError(422, 'validation_error', 'Envie um arquivo');
  if (!ALLOWED.has(file.mimetype)) throw new HttpError(422, 'validation_error', 'Formato não permitido (PDF, DOCX, PPTX, PNG ou JPG)');
  const p = await loadEditable(user, id);
  const safeName = file.originalname.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-120);
  const path = `${p.lead_id}/${id}/${randomUUID()}-${safeName}`;
  const up = await db.storage.from(BUCKET).upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
  if (up.error) throw new HttpError(502, 'storage_error', 'Falha ao enviar o documento');
  const row = must(
    await db.from('proposals').update({ document_path: path, document_name: file.originalname }).eq('id', id).select(SELECT).single(),
  );
  if (p.document_path) await db.storage.from(BUCKET).remove([p.document_path]);
  return row;
}

/** URL assinada de curta duração, emitida somente para quem pode ver o lead. */
export async function documentUrl(user: User, id: string) {
  const p = must(await db.from('proposals').select('lead_id, document_path').eq('id', id).maybeSingle());
  const [lead, settings] = await Promise.all([findRow(p.lead_id), getSettings()]);
  if (!canViewLead(user, lead, settings.closer_sees_all_leads)) throw notFound('Proposta');
  if (!p.document_path) throw notFound('Documento');
  const signed = await db.storage.from(BUCKET).createSignedUrl(p.document_path, 300);
  if (signed.error) throw new HttpError(502, 'storage_error', 'Não foi possível gerar o link do documento');
  return signed.data.signedUrl;
}
