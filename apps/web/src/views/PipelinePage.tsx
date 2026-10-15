import { useState } from 'react';
import { canEditLead } from '@kidoo/shared';
import { useAuth } from '@/hooks/useAuth';
import { useDebounced } from '@/hooks/useDebounced';
import { leadKeys, useLeads, useStages, type LeadFilters as Filters } from '@/services/leads';
import { ErrorState, PageHeader } from '@/components/common';
import { Skeleton } from '@/components/ui/skeleton';
import { KanbanBoard } from '@/features/leads/KanbanBoard';
import { LeadFilters } from '@/features/leads/LeadFilters';

export default function PipelinePage() {
  const { profile } = useAuth();
  const [filters, setFilters] = useState<Filters>({ status: 'pipeline', page_size: 500, sort: 'created_at' });
  const search = useDebounced(filters.search);
  const effective = { ...filters, search };
  const stages = useStages();
  const leads = useLeads(effective);
  const open = leads.data?.data.filter((l) => l.status === 'open').length ?? 0;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col gap-4 px-4 pt-5 md:px-6">
      <PageHeader title="Pipeline Comercial" description={leads.data ? `${open} oportunidades em aberto` : 'Carregando oportunidades'} />
      <LeadFilters value={filters} onChange={setFilters} />
      <div className="min-h-0 flex-1">
        {leads.error || stages.error ? (
          <ErrorState error={leads.error ?? stages.error} onRetry={() => leads.refetch()} />
        ) : !stages.data || !leads.data ? (
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-[300px] shrink-0 space-y-2 rounded-xl bg-muted p-3">
                <Skeleton className="h-4 w-32 bg-moss-200/60" />
                {Array.from({ length: 3 - (i % 2) }).map((__, j) => (
                  <Skeleton key={j} className="h-36 bg-white" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <KanbanBoard
            stages={stages.data}
            leads={leads.data.data}
            listKey={leadKeys.list(effective)}
            canEdit={(l) => !!profile && canEditLead(profile, l)}
          />
        )}
      </div>
    </div>
  );
}
