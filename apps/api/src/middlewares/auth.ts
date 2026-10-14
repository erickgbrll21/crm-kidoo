import type { Request, RequestHandler } from 'express';
import { can, type Permission, type Profile } from '@kidoo/shared';
import { db } from '../config/supabase.js';
import { forbidden, HttpError } from '../utils/http.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: Profile;
    }
  }
}

// shortcut: cache em memória por processo (30s); com várias instâncias, trocar por verificação local do JWT via JWKS.
const cache = new Map<string, { profile: Profile; until: number }>();
const TTL = 30_000;

export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, 'unauthenticated', 'Faça login para continuar');

  const hit = cache.get(token);
  if (hit && hit.until > Date.now()) {
    req.user = hit.profile;
    return next();
  }

  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'session_expired', 'Sua sessão expirou. Entre novamente.');

  const { data: profile } = await db.from('profiles').select('*').eq('id', data.user.id).maybeSingle<Profile>();
  if (!profile) throw forbidden('Perfil não encontrado');
  if (!profile.is_active) throw forbidden('Usuário desativado. Fale com um administrador.');

  if (cache.size > 1000) cache.clear();
  cache.set(token, { profile, until: Date.now() + TTL });
  req.user = profile;
  next();
};

/** Invalida o cache após mudança de papel/status de um usuário. */
export const forgetUser = (userId: string) => {
  for (const [k, v] of cache) if (v.profile.id === userId) cache.delete(k);
};

export const requirePermission =
  (permission: Permission): RequestHandler =>
  (req, _res, next) => {
    if (!can(req.user?.role, permission)) throw forbidden();
    next();
  };

export const currentUser = (req: Request): Profile => {
  if (!req.user) throw new HttpError(401, 'unauthenticated', 'Faça login para continuar');
  return req.user;
};
