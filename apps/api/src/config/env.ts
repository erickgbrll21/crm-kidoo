import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  WEBHOOK_SECRET: z.string().min(24, 'WEBHOOK_SECRET deve ter ao menos 24 caracteres'),
  CRON_SECRET: z.string().min(24).optional(),
  ENABLE_SCHEDULER: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  APP_URL: z.url().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  WHATSAPP_BUSINESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  GOOGLE_CALENDAR_CLIENT_ID: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

const vercelHosts = [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
  .filter((host): host is string => !!host)
  .map((host) => (host.startsWith('http') ? host : `https://${host}`));

export const corsOrigins = [...new Set([...env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean), ...vercelHosts])];
