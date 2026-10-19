import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  calendarEventFromActivity,
  decryptSecret,
  encryptSecret,
  signOAuthState,
  verifyOAuthState,
} from '../src/modules/integrations/google-calendar.js';
import { installDefaults } from './setup.js';

const app = createApp();

describe('Google Calendar', () => {
  it('cifra e decifra o refresh token', () => {
    const packed = encryptSecret('refresh-token-secret');
    expect(packed).not.toContain('refresh-token-secret');
    expect(decryptSecret(packed)).toBe('refresh-token-secret');
  });

  it('assina e valida o state OAuth', () => {
    const state = signOAuthState('00000000-0000-4000-8000-000000000001', 'integracoes');
    expect(verifyOAuthState(state)).toEqual({ uid: '00000000-0000-4000-8000-000000000001', next: 'integracoes' });
  });

  it('rejeita state adulterado', () => {
    const state = signOAuthState('00000000-0000-4000-8000-000000000001', 'agenda');
    expect(() => verifyOAuthState(`${state}x`)).toThrow();
  });

  it('monta o evento com lead e 30 minutos', () => {
    const event = calendarEventFromActivity({
      title: 'Call 15 min',
      description: 'Diagnóstico',
      due_at: '2026-10-20T15:00:00.000Z',
      lead: { company_name: 'Clínica Vida Plena' },
    });
    expect(event.summary).toBe('Call 15 min');
    expect(event.description).toContain('Clínica Vida Plena');
    expect(event.start.dateTime).toBe('2026-10-20T15:00:00.000Z');
    expect(event.end.dateTime).toBe('2026-10-20T15:30:00.000Z');
  });

  it('não finge integração sem credenciais no servidor', async () => {
    installDefaults();
    const status = await request(app).get('/api/v1/integrations/google/status').set({ Authorization: 'Bearer closer' });
    expect(status.status).toBe(200);
    expect(status.body).toEqual({ configured: false, connected: false, email: null });

    const connect = await request(app).get('/api/v1/integrations/google/connect').set({ Authorization: 'Bearer closer' });
    expect(connect.status).toBe(503);
    expect(connect.body.error.code).toBe('google_not_configured');
  });

  it('callback inválido devolve para a agenda sem JSON cru', async () => {
    const res = await request(app).get('/api/v1/integrations/google/callback').query({ code: 'x', state: 'lixo' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/\/agenda\?google=error$/);
  });
});
