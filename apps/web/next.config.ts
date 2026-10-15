import type { NextConfig } from 'next';
import path from 'node:path';

const root = path.resolve(process.cwd(), '../..');
try {
  process.loadEnvFile(path.join(root, '.env'));
} catch {
  // .env na raiz é opcional até as chaves do Supabase existirem.
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: root,
  transpilePackages: ['@kidoo/shared'],
  serverExternalPackages: ['pino', 'pino-http', 'express', '@supabase/supabase-js'],
  webpack: (config) => {
    config.resolve.modules = [path.join(root, 'node_modules'), ...(config.resolve.modules ?? ['node_modules'])];
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') return [];
    return [{ source: '/api/:path*', destination: 'http://localhost:4000/api/:path*' }];
  },
};

export default nextConfig;
