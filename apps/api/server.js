import express from 'express';

const app = express();
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok' });
});

try {
  const { default: api } = await import('./dist/server.js');
  app.use(api);
} catch (err) {
  console.error('Falha ao carregar a API:', err);
  const message = err instanceof Error ? err.message : 'Falha ao iniciar a API';
  app.use((req, res, next) => {
    if (req.path === '/api/v1/health') return next();
    res.status(500).json({ error: { code: 'api_boot_failed', message } });
  });
}

export default app;
