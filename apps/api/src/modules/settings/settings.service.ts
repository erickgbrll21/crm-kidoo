import { type AppSettings, withDefaults } from '@kidoo/shared';
import { db } from '../../config/supabase.js';
import { must } from '../../utils/http.js';

let cached: { value: AppSettings; until: number } | null = null;

export async function getSettings(): Promise<AppSettings> {
  if (cached && cached.until > Date.now()) return cached.value;
  const rows = must(await db.from('app_settings').select('key, value'));
  const value = withDefaults(Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<AppSettings>);
  cached = { value, until: Date.now() + 30_000 };
  return value;
}

export async function updateSettings(patch: Partial<AppSettings>, actorId: string) {
  const rows = Object.entries(patch).map(([key, value]) => ({
    key,
    value,
    updated_by: actorId,
    updated_at: new Date().toISOString(),
  }));
  if (rows.length) must(await db.from('app_settings').upsert(rows).select('key'));
  cached = null;
  return getSettings();
}
