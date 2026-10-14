import cron from 'node-cron';
import { logger } from '../config/logger.js';
import { runAlerts } from './alerts.js';

let running = false;

export function startScheduler() {
  cron.schedule('*/10 * * * *', async () => {
    if (running) return;
    running = true;
    try {
      await runAlerts();
    } finally {
      running = false;
    }
  });
  logger.info('Agendador de alertas ativo (a cada 10 minutos)');
}
