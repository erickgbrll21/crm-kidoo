import type { Request } from 'express';
import { db } from '../../config/supabase.js';
import { logger } from '../../config/logger.js';

/** Registra auditoria sem bloquear a operação principal se o log falhar. */
export async function audit(req: Request | null, action: string, entity: string, entityId: string | null, changes?: unknown) {
  const { error } = await db.from('audit_logs').insert({
    actor_id: req?.user?.id ?? null,
    action,
    entity,
    entity_id: entityId,
    changes: changes ?? null,
    ip: req?.ip ?? null,
  });
  if (error) logger.warn({ error, action, entity }, 'Falha ao gravar auditoria');
}
