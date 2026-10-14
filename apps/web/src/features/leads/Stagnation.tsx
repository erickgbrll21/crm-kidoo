import { DEFAULT_SETTINGS, stagnationLevel, type Lead, type StagnationLevel } from '@kidoo/shared';
import { useSettings } from '@/services/operations';
import { hoursLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

export function useStagnation(lead: Pick<Lead, 'last_interaction_at' | 'created_at' | 'next_activity_at' | 'status'>) {
  const { data } = useSettings();
  return stagnationLevel(lead, data?.stagnation ?? DEFAULT_SETTINGS.stagnation);
}

const TONE: Record<StagnationLevel, { bar: string; text: string; label: string }> = {
  normal: { bar: 'bg-moss-700', text: 'text-muted-foreground', label: 'Em dia' },
  warning: { bar: 'bg-warning', text: 'text-warning', label: 'Atenção' },
  cold: { bar: 'bg-destructive', text: 'text-destructive', label: 'Lead esfriando' },
};
const FILLED: Record<StagnationLevel, number> = { normal: 1, warning: 2, cold: 3 };

/**
 * Termômetro de três segmentos: cada segmento é uma faixa (≤24h, 24–48h, >48h)
 * contada desde a última interação comercial real.
 */
export function StagnationMeter({
  level,
  hours,
  hasInteraction,
  scheduled,
  className,
}: {
  level: StagnationLevel;
  hours: number;
  hasInteraction: boolean;
  scheduled?: boolean;
  className?: string;
}) {
  const t = TONE[level];
  const text = scheduled ? 'Agendado' : level === 'cold' ? t.label : hasInteraction ? hoursLabel(hours) : `Sem contato ${hoursLabel(hours)}`;
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-[11.5px] font-medium', t.text, className)}
      title={`${t.label}: última interação ${hoursLabel(hours)}`}
    >
      <span className="flex items-end gap-[2px]" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn('w-[3px] rounded-full transition-colors', i < FILLED[level] ? t.bar : 'bg-moss-200')}
            style={{ height: 6 + i * 3 }}
          />
        ))}
      </span>
      <span className="sr-only">{t.label}. </span>
      {text}
    </span>
  );
}
