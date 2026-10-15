import { useState } from 'react';
import { Building2, ChevronLeft, ChevronRight, Plus, RotateCcw } from 'lucide-react';
import { SIZE_LABEL, SOURCE_LABEL, type Lead, type LeadSource } from '@kidoo/shared';
import { useDebounced } from '@/hooks/useDebounced';
import { useLeadDrawer } from '@/hooks/useLeadDrawer';
import { useLeads, useReactivateLead, type LeadFilters as Filters } from '@/services/leads';
import { useUi } from '@/stores/ui';
import { date, money, relativeDay } from '@/lib/format';
import { cn } from '@/lib/utils';
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/menu';
import { LeadFilters } from '@/features/leads/LeadFilters';
import { StagnationMeter, useStagnation } from '@/features/leads/Stagnation';
import { StatusBadge } from '@/features/leads/LeadDrawer';

type View = 'open' | 'won' | 'lost' | 'archived';

function Thermo({ lead }: { lead: Lead }) {
  const s = useStagnation(lead);
  return <StagnationMeter level={s.level} hours={s.hours} hasInteraction={!!lead.last_interaction_at} />;
}

function Reactivate({ id }: { id: string }) {
  const r = useReactivateLead(id);
  return (
    <Button
      size="sm"
      variant="outline"
      loading={r.isPending}
      onClick={(e) => {
        e.stopPropagation();
        r.mutate('approach');
      }}
    >
      <RotateCcw /> Reativar
    </Button>
  );
}

export default function LeadsPage() {
  const [view, setView] = useState<View>('open');
  const [filters, setFilters] = useState<Filters>({ page: 1, page_size: 25, sort: 'created_at' });
  const search = useDebounced(filters.search);
  const query = { ...filters, search, status: view === 'archived' ? ('all' as const) : view, archived: view === 'archived' };
  const { data, isLoading, error, refetch, isFetching } = useLeads(query);
  const { open } = useLeadDrawer();
  const setNewLead = useUi((s) => s.setNewLead);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <div className="space-y-5 px-4 py-5 md:px-6">
      <PageHeader
        title="Leads"
        description="Todas as empresas da base comercial, incluindo a Base de Reativação."
        actions={
          <Button onClick={() => setNewLead(true)}>
            <Plus /> Novo lead
          </Button>
        }
      />
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs
          value={view}
          onValueChange={(v) => {
            setView(v as View);
            setFilters((f) => ({ ...f, page: 1 }));
          }}
        >
          <TabsList>
            <TabsTrigger value="open">Em aberto</TabsTrigger>
            <TabsTrigger value="won">Ganhos</TabsTrigger>
            <TabsTrigger value="lost">Perdidos / Reativação</TabsTrigger>
            <TabsTrigger value="archived">Arquivados</TabsTrigger>
          </TabsList>
        </Tabs>
        <LeadFilters value={filters} onChange={setFilters} />
      </div>

      <Panel className={cn('overflow-hidden transition-opacity', isFetching && !isLoading && 'opacity-70')}>
        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : !data?.data.length ? (
          <EmptyState
            icon={Building2}
            title={view === 'lost' ? 'Nenhum lead na base de reativação' : 'Nenhum lead encontrado'}
            description={
              filters.search || filters.owner_id || filters.niche || filters.priority
                ? 'Ajuste os filtros para ver mais resultados.'
                : 'Cadastre um lead manualmente ou conecte o Antigravity Engine em Integrações.'
            }
            action={
              view === 'open' && (
                <Button size="sm" onClick={() => setNewLead(true)}>
                  <Plus /> Novo lead
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-[13px]">
              <thead className="border-b border-border bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Empresa</th>
                  <th className="px-3 py-2.5 font-medium">Etapa</th>
                  <th className="px-3 py-2.5 font-medium">Nicho · Porte</th>
                  <th className="px-3 py-2.5 text-right font-medium">{view === 'won' ? 'Setup fechado' : 'Setup est.'}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{view === 'won' ? 'MRR contratado' : 'MRR est.'}</th>
                  <th className="px-3 py-2.5 font-medium">{view === 'lost' ? 'Motivo da perda' : view === 'won' ? 'Fechado em' : 'Última interação'}</th>
                  <th className="px-3 py-2.5 font-medium">Closer</th>
                  {view === 'lost' && <th className="px-4 py-2.5" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.data.map((l) => (
                  <tr
                    key={l.id}
                    tabIndex={0}
                    onClick={() => open(l.id)}
                    onKeyDown={(e) => e.key === 'Enter' && open(l.id)}
                    className="cursor-pointer transition-colors hover:bg-muted/70 focus-visible:bg-muted"
                  >
                    <td className="max-w-64 px-4 py-2.5">
                      <p className="truncate font-medium">{l.company_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {l.contact_name ?? 'Sem contato'} · {SOURCE_LABEL[l.source as LeadSource] ?? l.source}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={l.status} stage={l.stage_key} />
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{[l.niche, l.size && SIZE_LABEL[l.size]].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="tabular px-3 py-2.5 text-right">{money(view === 'won' ? l.closed_setup : l.estimated_setup)}</td>
                    <td className="tabular px-3 py-2.5 text-right">{money(view === 'won' ? l.closed_mrr : l.estimated_mrr)}</td>
                    <td className="max-w-56 px-3 py-2.5">
                      {view === 'lost' ? (
                        <span className="line-clamp-1 text-muted-foreground">{l.lost_reason}</span>
                      ) : view === 'won' ? (
                        date(l.won_at)
                      ) : l.status === 'open' ? (
                        <Thermo lead={l} />
                      ) : (
                        relativeDay(l.last_interaction_at)
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <Avatar name={l.owner_name} className="size-5 text-[9px]" />
                        {l.owner_name ?? '—'}
                      </span>
                    </td>
                    {view === 'lost' && (
                      <td className="px-4 py-2.5 text-right">
                        <Reactivate id={l.id} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > data.page_size && (
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            <span className="tabular">
              {data.total} leads · página {data.page} de {pages}
            </span>
            <div className="flex gap-1">
              <Button size="icon-sm" variant="outline" aria-label="Página anterior" disabled={data.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}>
                <ChevronLeft />
              </Button>
              <Button size="icon-sm" variant="outline" aria-label="Próxima página" disabled={data.page >= pages} onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}>
                <ChevronRight />
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
