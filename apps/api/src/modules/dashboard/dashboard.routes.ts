import { Router, type Request, type Response } from 'express';
import { dashboardQuery } from '@kidoo/shared';
import { currentUser, requirePermission } from '../../middlewares/auth.js';
import * as service from './dashboard.service.js';

const handler =
  (fn: (user: ReturnType<typeof currentUser>, q: ReturnType<typeof dashboardQuery.parse>) => Promise<unknown>) =>
  async (req: Request, res: Response) => {
    res.json({ data: await fn(currentUser(req), dashboardQuery.parse(req.query)) });
  };

export const dashboardRouter = Router()
  .get('/summary', handler(service.summary))
  .get('/funnel', handler(service.funnel))
  .get('/revenue', handler(service.revenue))
  .get('/closers', handler(service.closers))
  .get('/breakdown', handler(service.breakdown));

export const reportsRouter = Router().get('/', requirePermission('reports.view'), async (req: Request, res: Response) => {
  res.json({ data: await service.report(dashboardQuery.parse(req.query)) });
});
