import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { startScheduler } from './jobs/scheduler.js';

const server = createApp().listen(env.PORT, () => {
  logger.info(`Kidoo Revenue API ouvindo na porta ${env.PORT}`);
});

if (env.ENABLE_SCHEDULER) startScheduler();

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
