import { Navigate, Outlet, useLocation } from 'react-router';
import type { Permission } from '@kidoo/shared';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common';
import { ShieldOff } from 'lucide-react';

export function GuestOnly() {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Boot />;
  if (session) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />;
  return <Outlet />;
}

export function RequireAuth() {
  const { session, loading, profile } = useAuth();
  const location = useLocation();
  if (loading) return <Boot />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!profile) return <Boot />;
  return <Outlet />;
}

export function RequirePermission({ permission }: { permission: Permission }) {
  const { can } = useAuth();
  if (!can(permission)) {
    return (
      <div className="px-4 py-16 md:px-6">
        <EmptyState icon={ShieldOff} title="Sem permissão" description="Esta área é restrita ao gestor comercial e ao administrador." />
      </div>
    );
  }
  return <Outlet />;
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
