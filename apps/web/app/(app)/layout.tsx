'use client';

import { AppShell } from '@/layouts/AppShell';
import { RequireAuth } from '@/routes/guards';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
