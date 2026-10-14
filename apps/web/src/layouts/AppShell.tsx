import { Outlet } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { useRealtime } from '@/hooks/useRealtime';
import { useUi } from '@/stores/ui';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { LeadDrawer } from '@/features/leads/LeadDrawer';
import { LeadFormDialog } from '@/features/leads/LeadFormDialog';

export function AppShell() {
  const { session } = useAuth();
  const { newLeadOpen, setNewLead } = useUi();
  useRealtime(!!session);

  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
      <LeadDrawer />
      <LeadFormDialog open={newLeadOpen} onOpenChange={setNewLead} />
    </div>
  );
}
