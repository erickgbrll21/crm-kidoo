import { Router, type Request, type Response } from 'express';
import { can, clientUpdate, onboardingTaskCreate, onboardingTaskUpdate, type Profile } from '@kidoo/shared';
import { z } from 'zod';
import { db } from '../../config/supabase.js';
import { currentUser } from '../../middlewares/auth.js';
import { forbidden, must } from '../../utils/http.js';
import { audit } from '../audit/audit.service.js';
import { notify } from '../notifications/notifications.service.js';

const SELECT = '*, tech_owner:tech_owner_id(id, full_name), onboarding_tasks(*), lead:lead_id(id, owner_id)';
const id = (req: Request) => z.uuid().parse(req.params.id);

/** Gestão comercial ou o responsável técnico do cliente. */
async function assertCanManage(user: Profile, clientId: string) {
  if (can(user.role, 'clients.manage')) return;
  const c = must(await db.from('clients').select('tech_owner_id').eq('id', clientId).maybeSingle());
  if (c.tech_owner_id !== user.id) throw forbidden('Somente gestores ou o responsável técnico podem alterar o onboarding');
}

export const clientsRouter = Router()
  .get('/', async (_req: Request, res: Response) => {
    const data = must(await db.from('clients').select(SELECT).order('created_at', { ascending: false }));
    res.json({ data });
  })
  .get('/:id', async (req: Request, res: Response) => {
    res.json(must(await db.from('clients').select(SELECT).eq('id', id(req)).maybeSingle()));
  })
  .patch('/:id', async (req: Request, res: Response) => {
    const user = currentUser(req);
    await assertCanManage(user, id(req));
    const input = clientUpdate.parse(req.body);
    const data = must(await db.from('clients').update(input).eq('id', id(req)).select(SELECT).single());
    await audit(req, 'client.update', 'client', id(req), input);
    res.json(data);
  })
  .post('/:id/tasks', async (req: Request, res: Response) => {
    const user = currentUser(req);
    await assertCanManage(user, id(req));
    const input = onboardingTaskCreate.parse(req.body);
    const task = must(await db.from('onboarding_tasks').insert({ ...input, client_id: id(req), position: 99 }).select('*').single());
    const owner = task.owner_id as string | null;
    if (owner && owner !== user.id) {
      await notify([{ user_id: owner, type: 'onboarding_task', title: `Nova atividade de onboarding: ${task.title}`, link: `/clientes?client=${id(req)}`, dedupe_key: `onboarding_task:${task.id}` }]);
    }
    res.status(201).json(task);
  });

export const onboardingTasksRouter = Router().patch('/:id', async (req: Request, res: Response) => {
  const user = currentUser(req);
  const task = must(await db.from('onboarding_tasks').select('id, client_id, owner_id').eq('id', id(req)).maybeSingle());
  if (task.owner_id !== user.id) await assertCanManage(user, task.client_id);
  const input = onboardingTaskUpdate.parse(req.body);
  const patch = {
    ...input,
    ...(input.status && { completed_at: input.status === 'done' ? new Date().toISOString() : null }),
  };
  res.json(must(await db.from('onboarding_tasks').update(patch).eq('id', id(req)).select('*').single()));
});
