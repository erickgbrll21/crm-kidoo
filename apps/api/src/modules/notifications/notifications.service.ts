import { db } from '../../config/supabase.js';
import { logger } from '../../config/logger.js';
import { must } from '../../utils/http.js';

export interface NewNotification {
  user_id: string;
  type: string;
  title: string;
  body?: string | null;
  lead_id?: string | null;
  link?: string | null;
  /** Mesma chave = mesma notificação; evita duplicatas entre execuções do job. */
  dedupe_key?: string;
}

export async function notify(items: NewNotification[]) {
  if (!items.length) return 0;
  const { data, error } = await db
    .from('notifications')
    .upsert(items, { onConflict: 'dedupe_key', ignoreDuplicates: true })
    .select('id');
  if (error) {
    logger.warn({ error }, 'Falha ao criar notificações');
    return 0;
  }
  return data.length;
}

export async function listNotifications(userId: string) {
  return must(
    await db.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
  );
}

export async function markRead(userId: string, id?: string) {
  let q = db.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null);
  if (id) q = q.eq('id', id);
  must(await q.select('id'));
}

export async function adminIds() {
  const rows = must(await db.from('profiles').select('id').in('role', ['admin', 'manager']).eq('is_active', true));
  return rows.map((r) => r.id as string);
}
