import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

/** Cliente administrativo (service_role). Nunca sai do servidor. */
export const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
