import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { fake } from './fake-instance.js';
import { PROFILES } from './fake-db.js';

const app = createApp();
const auth = (role: keyof typeof PROFILES) => ({ Authorization: `Bearer ${role}` });

describe('usuários', () => {
  it('closer não exclui nem redefine senha', async () => {
    expect((await request(app).delete(`/api/v1/users/${PROFILES.admin.id}`).set(auth('closer'))).status).toBe(403);
    expect((await request(app).post(`/api/v1/users/${PROFILES.admin.id}/password`).set(auth('closer')).send({ password: 'senha1234' })).status).toBe(403);
    expect(fake.db.rpc).not.toHaveBeenCalled();
  });

  it('admin exclui outra conta', async () => {
    const res = await request(app).delete(`/api/v1/users/${PROFILES.closer.id}`).set(auth('admin'));
    expect(res.status).toBe(204);
    expect(fake.db.rpc).toHaveBeenCalledWith('remove_user', { p_user: PROFILES.closer.id, p_actor: PROFILES.admin.id });
  });

  it('recusa excluir a própria conta', async () => {
    fake.db.rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'self_delete' } });
    const res = await request(app).delete(`/api/v1/users/${PROFILES.admin.id}`).set(auth('admin'));
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Você não pode excluir a própria conta');
  });

  it('redefine a senha com no mínimo 8 caracteres', async () => {
    const short = await request(app).post(`/api/v1/users/${PROFILES.closer.id}/password`).set(auth('admin')).send({ password: 'curta' });
    expect(short.status).toBe(422);

    fake.db.auth.admin.updateUserById.mockResolvedValueOnce({ data: { user: { id: PROFILES.closer.id } }, error: null });
    const res = await request(app).post(`/api/v1/users/${PROFILES.closer.id}/password`).set(auth('admin')).send({ password: 'senha1234' });
    expect(res.status).toBe(204);
    expect(fake.db.auth.admin.updateUserById).toHaveBeenCalledWith(PROFILES.closer.id, { password: 'senha1234' });
  });
});
