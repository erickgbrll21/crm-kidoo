import { endOfDay, format, startOfDay, startOfMonth, subDays } from 'date-fns';
import { useUsers } from '@/services/operations';
import type { Period } from '@/services/insights';
import { Input, NativeSelect } from './ui/input';

export type Preset = 'today' | '7d' | '30d' | 'month' | 'custom';

export const PRESET_LABEL: Record<Preset, string> = {
  today: 'Hoje',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  month: 'Mês atual',
  custom: 'Período personalizado',
};

export interface PeriodState {
  preset: Preset;
  from: string;
  to: string;
  owner_id?: string;
}

export function periodFromPreset(preset: Preset, custom?: { from: string; to: string }): { from: string; to: string } {
  const now = new Date();
  const to = endOfDay(now);
  if (preset === 'today') return { from: startOfDay(now).toISOString(), to: to.toISOString() };
  if (preset === '7d') return { from: startOfDay(subDays(now, 6)).toISOString(), to: to.toISOString() };
  if (preset === 'month') return { from: startOfMonth(now).toISOString(), to: to.toISOString() };
  if (preset === 'custom' && custom?.from && custom.to)
    return { from: startOfDay(new Date(`${custom.from}T00:00:00`)).toISOString(), to: endOfDay(new Date(`${custom.to}T00:00:00`)).toISOString() };
  return { from: startOfDay(subDays(now, 29)).toISOString(), to: to.toISOString() };
}

export const toPeriod = (s: PeriodState): Period => ({ from: s.from, to: s.to, owner_id: s.owner_id });

export function PeriodFilter({ value, onChange, allowOwner = true }: { value: PeriodState; onChange: (v: PeriodState) => void; allowOwner?: boolean }) {
  const users = useUsers();
  const day = (iso: string) => format(new Date(iso), 'yyyy-MM-dd');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        aria-label="Período"
        value={value.preset}
        onChange={(e) => {
          const preset = e.target.value as Preset;
          onChange({ ...value, preset, ...(preset === 'custom' ? {} : periodFromPreset(preset)) });
        }}
        className="w-44"
      >
        {(Object.keys(PRESET_LABEL) as Preset[]).map((p) => (
          <option key={p} value={p}>
            {PRESET_LABEL[p]}
          </option>
        ))}
      </NativeSelect>
      {value.preset === 'custom' && (
        <>
          <Input
            type="date"
            aria-label="Data inicial"
            className="w-38"
            value={day(value.from)}
            max={day(value.to)}
            onChange={(e) => e.target.value && onChange({ ...value, ...periodFromPreset('custom', { from: e.target.value, to: day(value.to) }) })}
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            aria-label="Data final"
            className="w-38"
            value={day(value.to)}
            min={day(value.from)}
            onChange={(e) => e.target.value && onChange({ ...value, ...periodFromPreset('custom', { from: day(value.from), to: e.target.value }) })}
          />
        </>
      )}
      {allowOwner && (
        <NativeSelect aria-label="Closer" value={value.owner_id ?? ''} onChange={(e) => onChange({ ...value, owner_id: e.target.value || undefined })} className="w-44">
          <option value="">Todos os closers</option>
          {users.data?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name}
            </option>
          ))}
        </NativeSelect>
      )}
    </div>
  );
}
