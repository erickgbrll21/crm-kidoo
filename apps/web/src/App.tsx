import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { GuestOnly, RequireAuth, RequirePermission } from '@/routes/guards';
import { AppShell } from '@/layouts/AppShell';
import { Skeleton } from '@/components/ui/skeleton';
import LoginPage from '@/pages/LoginPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const PipelinePage = lazy(() => import('@/pages/PipelinePage'));
const LeadsPage = lazy(() => import('@/pages/LeadsPage'));
const AgendaPage = lazy(() => import('@/pages/AgendaPage'));
const FollowupsPage = lazy(() => import('@/pages/FollowupsPage'));
const ProposalsPage = lazy(() => import('@/pages/ProposalsPage'));
const ClientsPage = lazy(() => import('@/pages/ClientsPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const IntegrationsPage = lazy(() => import('@/pages/IntegrationsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

function PageFallback() {
  return (
    <div className="space-y-4 px-4 py-6 md:px-6">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-40" />
      <Skeleton className="h-72" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
        </Route>
        <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="pipeline" element={<PipelinePage />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="agenda" element={<AgendaPage />} />
            <Route path="follow-ups" element={<FollowupsPage />} />
            <Route path="propostas" element={<ProposalsPage />} />
            <Route path="clientes" element={<ClientsPage />} />
            <Route path="configuracoes" element={<SettingsPage />} />
            <Route element={<RequirePermission permission="reports.view" />}>
              <Route path="relatorios" element={<ReportsPage />} />
            </Route>
            <Route element={<RequirePermission permission="integrations.view" />}>
              <Route path="integracoes" element={<IntegrationsPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
