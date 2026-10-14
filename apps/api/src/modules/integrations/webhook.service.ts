import { classifySize, digits, findDuplicate, type AntigravityPayload } from '@kidoo/shared';
import { db } from '../../config/supabase.js';
import { logger } from '../../config/logger.js';
import { dbError, HttpError, must } from '../../utils/http.js';
import { dedupeCandidates } from '../leads/leads.repository.js';
import { getSettings } from '../settings/settings.service.js';

export type IngestResult =
  | { status: 'duplicate'; event_id: string; lead_id: string | null }
  | { status: 'created' | 'updated'; event_id: string; lead_id: string; matched_by: string | null };

/**
 * 1) registra o evento (unique source+event_id garante idempotência),
 * 2) procura duplicidade, 3) cria/atualiza lead + diagnóstico numa transação no banco.
 */
export async function ingestLeadEvent(p: AntigravityPayload): Promise<IngestResult> {
  let eventRowId: string;
  const inserted = await db
    .from('integration_events')
    .insert({ source: p.source, event_id: p.event_id, event_type: p.event_type, payload: p })
    .select('id')
    .single();

  if (inserted.error?.code === '23505') {
    const existing = must(
      await db.from('integration_events').select('id, status, lead_id').eq('source', p.source).eq('event_id', p.event_id).single(),
    );
    // Eventos que falharam podem ser reenviados; os demais são ignorados.
    if (existing.status !== 'failed') return { status: 'duplicate', event_id: p.event_id, lead_id: existing.lead_id };
    eventRowId = existing.id;
  } else if (inserted.error) {
    throw dbError(inserted.error);
  } else {
    eventRowId = inserted.data.id;
  }

  try {
    const settings = await getSettings();
    const match = findDuplicate(
      { company_name: p.company.name, cnpj: p.company.cnpj, email: p.contact?.email, phone: p.contact?.phone },
      await dedupeCandidates({ company_name: p.company.name, cnpj: p.company.cnpj, email: p.contact?.email, phone: p.contact?.phone }),
    );
    const lead = {
      company_name: p.company.name,
      cnpj: p.company.cnpj ? digits(p.company.cnpj) || null : null,
      website: p.company.website ?? null,
      niche: p.company.industry ?? null,
      estimated_monthly_revenue: p.company.estimated_monthly_revenue ?? null,
      size: classifySize(p.company.estimated_monthly_revenue, settings.size_ranges),
      source: p.source,
      estimated_setup: p.diagnostic?.suggested_setup ?? null,
      estimated_mrr: p.diagnostic?.suggested_mrr ?? null,
    };
    const contact = p.contact && {
      name: p.contact.name,
      role: p.contact.role ?? null,
      phone: p.contact.phone ? digits(p.contact.phone) : null,
      email: p.contact.email?.toLowerCase() ?? null,
    };
    const leadId = must(
      await db.rpc('ingest_lead_event', {
        p_event: eventRowId,
        p_existing_lead: match?.id ?? null,
        p_lead: lead,
        p_contact: contact ?? null,
        p_diagnostic: p.diagnostic ? { ...p.diagnostic, source: p.source } : null,
        p_match: match?.by ?? null,
      }),
    ) as string;
    logger.info({ event_id: p.event_id, lead_id: leadId, matched_by: match?.by }, 'Lead recebido por integração');
    return { status: match ? 'updated' : 'created', event_id: p.event_id, lead_id: leadId, matched_by: match?.by ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.from('integration_events').update({ status: 'failed', error: message.slice(0, 1000) }).eq('id', eventRowId);
    logger.error({ err, event_id: p.event_id }, 'Falha ao processar evento de integração');
    throw err instanceof HttpError ? err : new HttpError(500, 'ingest_failed', 'Falha ao processar o evento');
  }
}
