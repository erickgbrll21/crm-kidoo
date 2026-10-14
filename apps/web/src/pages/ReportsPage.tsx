import { useState } from 'react';
import { Download } from 'lucide-react';
import { ACTIVITY_LABEL, PROPOSAL_LABEL, SOURCE_LABEL, type ActivityType, type LeadSource, type ProposalStatus } from '@kidoo/shared';
import { useReport } from '@/services/insights';
import { downloadCsv } from '@/lib/csv';
import { money, percent } from '@/lib/format';
import { PeriodFilter, periodFromPreset, toPeriod, type PeriodState } from '@/components/PeriodFilter';
import { EmptyState, ErrorState, PageHeader, Panel, PanelHeader } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartColumnBig } from 'lucide-react';

export default function ReportsPage() {
  const [period, setPeriod] = useState<PeriodState>({ preset: '30d', ...periodFromPreset('30d') });
  const q = toPeriod(period);
  const { data, isLoading, error, refetch } = useReport(q);

  const exportCsv = () => {
    if (!data) return;
    downloadCsv(
      `kidoo-relatorio.csv`,
      ['Métrica', 'Valor'],
      [
        ['Setup contratado', data.closed_setup],
        ['MRR contratado', data.closed_mrr],
        ['Tempo médio até fechamento (dias)', data.avg_days_to_close],
        ...data.closers.map((c) => [`Closer ${c.name} · ganhos`, c.won]),
        ...data.loss_reasons.map((r) => [`Perda · ${r.reason}`, r.count]),
        ...data.by_source.map((r) => [`Origem · ${SOURCE_LABEL[r.key as LeadSource] ?? r.key}`, r.leads]),
        ...data.by_niche.map((r) => [`Nicho · ${r.key}`, r.leads]),
        ...data.proposals.map((p) => [`Proposta ${PROPOSAL_LABEL[p.status as ProposalStatus] ?? p.status}`, p.count]),
        ...data.activities.map((a) => [`Atividade ${ACTIVITY_LABEL[a.type as ActivityType] ?? a.type}`, a.count]),
      ],
    );
  };

  return (
    <div className="space-y-5 px-4 py-5 md:px-6">
      <PageHeader
        title="Relatórios"
        description="Conversão, origem, nicho e atividades no período selecionado."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PeriodFilter value={period} onChange={setPeriod} />
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data}>
              <Download /> Exportar CSV
            </Button>
          </div>
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <TablePanel
            title="Conversão por etapa"
            description="Leads que passaram por cada etapa no período, e taxa para a seguinte."
            headers={['Etapa', 'Atingiram', 'Para a próxima']}
            rows={data.stage_conversion.map((s) => [s.name, s.reached, percent(s.to_next)])}
          />
          <TablePanel
            title="Performance por closer"
            headers={['Closer', 'Abertos', 'Ganhos', 'Perdidos', 'Conv.', 'Setup', 'MRR']}
            rows={data.closers.map((c) => [c.name, c.open, c.won, c.lost, percent(c.conversion), money(c.closed_setup), money(c.closed_mrr)])}
          />
          <StatRow
            items={[
              { label: 'Tempo médio até fechamento', value: data.avg_days_to_close == null ? '—' : `${data.avg_days_to_close} dias` },
              { label: 'Setup contratado', value: money(data.closed_setup) },
              { label: 'MRR contratado', value: money(data.closed_mrr) },
            ]}
          />
          <TablePanel title="Motivos de perda" headers={['Motivo', 'Qtd']} rows={data.loss_reasons.map((r) => [r.reason, r.count])} empty="Nenhuma perda no período." />
          <TablePanel
            title="Leads por origem"
            headers={['Origem', 'Leads', 'Ganhos', 'Conv.']}
            rows={data.by_source.map((r) => [SOURCE_LABEL[r.key as LeadSource] ?? r.key, r.leads, r.won, percent(r.conversion)])}
          />
          <TablePanel
            title="Nichos com maior conversão"
            headers={['Nicho', 'Leads', 'Ganhos', 'Conv.']}
            rows={data.by_niche.map((r) => [r.key, r.leads, r.won, percent(r.conversion)])}
          />
          <TablePanel
            title="Propostas"
            headers={['Status', 'Qtd']}
            rows={data.proposals.map((p) => [PROPOSAL_LABEL[p.status as ProposalStatus] ?? p.status, p.count])}
          />
          <TablePanel
            title="Atividades realizadas"
            headers={['Tipo', 'Qtd']}
            rows={data.activities.map((a) => [ACTIVITY_LABEL[a.type as ActivityType] ?? a.type, a.count])}
          />
        </div>
      )}
    </div>
  );
}

function StatRow({ items }: { items: { label: string; value: string }[] }) {
  return (
    <Panel className="grid gap-4 p-5 sm:grid-cols-3 xl:col-span-2">
      {items.map((i) => (
        <div key={i.label}>
          <p className="text-xs text-muted-foreground">{i.label}</p>
          <p className="tabular mt-1 text-lg font-semibold">{i.value}</p>
        </div>
      ))}
    </Panel>
  );
}

function TablePanel({
  title,
  description,
  headers,
  rows,
  empty = 'Sem dados neste período.',
}: {
  title: string;
  description?: string;
  headers: string[];
  rows: (string | number)[][];
  empty?: string;
}) {
  return (
    <Panel className="overflow-hidden">
      <PanelHeader title={title} description={description} />
      {!rows.length ? (
        <EmptyState icon={ChartColumnBig} title={empty} description="Ajuste o período ou o closer." className="py-8" />
      ) : (
        <div className="overflow-x-auto px-2 pb-3">
          <table className="w-full text-left text-[13px]">
            <thead className="text-xs text-muted-foreground">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className={j === 0 ? 'px-3 py-2' : 'tabular px-3 py-2'}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
