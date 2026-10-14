import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { proposalCreate, proposalListQuery, proposalUpdate } from '@kidoo/shared';
import { z } from 'zod';
import { currentUser } from '../../middlewares/auth.js';
import { audit } from '../audit/audit.service.js';
import * as service from './proposals.service.js';

const id = (req: Request) => z.uuid().parse(req.params.id);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 1 } });

export const proposalsRouter = Router()
  .get('/', async (req: Request, res: Response) => {
    res.json(await service.listProposals(currentUser(req), proposalListQuery.parse(req.query)));
  })
  .post('/', async (req: Request, res: Response) => {
    const p = await service.createProposal(currentUser(req), proposalCreate.parse(req.body));
    await audit(req, 'proposal.create', 'proposal', p.id);
    res.status(201).json(p);
  })
  .patch('/:id', async (req: Request, res: Response) => {
    const input = proposalUpdate.parse(req.body);
    const p = await service.updateProposal(currentUser(req), id(req), input);
    await audit(req, 'proposal.update', 'proposal', p.id, input);
    res.json(p);
  })
  .post('/:id/document', upload.single('file'), async (req: Request, res: Response) => {
    const p = await service.attachDocument(currentUser(req), id(req), req.file);
    await audit(req, 'proposal.document', 'proposal', p.id, { name: req.file?.originalname });
    res.json(p);
  })
  .get('/:id/document', async (req: Request, res: Response) => {
    res.json({ url: await service.documentUrl(currentUser(req), id(req)) });
  });
