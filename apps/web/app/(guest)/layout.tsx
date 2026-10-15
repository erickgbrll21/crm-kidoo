'use client';

import { GuestOnly } from '@/routes/guards';

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return <GuestOnly>{children}</GuestOnly>;
}
