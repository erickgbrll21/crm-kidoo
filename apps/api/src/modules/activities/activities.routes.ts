import { Router, type Request, type Response } from 'express';
import { activityComplete, activityCreate, activityListQuery, activityUpdate } from '@kidoo/shared';
import { z } from 'zod';
import { currentUser } from '../../middlewares/auth.js';
import { audit } from '../audit/audit.service.js';
import * as service from './activities.service.js';

const id = (req: Request) => z.uuid().parse(req.params.id);

export const activitiesRouter = Router()
  .get('/', async (req: Request, res: Response) => {
    res.json(await service.listActivities(currentUser(req), activityListQuery.parse(req.query)));
  })
  .post('/', async (req: Request, res: Response) => {
    const a = await service.createActivity(currentUser(req), activityCreate.parse(req.body));
    await audit(req, 'activity.create', 'activity', a.id);
    res.status(201).json(a);
  })
  .patch('/:id', async (req: Request, res: Response) => {
    res.json(await service.updateActivity(currentUser(req), id(req), activityUpdate.parse(req.body)));
  })
  .post('/:id/complete', async (req: Request, res: Response) => {
    const { outcome } = activityComplete.parse(req.body ?? {});
    const a = await service.completeActivity(currentUser(req), id(req), outcome);
    await audit(req, 'activity.complete', 'activity', a.id);
    res.json(a);
  });
