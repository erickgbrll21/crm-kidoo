import { Router } from 'express';
import * as c from './leads.controller.js';

export const leadsRouter = Router()
  .get('/', c.list)
  .post('/', c.create)
  .get('/:id', c.get)
  .patch('/:id', c.update)
  .patch('/:id/stage', c.moveStage)
  .patch('/:id/owner', c.changeOwner)
  .post('/:id/close', c.close)
  .post('/:id/lose', c.lose)
  .post('/:id/reactivate', c.reactivate);

export const stagesRouter = Router().get('/', c.stages);
