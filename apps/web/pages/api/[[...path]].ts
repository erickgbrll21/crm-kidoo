import type { NextApiRequest, NextApiResponse } from 'next';
import type { Express } from 'express';

export const config = {
  api: { externalResolver: true, bodyParser: false },
};

let app: Express | undefined;

// shortcut: node-cron não roda neste processo; na Vercel dispare POST /api/v1/jobs/run
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!app) {
    const { createApp } = await import('../../../api/src/app.js');
    app = createApp();
  }
  app(req, res);
}
