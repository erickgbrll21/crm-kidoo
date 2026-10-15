'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Permission } from '@kidoo/shared';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common';

export function safeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export function GuestOnly({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const search = useSearchParams();
  const router = useRouter();
  const mounted = useMounted();
  const next = safeNext(search?.get('from') ?? null);
  const block = !mounted || loading || !!session;
  useEffect(() => {
    if (mounted && !loading && session) router.replace(next);
  }, [mounted, loading, session, next, router]);
  return <Gated block={block}>{children}</Gated>;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading, profile } = useAuth();
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const mounted = useMounted();
  const block = !mounted || loading || !session || !profile;
  useEffect(() => {
    if (mounted && !loading && !session) router.replace(`/login?from=${encodeURIComponent(pathname)}`);
  }, [mounted, loading, session, pathname, router]);
  return <Gated block={block}>{children}</Gated>;
}

export function RequirePermission({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { can } = useAuth();
  if (!can(permission)) {
    return (
      <div className="px-4 py-16 md:px-6">
        <EmptyState icon={ShieldOff} title="Sem permissão" description="Esta área é restrita ao gestor comercial e ao administrador." />
      </div>
    );
  }
  return children;
}

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function Gated({ block, children }: { block: boolean; children: React.ReactNode }) {
  return (
    <>
      {block ? <Boot /> : null}
      <div hidden={block}>{children}</div>
    </>
  );
}

function Boot() {
  return (
    <div className="flex min-h-dvh">
      <div className="hidden w-[248px] bg-sidebar lg:block" />
      <div className="flex-1 space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-36" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
