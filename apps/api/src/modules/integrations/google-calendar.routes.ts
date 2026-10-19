import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { googleCalendarConfigured } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { currentUser } from '../../middlewares/auth.js';
import { HttpError } from '../../utils/http.js';
import {
  calendarAppPath,
  connectionStatus,
  disconnectCalendar,
  exchangeCode,
  googleAuthUrl,
  saveConnection,
  verifyOAuthState,
  type CalendarReturnTo,
} from './google-calendar.js';

const returnTo = z.enum(['agenda', 'integracoes']).default('agenda');

export async function googleCalendarCallback(req: Request, res: Response) {
  const next: CalendarReturnTo = 'agenda';
  try {
    if (req.query.error) {
      res.redirect(calendarAppPath(next, 'denied'));
      return;
    }
    const code = z.string().min(1).parse(req.query.code);
    const { uid, next: dest } = verifyOAuthState(z.string().min(1).parse(req.query.state));
    if (!googleCalendarConfigured()) {
      res.redirect(calendarAppPath(dest, 'error'));
      return;
    }
    const tokens = await exchangeCode(code);
    await saveConnection(uid, tokens);
    res.redirect(calendarAppPath(dest, 'connected'));
  } catch (err) {
    logger.warn({ err }, 'OAuth Google Calendar falhou');
    try {
      const dest = typeof req.query.state === 'string' ? verifyOAuthState(req.query.state).next : next;
      res.redirect(calendarAppPath(dest, 'error'));
    } catch {
      res.redirect(calendarAppPath(next, 'error'));
    }
  }
}

export const googleCalendarRouter = Router()
  .get('/status', async (req: Request, res: Response) => {
    res.json(await connectionStatus(currentUser(req).id));
  })
  .get('/connect', (req: Request, res: Response) => {
    const dest = returnTo.parse(req.query.return_to);
    res.json({ url: googleAuthUrl(currentUser(req).id, dest) });
  })
  .post('/disconnect', async (req: Request, res: Response) => {
    if (!googleCalendarConfigured()) {
      throw new HttpError(503, 'google_not_configured', 'Google Calendar ainda não foi configurado no servidor');
    }
    await disconnectCalendar(currentUser(req).id);
    res.status(204).end();
  });
