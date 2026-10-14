import { EmptyState, ErrorState, Panel, PanelHeader } from './common';
import { Skeleton } from './ui/skeleton';
import type { LucideIcon } from 'lucide-react';
import { BarChart3 } from 'lucide-react';

export const CHART = {
  moss: '#353F34',
  deep: '#2A3229',
  mid: '#6e7a69',
  light: '#bcc4b8',
  muted: '#929d8d',
  success: '#2f7a4b',
  grid: '#e3e7e0',
};

export const tooltipStyle = {
  background: '#fff',
  border: '1px solid #e3e7e0',
  borderRadius: 8,
  fontSize: 12,
  color: '#1e241d',
};

export function ChartPanel({
  title,
  description,
  loading,
  error,
  empty,
  emptyIcon = BarChart3,
  emptyTitle = 'Sem dados neste período',
  emptyDescription = 'Ajuste o filtro de datas ou closer para ver o gráfico.',
  onRetry,
  children,
}: {
  title: string;
  description?: string;
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Panel>
      <PanelHeader title={title} description={description} />
      <div className="h-64 px-2 pb-4">
        {error ? (
          <ErrorState error={error} onRetry={onRetry} className="h-full py-0" />
        ) : loading ? (
          <Skeleton className="mx-3 h-full" />
        ) : empty ? (
          <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} className="h-full py-8" />
        ) : (
          children
        )}
      </div>
    </Panel>
  );
}
