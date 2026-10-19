import { Router, type Request, type Response } from 'express';
import { settingsUpdate, type AppSettings } from '@kidoo/shared';
import { z } from 'zod';
import { env } from '../config/env.js';
import { authenticate, currentUser, requirePermission } from '../middlewares/auth.js';
import { HttpError } from '../utils/http.js';
import { runAlerts } from '../jobs/alerts.js';
import { leadsRouter, stagesRouter } from '../modules/leads/leads.routes.js';
import { activitiesRouter } from '../modules/activities/activities.routes.js';
import { followupsRouter } from '../modules/followups/followups.routes.js';
import { proposalsRouter } from '../modules/proposals/proposals.routes.js';
import { dashboardRouter, reportsRouter } from '../modules/dashboard/dashboard.routes.js';
import { usersRouter } from '../modules/users/users.routes.js';
import { clientsRouter, onboardingTasksRouter } from '../modules/clients/clients.routes.js';
import { integrationsRouter, webhooksRouter } from '../modules/integrations/integrations.routes.js';
import { googleCalendarCallback, googleCalendarRouter } from '../modules/integrations/google-calendar.routes.js';
import { listNotifications, markRead } from '../modules/notifications/notifications.service.js';
import { getSettings, updateSettings } from '../modules/settings/settings.service.js';
import { audit } from '../modules/audit/audit.service.js';

const notificationsRouter = Router()
  .get('/', async (req: Request, res: Response) => {
    res.json({ data: await listNotifications(currentUser(req).id) });
  })
  .post('/read-all', async (req: Request, res: Response) => {
    await markRead(currentUser(req).id);
    res.status(204).end();
  })
  .post('/:id/read', async (req: Request, res: Response) => {
    await markRead(currentUser(req).id, z.uuid().parse(req.params.id));
    res.status(204).end();
  });

const settingsRouter = Router()
  .get('/', async (_req: Request, res: Response) => {
    res.json(await getSettings());
  })
  .patch('/', requirePermission('settings.manage'), async (req: Request, res: Response) => {
    const input = settingsUpdate.parse(req.body) as Partial<AppSettings>;
    const settings = await updateSettings(input, currentUser(req).id);
    await audit(req, 'settings.update', 'app_settings', null, input);
    res.json(settings);
  });

const jobsRouter = Router().post('/run', async (req: Request, res: Response) => {
  if (!env.CRON_SECRET || req.header('x-cron-secret') !== env.CRON_SECRET) {
    throw new HttpError(401, 'unauthorized', 'Credencial inválida');
  }
  res.json({ result: await runAlerts() });
});

export const v1 = Router()
  .get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  })
  .use('/webhooks', webhooksRouter)
  .use('/jobs', jobsRouter)
  .get('/integrations/google/callback', googleCalendarCallback)
  .use(authenticate)
  .use('/integrations/google', googleCalendarRouter)
  .use('/leads', leadsRouter)
  .use('/stages', stagesRouter)
  .use('/activities', activitiesRouter)
  .use('/followups', followupsRouter)
  .use('/proposals', proposalsRouter)
  .use('/dashboard', dashboardRouter)
  .use('/reports', reportsRouter)
  .use('/users', usersRouter)
  .use('/clients', clientsRouter)
  .use('/onboarding-tasks', onboardingTasksRouter)
  .use('/notifications', notificationsRouter)
  .use('/settings', settingsRouter)
  .use('/integrations', integrationsRouter);
