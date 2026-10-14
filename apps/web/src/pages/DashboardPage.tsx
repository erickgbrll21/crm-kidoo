import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, ArrowUpRight, Clock } from 'lucide-react';
import { SOURCE_LABEL, type LeadSource } from '@kidoo/shared';
import { useDashboard } from '@/services/insights';
import { money, moneyCompact, percent } from '@/lib/format';
import { PeriodFilter, periodFromPreset, toPeriod, type PeriodState } from '@/components/PeriodFilter';
import { ChartPanel, CHART, tooltipStyle } from '@/components/ChartFrame';
import { ErrorState, PageHeader, Panel } from '@/components/common';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export default function DashboardPage() {
  const [period, setPeriod] = useState<PeriodState>({ preset: '30d', ...periodFromPreset('30d') });
  const q = toPeriod(period);
  const { summary, funnel, revenue, closers, breakdown } = useDashboard(q);
  const s = summary.data;

  const funnelOpen = useMemo(() => (funnel.data ?? []).filter((r) => r.key !== 'won'), [funnel.data]);
  const wonRow = funnel.data?.find((r) => r.key === 'won');

  return (
    <div className="space-y-6 px-4 py-5 md:px-6">
      <PageHeader
        title="Dashboard"
        description="Potencial do pipeline separado do que já foi contratado no período."
        actions={<PeriodFilter value={period} onChange={setPeriod} />}
      />

      {summary.error ? (
        <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
      ) : !s ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <>
          <section aria-label="Pipeline potencial">
            <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Agora · potencial</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Stat label="Leads ativos" value={String(s.active_leads)} hint="Oportunidades em aberto" />
              <Stat label="Setup potencial" value={moneyCompact(s.pipeline_setup)} hint="Soma estimada dos abertos" />
              <Stat label="MRR potencial" value={moneyCompact(s.pipeline_mrr)} hint="Mensalidade estimada dos abertos" />
              <AlertStat
                label="Leads esfriando"
                value={s.stagnant_leads}
                to="/leads?status=open"
                hint="Mais de 48h sem interação real"
              />
              <AlertStat label="Follow-ups vencidos" value={s.overdue_followups} to="/follow-ups?view=overdue" hint="Cadência atrasada" />
            </div>
          </section>
          <section aria-label="Resultado contratado">
            <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Período · contratado</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Stat label="Negócios ganhos" value={String(s.won_count)} hint={`${s.lost_count} perdidos no mesmo recorte`} />
              <Stat label="Setup fechado" value={money(s.closed_setup)} hint="Valores de contrato, não estimativa" />
              <Stat label="MRR contratado" value={money(s.closed_mrr)} hint="Mensalidade assinada" />
              <Stat
                label="Conversão"
                value={percent(s.conversion.rate)}
                hint={`${s.conversion.won} ganhos ÷ ${s.conversion.decided} decididos (ganho+perda)`}
              />
              <Stat label="Ticket médio Setup" value={money(s.avg_ticket_setup)} hint={`MRR médio ${money(s.avg_ticket_mrr)}`} />
            </div>
          </section>
        </>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel title="Funil por etapa" description="Abertos no momento · ganhos só no período" loading={funnel.isLoading} error={funnel.error} empty={!funnelOpen.length} onRetry={() => funnel.refetch()}>
          <ResponsiveContainer>
            <BarChart data={funnelOpen} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 0 }}>
              <CartesianGrid stroke={CHART.grid} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke={CHART.muted} />
              <YAxis type="category" dataKey="name" width={128} tick={{ fontSize: 11 }} stroke={CHART.muted} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v ?? 0, 'Leads']} />
              <Bar dataKey="count" fill={CHART.moss} radius={[0, 4, 4, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Setup e MRR fechados" description={wonRow ? `${wonRow.count} ganhos neste recorte` : undefined} loading={revenue.isLoading} error={revenue.error} empty={!revenue.data?.some((r) => r.won)} onRetry={() => revenue.refetch()}>
          <ResponsiveContainer>
            <LineChart data={revenue.data ?? []} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke={CHART.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke={CHART.muted} />
              <YAxis tick={{ fontSize: 11 }} stroke={CHART.muted} tickFormatter={(v) => moneyCompact(v)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [money(Number(v ?? 0)), name === 'setup' ? 'Setup' : 'MRR']} />
              <Line type="monotone" dataKey="setup" stroke={CHART.moss} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="mrr" stroke={CHART.success} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Performance por closer" loading={closers.isLoading} error={closers.error} empty={!closers.data?.length} onRetry={() => closers.refetch()}>
          <ResponsiveContainer>
            <BarChart data={closers.data ?? []} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke={CHART.muted} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke={CHART.muted} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="won" name="Ganhos" fill={CHART.success} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="lost" name="Perdidos" fill={CHART.light} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="open" name="Abertos" fill={CHART.moss} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <Panel>
          <div className="grid gap-6 p-5 sm:grid-cols-2">
            <Breakdown title="Por origem" rows={breakdown.data?.by_source} loading={breakdown.isLoading} label={(k) => SOURCE_LABEL[k as LeadSource] ?? k} />
            <Breakdown title="Por nicho" rows={breakdown.data?.by_niche} loading={breakdown.isLoading} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-[22px] font-semibold tracking-[-0.03em]">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function AlertStat({ label, value, hint, to }: { label: string; value: number; hint: string; to: string }) {
  return (
    <Link to={to} className="rounded-xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-moss-300">
      <p className="flex items-center justify-between text-[12px] text-muted-foreground">
        {label}
        <ArrowUpRight className="size-3.5" aria-hidden />
      </p>
      <p className="tabular mt-1 flex items-center gap-2 text-[22px] font-semibold tracking-[-0.03em]">
        {value}
        {value > 0 && (label.includes('esfri') ? <AlertTriangle className="size-4 text-destructive" /> : <Clock className="size-4 text-warning" />)}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </Link>
  );
}

function Breakdown({
  title,
  rows,
  loading,
  label,
}: {
  title: string;
  rows?: { key: string; leads: number; won: number; conversion: number | null }[];
  loading?: boolean;
  label?: (k: string) => string;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      {loading ? (
        <Skeleton className="mt-3 h-32" />
      ) : !rows?.length ? (
        <p className="mt-3 text-[13px] text-muted-foreground">Nada neste recorte.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.slice(0, 6).map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="truncate">{label?.(r.key) ?? r.key}</span>
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="tabular">{r.leads}</span>
                <Badge variant="outline">{percent(r.conversion)}</Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
