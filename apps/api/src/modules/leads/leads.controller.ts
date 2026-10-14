import type { Request, Response } from 'express';
import { closeLead, leadCreate, leadListQuery, leadUpdate, loseLead, ownerChange, reactivateLead, stageMove } from '@kidoo/shared';
import { z } from 'zod';
import { currentUser } from '../../middlewares/auth.js';
import { audit } from '../audit/audit.service.js';
import * as service from './leads.service.js';
import { listStages } from './leads.repository.js';

const id = (req: Request) => z.uuid().parse(req.params.id);

export const list = async (req: Request, res: Response) => {
  res.json(await service.listLeads(currentUser(req), leadListQuery.parse(req.query)));
};

export const stages = async (_req: Request, res: Response) => {
  res.json({ data: await listStages() });
};

export const get = async (req: Request, res: Response) => {
  res.json(await service.getLead(currentUser(req), id(req)));
};

export const create = async (req: Request, res: Response) => {
  const lead = await service.createLead(currentUser(req), leadCreate.parse(req.body));
  await audit(req, 'lead.create', 'lead', lead.id);
  res.status(201).json(lead);
};

export const update = async (req: Request, res: Response) => {
  const input = leadUpdate.parse(req.body);
  const lead = await service.updateLead(currentUser(req), id(req), input);
  await audit(req, input.archived !== undefined ? 'lead.archive' : 'lead.update', 'lead', lead.id, input);
  res.json(lead);
};

export const moveStage = async (req: Request, res: Response) => {
  const { stage } = stageMove.parse(req.body);
  const lead = await service.moveStage(currentUser(req), id(req), stage);
  await audit(req, 'lead.stage', 'lead', lead.id, { stage });
  res.json(lead);
};

export const changeOwner = async (req: Request, res: Response) => {
  const { owner_id } = ownerChange.parse(req.body);
  const lead = await service.changeOwner(currentUser(req), id(req), owner_id);
  await audit(req, 'lead.owner', 'lead', lead.id, { owner_id });
  res.json(lead);
};

export const close = async (req: Request, res: Response) => {
  const input = closeLead.parse(req.body);
  const result = await service.closeLead(currentUser(req), id(req), input);
  await audit(req, 'lead.won', 'lead', result.lead.id, input);
  res.json(result);
};

export const lose = async (req: Request, res: Response) => {
  const { reason } = loseLead.parse(req.body);
  const lead = await service.loseLead(currentUser(req), id(req), reason);
  await audit(req, 'lead.lost', 'lead', lead.id, { reason });
  res.json(lead);
};

export const reactivate = async (req: Request, res: Response) => {
  const { stage } = reactivateLead.parse(req.body ?? {});
  const lead = await service.reactivateLead(currentUser(req), id(req), stage);
  await audit(req, 'lead.reactivate', 'lead', lead.id, { stage });
  res.json(lead);
};
