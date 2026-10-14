import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';

const TONES = ['bg-moss-800 text-white', 'bg-moss-200 text-moss-900', 'bg-moss-500 text-white', 'bg-moss-100 text-moss-800 ring-1 ring-moss-300'];

/** Tom estável por pessoa para facilitar a leitura do responsável nos cards. */
const tone = (seed: string) => TONES[[...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length]!;

export function Avatar({ name, className }: { name: string | null | undefined; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-flex size-6 shrink-0 select-none items-center justify-center rounded-full text-[10px] font-semibold', tone(name ?? '?'), className)}
    >
      {initials(name)}
    </span>
  );
}
