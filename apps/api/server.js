import express from 'express';

const app = express();
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;
