'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ApiError } from '@/lib/api';
import { AuthProvider } from '@/hooks/useAuth';
import { TooltipProvider } from '@/components/ui/menu';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (count, err) => err instanceof ApiError && err.status >= 500 && count < 2,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              className: 'font-sans text-sm',
              style: { border: '1px solid #e3e7e0', color: '#1e241d' },
            }}
          />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
