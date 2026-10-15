import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Providers } from './providers';
import '@/styles/index.css';

export const metadata: Metadata = {
  title: 'Kidoo Revenue CRM',
  icons: { icon: '/favicon.png' },
};

export const viewport: Viewport = {
  themeColor: '#2A3229',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>
          <Suspense fallback={null}>{children}</Suspense>
        </Providers>
      </body>
    </html>
  );
}
