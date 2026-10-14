import { Router, type Request, type RequestHandler, type Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { antigravityWebhook } from '@kidoo/shared';
import { env } from '../../config/env.js';
import { db } from '../../config/supabase.js';
import { requirePermission } from '../../middlewares/auth.js';
import { HttpError, must } from '../../utils/http.js';
import { ingestLeadEvent } from './webhook.service.js';

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export const requireWebhookSecret: RequestHandler = (req, _res, next) => {
  const provided = req.header('x-webhook-secret') ?? req.header('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!safeEqual(provided, env.WEBHOOK_SECRET)) throw new HttpError(401, 'invalid_signature', 'Credencial do webhook inválida');
  next();
};

/** Rotas públicas (autenticadas por segredo compartilhado). */
export const webhooksRouter = Router().post('/antigravity', requireWebhookSecret, async (req: Request, res: Response) => {
  const result = await ingestLeadEvent(antigravityWebhook.parse(req.body));
  res.status(result.status === 'created' ? 201 : 200).json(result);
});

/** Rotas autenticadas do painel de integrações. */
export const integrationsRouter = Router()
  .use(requirePermission('integrations.view'))
  .get('/events', async (_req: Request, res: Response) => {
    const data = must(
      await db
        .from('integration_events')
        .select('id, source, event_id, event_type, status, error, lead_id, dedupe_match, created_at, processed_at')
        .order('created_at', { ascending: false })
        .limit(100),
    );
    res.json({ data });
  })
  .get('/status', (_req: Request, res: Response) => {
    res.json({
      antigravity_webhook: { configured: true, endpoint: '/api/v1/webhooks/antigravity' },
      wa_me_links: { configured: true },
      whatsapp_business: { configured: !!(env.WHATSAPP_BUSINESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID) },
      google_calendar: { configured: !!env.GOOGLE_CALENDAR_CLIENT_ID },
    });
  });
