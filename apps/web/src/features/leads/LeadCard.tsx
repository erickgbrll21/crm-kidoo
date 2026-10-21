import { forwardRef } from 'react';
import { CalendarClock, CircleAlert } from 'lucide-react';
import { PRIORITY_LABEL, SIZE_LABEL, type Lead } from '@kidoo/shared';
import { money, relativeDay } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { StagnationMeter, useStagnation } from './Stagnation';

const PRIORITY_DOT = { high: 'bg-destructive', medium: 'bg-warning', low: 'bg-moss-300' } as const;

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  lead: Lead;
  dragging?: boolean;
  overlay?: boolean;
}

export const LeadCard = forwardRef<HTMLDivElement, Props>(function LeadCard({ lead, dragging, overlay, className, ...props }, ref) {
  const { level, hours } = useStagnation(lead);
  const won = lead.status === 'won';
  const cold = level === 'cold';
  const scheduled = !!lead.next_activity_at && level === 'normal' && hours > 24;
  return (
    <div
      ref={ref}
      {...props}
      className={cn(
        'group relative cursor-grab touch-manipulation rounded-lg border bg-white p-3 text-left transition-[border-color,box-shadow,opacity] duration-150 select-none active:cursor-grabbing',
        cold ? 'border-destructive/35 bg-destructive-soft/50 hover:border-destructive/55' : 'border-border hover:border-moss-300',
        dragging && 'opacity-40',
        overlay && 'rotate-[1.5deg] cursor-grabbing shadow-lift',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold tracking-[-0.005em]">{lead.company_name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[lead.contact_name, lead.contact_role].filter(Boolean).join(' · ') || 'Contato não informado'}
          </p>
        </div>
        <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', PRIORITY_DOT[lead.priority])} title={`Prioridade ${PRIORITY_LABEL[lead.priority].toLowerCase()}`}>
          <span className="sr-only">Prioridade {PRIORITY_LABEL[lead.priority]}</span>
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {lead.niche && <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-moss-700">{lead.niche}</span>}
        {lead.size && <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-moss-700">{SIZE_LABEL[lead.size]}</span>}
      </div>

      <dl className="tabular mt-2.5 grid grid-cols-2 gap-2 border-t border-dashed border-border pt-2.5">
        <div>
          <dt className="text-[10.5px] text-muted-foreground">{won ? 'Setup fechado' : 'Setup est.'}</dt>
          <dd className="text-[13px] font-semibold">{money(won ? lead.closed_setup : lead.estimated_setup)}</dd>
        </div>
        <div>
          <dt className="text-[10.5px] text-muted-foreground">{won ? 'MRR contratado' : 'MRR est.'}</dt>
          <dd className="text-[13px] font-semibold">{money(won ? lead.closed_mrr : lead.estimated_mrr)}</dd>
        </div>
      </dl>

      {!won && (
        <p className="mt-2 flex items-center gap-1.5 truncate text-[11.5px] text-muted-foreground">
          {lead.overdue_count ? (
            <>
              <CircleAlert className="size-3.5 shrink-0 text-destructive" aria-hidden />
              <span className="text-destructive">{lead.overdue_count} atividade(s) atrasada(s)</span>
            </>
          ) : lead.next_activity_at ? (
            <>
              <CalendarClock className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">
                {relativeDay(lead.next_activity_at)} · {lead.next_activity_title}
              </span>
            </>
          ) : (
            <>
              <CalendarClock className="size-3.5 shrink-0 text-moss-300" aria-hidden />
              Sem próxima atividade
            </>
          )}
        </p>
      )}

      {!won && lead.next_activity_url ? (
        <a
          href={lead.next_activity_url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex text-[11.5px] font-medium text-moss-800 underline underline-offset-2"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          Link da reunião
        </a>
      ) : null}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        {won ? (
          <span className="text-[11.5px] font-medium text-success">Contrato fechado</span>
        ) : (
          <StagnationMeter level={level} hours={hours} hasInteraction={!!lead.last_interaction_at} scheduled={scheduled} />
        )}
        <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <span className="truncate">{lead.owner_name?.split(' ')[0] ?? 'Sem closer'}</span>
          <Avatar name={lead.owner_name ?? '?'} className="size-5 text-[9px]" />
        </span>
      </div>
    </div>
  );
});
