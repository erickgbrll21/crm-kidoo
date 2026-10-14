import { Search } from 'lucide-react';
import { PRIORITIES, PRIORITY_LABEL } from '@kidoo/shared';
import { useUsers } from '@/services/operations';
import type { LeadFilters as Filters } from '@/services/leads';
import { Input, NativeSelect } from '@/components/ui/input';
import { NICHES } from './LeadFormDialog';

export function LeadFilters({
  value,
  onChange,
  sortable = true,
}: {
  value: Filters;
  onChange: (f: Filters) => void;
  sortable?: boolean;
}) {
  const users = useUsers();
  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch, page: 1 });
  return (
    <div className="flex flex-wrap items-center gap-2" role="search" aria-label="Filtros de leads">
      <div className="relative w-full sm:w-60">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={value.search ?? ''}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Buscar empresa"
          aria-label="Buscar empresa"
          className="pl-8"
        />
      </div>
      <NativeSelect aria-label="Closer" value={value.owner_id ?? ''} onChange={(e) => set({ owner_id: e.target.value || undefined })} className="w-[calc(50%-4px)] sm:w-40">
        <option value="">Todos os closers</option>
        {users.data?.map((u) => (
          <option key={u.id} value={u.id}>
            {u.full_name}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect aria-label="Nicho" value={value.niche ?? ''} onChange={(e) => set({ niche: e.target.value || undefined })} className="w-[calc(50%-4px)] sm:w-44">
        <option value="">Todos os nichos</option>
        {NICHES.map((n) => (
          <option key={n}>{n}</option>
        ))}
      </NativeSelect>
      <NativeSelect aria-label="Prioridade" value={value.priority ?? ''} onChange={(e) => set({ priority: e.target.value || undefined })} className="w-[calc(50%-4px)] sm:w-36">
        <option value="">Toda prioridade</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABEL[p]}
          </option>
        ))}
      </NativeSelect>
      {sortable && (
        <NativeSelect aria-label="Ordenação" value={value.sort ?? 'created_at'} onChange={(e) => set({ sort: e.target.value as Filters['sort'] })} className="w-[calc(50%-4px)] sm:w-48">
          <option value="created_at">Mais recentes</option>
          <option value="value">Maior valor (MRR)</option>
          <option value="last_interaction">Mais tempo sem contato</option>
        </NativeSelect>
      )}
    </div>
  );
}
