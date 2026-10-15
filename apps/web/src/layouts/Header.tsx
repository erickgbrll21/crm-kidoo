import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog as D } from 'radix-ui';
import { Bell, Building2, CheckCheck, LogOut, Menu, Plus, Search, UserRound } from 'lucide-react';
import { ROLE_LABEL } from '@kidoo/shared';
import { useAuth } from '@/hooks/useAuth';
import { useLeadDrawer } from '@/hooks/useLeadDrawer';
import { useDebounced } from '@/hooks/useDebounced';
import { useLeads } from '@/services/leads';
import { useMarkRead, useNotifications } from '@/services/operations';
import { useUi } from '@/stores/ui';
import { ago, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/menu';
import { Skeleton } from '@/components/ui/skeleton';
import { KidooMark, SidebarNav } from './Sidebar';

function GlobalSearch() {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const search = useDebounced(term.trim());
  const { open: openLead } = useLeadDrawer();
  const results = useLeads({ search, status: 'all', page_size: 8 });
  const items = search.length >= 2 ? (results.data?.data ?? []) : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !/input|textarea|select/i.test((e.target as HTMLElement).tagName))) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const choose = (id: string) => {
    openLead(id);
    setOpen(false);
    setTerm('');
    input.current?.blur();
  };

  return (
    <Popover open={open && search.length >= 2} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            ref={input}
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, items.length - 1));
              if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
              if (e.key === 'Enter' && items[active]) choose(items[active]!.id);
              if (e.key === 'Escape') setOpen(false);
            }}
            placeholder="Buscar empresa, contato ou nicho"
            aria-label="Busca global"
            role="combobox"
            aria-expanded={open && search.length >= 2}
            aria-controls="global-search-results"
            className="h-9 w-full rounded-md border border-transparent bg-muted pr-12 pl-9 text-sm transition-colors placeholder:text-muted-foreground hover:border-border focus-visible:border-moss-700 focus-visible:bg-white focus-visible:outline-none"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-border bg-white px-1.5 text-[10px] text-muted-foreground sm:block">
            Ctrl K
          </kbd>
        </div>
      </PopoverAnchor>
      <PopoverContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-[var(--radix-popover-trigger-width)] min-w-80 p-1"
        id="global-search-results"
      >
        {results.isFetching && !items.length ? (
          <div className="space-y-2 p-2">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : items.length ? (
          <ul role="listbox">
            {items.map((l, i) => (
              <li key={l.id} role="option" aria-selected={i === active}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(l.id)}
                  className={cn('flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left', i === active && 'bg-accent')}
                >
                  <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{l.company_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[l.contact_name, l.niche].filter(Boolean).join(' · ') || 'Sem contato'}
                    </span>
                  </span>
                  <span className="tabular text-xs text-muted-foreground">{money(l.estimated_mrr)}/mês</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-4 text-center text-[13px] text-muted-foreground">Nenhum lead encontrado para “{search}”.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Notifications() {
  const { data, isLoading } = useNotifications();
  const markRead = useMarkRead();
  const router = useRouter();
  const unread = data?.filter((n) => !n.read_at).length ?? 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notificações${unread ? `, ${unread} não lidas` : ''}`} className="relative">
          <Bell />
          {unread > 0 && (
            <span className="tabular absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notificações</p>
          {unread > 0 && (
            <button onClick={() => markRead.mutate(undefined)} className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-moss-700 hover:text-moss-900">
              <CheckCheck className="size-3.5" /> Marcar todas como lidas
            </button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : !data?.length ? (
            <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">
              Você será avisado aqui sobre leads atribuídos, follow-ups vencidos, reuniões e negócios ganhos.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => {
                      if (!n.read_at) markRead.mutate(n.id);
                      if (n.link) router.push(n.link);
                    }}
                    className="flex w-full cursor-pointer gap-3 px-4 py-3 text-left transition-colors hover:bg-muted"
                  >
                    <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-moss-800')} aria-hidden />
                    <span className="min-w-0">
                      <span className={cn('block text-[13px]', !n.read_at && 'font-medium')}>{n.title}</span>
                      {n.body && <span className="block truncate text-xs text-muted-foreground">{n.body}</span>}
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">{ago(n.created_at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ProfileMenu() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex cursor-pointer items-center gap-2 rounded-md p-1 transition-colors hover:bg-accent" aria-label="Menu do perfil">
          <Avatar name={profile?.full_name} className="size-8 text-[11px]" />
          <span className="hidden text-left leading-tight md:block">
            <span className="block text-[13px] font-medium">{profile?.full_name}</span>
            <span className="block text-[11px] text-muted-foreground">{profile && ROLE_LABEL[profile.role]}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{profile?.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push('/configuracoes')}>
          <UserRound /> Meu perfil
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => signOut()}>
          <LogOut /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  const { mobileNavOpen, setMobileNav, setNewLead } = useUi();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-white px-4 md:px-6">
      <D.Root open={mobileNavOpen} onOpenChange={setMobileNav}>
        <D.Trigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
            <Menu />
          </Button>
        </D.Trigger>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-50 bg-moss-950/40 lg:hidden" />
          <D.Content className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-sidebar text-sidebar-foreground data-[state=open]:animate-in lg:hidden">
            <D.Title className="flex h-16 items-center border-b border-sidebar-border px-4">
              <KidooMark className="h-9" />
            </D.Title>
            <D.Description className="sr-only">Navegação principal</D.Description>
            <SidebarNav onNavigate={() => setMobileNav(false)} />
          </D.Content>
        </D.Portal>
      </D.Root>

      <GlobalSearch />
      <div className="ml-auto flex items-center gap-1.5">
        <Button size="sm" onClick={() => setNewLead(true)} className="hidden sm:inline-flex">
          <Plus /> Novo lead
        </Button>
        <Button size="icon-sm" onClick={() => setNewLead(true)} className="sm:hidden" aria-label="Novo lead">
          <Plus />
        </Button>
        <Notifications />
        <ProfileMenu />
      </div>
    </header>
  );
}
