import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { startScheduler } from './jobs/scheduler.js';

const app = createApp();

if (!process.env.VERCEL) {
  const server = app.listen(env.PORT, () => {
    logger.info(`Kidoo Revenue API ouvindo na porta ${env.PORT}`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (env.ENABLE_SCHEDULER) startScheduler();

export default app;
