'use client';

import { RequirePermission } from '@/routes/guards';

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return <RequirePermission permission="reports.view">{children}</RequirePermission>;
}
