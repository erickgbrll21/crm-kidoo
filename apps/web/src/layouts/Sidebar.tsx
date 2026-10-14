import { NavLink } from 'react-router';
import {
  Building2,
  Cable,
  CalendarDays,
  ChartColumnBig,
  FileText,
  Handshake,
  LayoutDashboard,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  SquareKanban,
  type LucideIcon,
} from 'lucide-react';
import type { Permission } from '@kidoo/shared';
import { useAuth } from '@/hooks/useAuth';
import { useUi } from '@/stores/ui';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/menu';

interface Item {
  to: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
}

export const NAV: { group: string; items: Item[] }[] = [
  {
    group: 'Comercial',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/pipeline', label: 'Pipeline Comercial', icon: SquareKanban },
      { to: '/leads', label: 'Leads', icon: Building2 },
      { to: '/agenda', label: 'Agenda e Atividades', icon: CalendarDays },
      { to: '/follow-ups', label: 'Follow-ups', icon: MessagesSquare },
      { to: '/propostas', label: 'Propostas', icon: FileText },
    ],
  },
  {
    group: 'Pós-venda',
    items: [
      { to: '/clientes', label: 'Clientes e Onboarding', icon: Handshake },
      { to: '/relatorios', label: 'Relatórios', icon: ChartColumnBig, permission: 'reports.view' },
    ],
  },
  {
    group: 'Sistema',
    items: [
      { to: '/integracoes', label: 'Integrações', icon: Cable, permission: 'integrations.view' },
      { to: '/configuracoes', label: 'Configurações', icon: Settings },
    ],
  },
];

export function KidooMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="currentColor" className="text-white/10" />
      <path d="M11 8v16M11 16l9-8M14.5 13l6.5 11" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { can } = useAuth();
  return (
    <nav aria-label="Principal" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {NAV.map((g) => {
        const items = g.items.filter((i) => !i.permission || can(i.permission));
        if (!items.length) return null;
        return (
          <div key={g.group}>
            {!collapsed && <p className="mb-1.5 px-2.5 text-[11px] font-medium text-sidebar-muted/80">{g.group}</p>}
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => {
                const link = (
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'group flex h-9 items-center gap-3 rounded-md px-2.5 text-[13.5px] font-medium transition-colors duration-150',
                        collapsed && 'justify-center px-0',
                        isActive
                          ? 'bg-white text-moss-900'
                          : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground',
                      )
                    }
                  >
                    <item.icon className="size-[18px] shrink-0" aria-hidden />
                    {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
                  </NavLink>
                );
                return (
                  <li key={item.to}>
                    {collapsed ? (
                      <Tooltip content={item.label} side="right">
                        {link}
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const { sidebarCollapsed: collapsed, toggleSidebar } = useUi();
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex',
        collapsed ? 'w-[68px]' : 'w-[248px]',
      )}
    >
      <div className={cn('flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4', collapsed && 'justify-center px-0')}>
        <KidooMark className="size-7 shrink-0" />
        {!collapsed && (
          <div className="leading-tight">
            <p className="text-[14px] font-semibold tracking-[-0.01em]">Kidoo Hub</p>
            <p className="text-[11px] text-sidebar-muted">Revenue CRM</p>
          </div>
        )}
      </div>
      <SidebarNav collapsed={collapsed} />
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={toggleSidebar}
          className={cn(
            'flex h-9 w-full cursor-pointer items-center gap-3 rounded-md px-2.5 text-[13px] text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground',
            collapsed && 'justify-center px-0',
          )}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
          {!collapsed && 'Recolher menu'}
        </button>
      </div>
    </aside>
  );
}
