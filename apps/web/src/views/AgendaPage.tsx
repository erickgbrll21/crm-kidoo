import { useMemo, useState } from 'react';
import { useQueryPatch } from '@/hooks/useQueryPatch';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { ACTIVITY_LABEL, type Activity, type ActivityType } from '@kidoo/shared';
import { useLeadDrawer } from '@/hooks/useLeadDrawer';
import { useActivities, useCompleteActivity, useUsers, type ActivityFilters } from '@/services/operations';
import { dateTime, relativeDay } from '@/lib/format';
import { cn } from '@/lib/utils';
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/common';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/menu';
import { Badge } from '@/components/ui/badge';
import { ActivityDialog } from '@/features/activities/ActivityDialog';
import { GoogleCalendarConnect, GoogleCalendarReturnToast } from '@/features/integrations/GoogleCalendarConnect';

type Tab = 'list' | 'calendar' | 'today' | 'next7' | 'overdue';

export default function AgendaPage() {
  const [params, setParams] = useQueryPatch();
  const tab = (params.get('view') as Tab) || 'today';
  const [owner, setOwner] = useState('');
  const [month, setMonth] = useState(new Date());
  const [compose, setCompose] = useState(false);
  const users = useUsers();
  const { open } = useLeadDrawer();

  const filters: ActivityFilters =
    tab === 'calendar'
      ? { status: 'all', owner_id: owner || undefined, from: startOfMonth(month).toISOString(), to: endOfMonth(month).toISOString(), page_size: 500 }
      : { view: tab === 'list' ? 'all' : tab, status: tab === 'list' ? 'all' : 'pending', owner_id: owner || undefined, page_size: 200 };

  const { data, isLoading, error, refetch } = useActivities(filters);
  const items = data?.data ?? [];

  const setTab = (v: string) =>
    setParams((p) => {
      p.set('view', v);
      return p;
    });

  return (
    <div className="space-y-5 px-4 py-5 md:px-6">
      <PageHeader
        title="Agenda e atividades"
        description="O que precisa acontecer hoje — ligação, reunião, proposta ou tarefa."
        actions={
          <Button onClick={() => setCompose(true)}>
            <Plus /> Nova atividade
          </Button>
        }
      />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="today">Hoje</TabsTrigger>
            <TabsTrigger value="next7">Próximos 7 dias</TabsTrigger>
            <TabsTrigger value="overdue">Atrasadas</TabsTrigger>
            <TabsTrigger value="list">Lista</TabsTrigger>
            <TabsTrigger value="calendar">Calendário</TabsTrigger>
          </TabsList>
        </Tabs>
        <NativeSelect aria-label="Responsável" value={owner} onChange={(e) => setOwner(e.target.value)} className="w-44">
          <option value="">Todos os responsáveis</option>
          {users.data?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <GoogleCalendarReturnToast />
      <GoogleCalendarConnect returnTo="agenda" />

      {tab === 'calendar' ? (
        <MonthGrid month={month} onMonth={setMonth} items={items} loading={isLoading} error={error} onRetry={() => refetch()} onOpen={open} />
      ) : (
        <ActivityList items={items} loading={isLoading} error={error} onRetry={() => refetch()} onOpen={open} empty={tab} />
      )}
      <ActivityDialog open={compose} onOpenChange={setCompose} mode="schedule" />
    </div>
  );
}

function ActivityList({
  items,
  loading,
  error,
  onRetry,
  onOpen,
  empty,
}: {
  items: Activity[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onOpen: (id: string) => void;
  empty: string;
}) {
  const complete = useCompleteActivity();
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (loading) {
    return (
      <Panel className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </Panel>
    );
  }
  if (!items.length) {
    return (
      <Panel>
        <EmptyState
          icon={CalendarDays}
          title={empty === 'overdue' ? 'Nada atrasado' : 'Nenhuma atividade neste recorte'}
          description="Agende uma ligação, reunião ou follow-up a partir do dossiê do lead."
        />
      </Panel>
    );
  }
  return (
    <Panel className="divide-y divide-border">
      {items.map((a) => (
        <div key={a.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => a.lead_id && onOpen(a.lead_id)}>
            <p className="text-sm font-medium">{a.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {ACTIVITY_LABEL[a.type as ActivityType]} · {a.lead?.company_name ?? 'Sem lead'} · {relativeDay(a.due_at)}
            </p>
          </div>
          <Badge variant={a.status === 'done' ? 'success' : a.status === 'canceled' ? 'outline' : 'default'}>
            {a.status === 'done' ? 'Concluída' : a.status === 'canceled' ? 'Cancelada' : 'Pendente'}
          </Badge>
          {a.status === 'pending' && (
            <Button size="sm" variant="outline" loading={complete.isPending} onClick={() => complete.mutate({ id: a.id })}>
              <Check /> Concluir
            </Button>
          )}
        </div>
      ))}
    </Panel>
  );
}

function MonthGrid({
  month,
  onMonth,
  items,
  loading,
  error,
  onRetry,
  onOpen,
}: {
  month: Date;
  onMonth: (d: Date) => void;
  items: Activity[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onOpen: (id: string) => void;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }),
  });
  const byDay = useMemo(() => {
    const m = new Map<string, Activity[]>();
    for (const a of items) {
      if (!a.due_at) continue;
      const k = format(new Date(a.due_at), 'yyyy-MM-dd');
      m.set(k, [...(m.get(k) ?? []), a]);
    }
    return m;
  }, [items]);

  if (error) return <ErrorState error={error} onRetry={onRetry} />;

  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-semibold capitalize">{format(month, 'MMMM yyyy', { locale: ptBR })}</p>
        <div className="flex gap-1">
          <Button size="icon-sm" variant="outline" aria-label="Mês anterior" onClick={() => onMonth(subMonths(month, 1))}>
            <ChevronLeft />
          </Button>
          <Button size="icon-sm" variant="outline" aria-label="Próximo mês" onClick={() => onMonth(addMonths(month, 1))}>
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-t border-border text-center text-[11px] text-muted-foreground">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
          <div key={d} className="border-b border-border py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const key = format(d, 'yyyy-MM-dd');
          const list = byDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={cn('min-h-24 border-r border-b border-border p-1.5', !isSameMonth(d, month) && 'bg-muted/40', isSameDay(d, new Date()) && 'bg-moss-50')}
            >
              <p className={cn('tabular text-[11px]', isSameDay(d, new Date()) ? 'font-semibold text-moss-800' : 'text-muted-foreground')}>{format(d, 'd')}</p>
              {loading ? (
                <Skeleton className="mt-1 h-4" />
              ) : (
                list.slice(0, 3).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => a.lead_id && onOpen(a.lead_id)}
                    className="mt-1 block w-full truncate rounded bg-moss-100 px-1 py-0.5 text-left text-[10px] text-moss-900"
                    title={`${a.title} · ${dateTime(a.due_at)}`}
                  >
                    {a.title}
                  </button>
                ))
              )}
              {list.length > 3 && <p className="mt-1 text-[10px] text-muted-foreground">+{list.length - 3}</p>}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
