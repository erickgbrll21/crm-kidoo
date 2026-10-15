'use client';

import { RequirePermission } from '@/routes/guards';

export default function IntegrationsLayout({ children }: { children: React.ReactNode }) {
  return <RequirePermission permission="integrations.view">{children}</RequirePermission>;
}
