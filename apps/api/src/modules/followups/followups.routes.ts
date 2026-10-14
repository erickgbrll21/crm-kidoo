import { Router, type Request, type Response } from 'express';
import { followupCadence, followupComplete, followupCreate, followupListQuery, followupUpdate } from '@kidoo/shared';
import { z } from 'zod';
import { currentUser } from '../../middlewares/auth.js';
import { audit } from '../audit/audit.service.js';
import * as service from './followups.service.js';

const id = (req: Request) => z.uuid().parse(req.params.id);

export const followupsRouter = Router()
  .get('/', async (req: Request, res: Response) => {
    res.json(await service.listFollowups(currentUser(req), followupListQuery.parse(req.query)));
  })
  .post('/', async (req: Request, res: Response) => {
    res.status(201).json(await service.createFollowup(currentUser(req), followupCreate.parse(req.body)));
  })
  .post('/cadence', async (req: Request, res: Response) => {
    const { lead_id, anchor_at } = followupCadence.parse(req.body);
    const created = await service.createCadence(currentUser(req), lead_id, anchor_at);
    await audit(req, 'followup.cadence', 'lead', lead_id, { anchor_at });
    res.status(201).json({ created });
  })
  .patch('/:id', async (req: Request, res: Response) => {
    res.json(await service.updateFollowup(currentUser(req), id(req), followupUpdate.parse(req.body)));
  })
  .post('/:id/complete', async (req: Request, res: Response) => {
    const activityId = await service.completeFollowup(currentUser(req), id(req), followupComplete.parse(req.body ?? {}));
    await audit(req, 'followup.complete', 'followup', id(req));
    res.json({ activity_id: activityId });
  });
