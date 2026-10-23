import { Router, type Request, type Response } from 'express';
import { can, userInvite, userPassword, userUpdate } from '@kidoo/shared';
import { z } from 'zod';
import { db } from '../../config/supabase.js';
import { currentUser, forgetUser, requirePermission } from '../../middlewares/auth.js';
import { dbError, forbidden, HttpError, must, notFound } from '../../utils/http.js';
import { audit } from '../audit/audit.service.js';

const FIELDS = 'id, full_name, email, role, title, avatar_url, is_active, created_at';

export const usersRouter = Router()
  .get('/', async (req: Request, res: Response) => {
    let q = db.from('profiles').select(FIELDS).order('full_name');
    if (!can(currentUser(req).role, 'users.manage')) q = q.eq('is_active', true);
    res.json({ data: must(await q) });
  })
  .get('/me', (req: Request, res: Response) => {
    res.json(currentUser(req));
  })
  .patch('/:id', async (req: Request, res: Response) => {
    const me = currentUser(req);
    const id = z.uuid().parse(req.params.id);
    const input = userUpdate.parse(req.body);
    const isAdmin = can(me.role, 'users.manage');
    if (!isAdmin && (id !== me.id || input.role !== undefined || input.is_active !== undefined)) throw forbidden();
    if (id === me.id && (input.role !== undefined || input.is_active === false)) {
      throw new HttpError(409, 'conflict', 'Você não pode alterar o próprio papel nem se desativar');
    }
    const updated = must(await db.from('profiles').update(input).eq('id', id).select(FIELDS).single());
    forgetUser(id);
    await audit(req, 'user.update', 'profile', id, input);
    res.json(updated);
  })
  .post('/invite', requirePermission('users.manage'), async (req: Request, res: Response) => {
    const input = userInvite.parse(req.body);
    const { data, error } = await db.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.full_name },
      app_metadata: { role: input.role },
    });
    if (error) throw new HttpError(422, 'invite_failed', `Não foi possível criar a conta: ${error.message}`);
    // O trigger cria o perfil como closer; o papel definitivo é gravado aqui, pelo servidor.
    const profile = must(
      await db.from('profiles').update({ role: input.role, full_name: input.full_name }).eq('id', data.user.id).select(FIELDS).single(),
    );
    await audit(req, 'user.invite', 'profile', data.user.id, { email: input.email, role: input.role });
    res.status(201).json(profile);
  })
  .post('/:id/password', requirePermission('users.manage'), async (req: Request, res: Response) => {
    const id = z.uuid().parse(req.params.id);
    const { password } = userPassword.parse(req.body);
    const { data: profile, error } = await db.from('profiles').select('id').eq('id', id).maybeSingle();
    if (error) throw dbError(error);
    if (!profile) throw notFound('Usuário');
    const updated = await db.auth.admin.updateUserById(id, { password });
    if (updated.error) throw new HttpError(422, 'password_failed', 'Não foi possível redefinir a senha.');
    await audit(req, 'user.password_reset', 'profile', id);
    res.status(204).end();
  })
  .delete('/:id', requirePermission('users.manage'), async (req: Request, res: Response) => {
    const id = z.uuid().parse(req.params.id);
    const { error } = await db.rpc('remove_user', { p_user: id, p_actor: currentUser(req).id });
    if (error) throw dbError(error);
    forgetUser(id);
    await audit(req, 'user.delete', 'profile', id);
    res.status(204).end();
  });
