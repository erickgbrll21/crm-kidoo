import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  sourcemap: true,
  clean: true,
  outExtension: () => ({ js: '.mjs' }),
  // O pacote compartilhado é TypeScript puro; precisa ser embutido no bundle.
  noExternal: ['@kidoo/shared'],
});
