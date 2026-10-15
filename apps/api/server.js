import { existsSync } from 'node:fs';

if (!existsSync(new URL('./dist/server.js', import.meta.url))) {
  throw new Error('API bundle ausente: rode npm run build --workspace @kidoo/api');
}

export { default } from './dist/server.js';
