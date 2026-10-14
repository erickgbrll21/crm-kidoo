import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const brlCompact = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });

export const money = (v: number | string | null | undefined) => (v == null || v === '' ? '—' : brl.format(Number(v)));
export const moneyCompact = (v: number | null | undefined) => (v == null ? '—' : brlCompact.format(v));
export const percent = (v: number | null | undefined) =>
  v == null ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export const date = (iso: string | null | undefined, pattern = "dd/MM/yyyy") => (iso ? format(new Date(iso), pattern, { locale: ptBR }) : '—');
export const dateTime = (iso: string | null | undefined) => date(iso, "dd/MM/yyyy 'às' HH:mm");

export function relativeDay(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  const time = format(d, 'HH:mm');
  if (isToday(d)) return `Hoje, ${time}`;
  if (isTomorrow(d)) return `Amanhã, ${time}`;
  if (isYesterday(d)) return `Ontem, ${time}`;
  return format(d, "dd MMM, HH:mm", { locale: ptBR });
}

export const ago = (iso: string | null | undefined) =>
  iso ? formatDistanceToNowStrict(new Date(iso), { locale: ptBR, addSuffix: true }) : 'sem contato';

export function hoursLabel(hours: number) {
  if (hours < 1) return 'há menos de 1h';
  if (hours < 48) return `há ${Math.floor(hours)}h`;
  return `há ${Math.floor(hours / 24)} dias`;
}

export function phone(v: string | null | undefined) {
  const d = (v ?? '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v ?? '—';
}

export function cnpj(v: string | null | undefined) {
  const d = (v ?? '').replace(/\D/g, '');
  if (d.length !== 14) return v ?? '—';
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export const initials = (name: string | null | undefined) =>
  (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

/** Converte datetime-local (horário local) em ISO com offset. */
export const localInputToIso = (v: string) => (v ? new Date(v).toISOString() : null);
export const isoToLocalInput = (iso: string | null | undefined) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : '');
