import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { QueryKey } from '@tanstack/react-query';
import type { Lead, PipelineStage, StageKey } from '@kidoo/shared';
import { useMoveStage } from '@/services/leads';
import { useLeadDrawer } from '@/hooks/useLeadDrawer';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { LeadCard } from './LeadCard';
import { CloseLeadDialog } from './DealDialogs';

function DraggableCard({ lead, disabled }: { lead: Lead; disabled: boolean }) {
  const { open } = useLeadDrawer();
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: lead.id, data: { lead }, disabled });
  return (
    <LeadCard
      ref={setNodeRef}
      lead={lead}
      dragging={isDragging}
      {...attributes}
      {...listeners}
      aria-roledescription="card arrastável"
      aria-label={`${lead.company_name}. Enter abre o dossiê; espaço inicia o arraste.`}
      onClick={() => open(lead.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') open(lead.id);
        listeners?.onKeyDown?.(e);
      }}
      className={cn(disabled && 'cursor-pointer')}
    />
  );
}

function Column({ stage, leads, children }: { stage: PipelineStage; leads: Lead[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });
  const won = stage.key === 'won';
  const mrr = leads.reduce((a, l) => a + Number((won ? l.closed_mrr : l.estimated_mrr) ?? 0), 0);
  const setup = leads.reduce((a, l) => a + Number((won ? l.closed_setup : l.estimated_setup) ?? 0), 0);
  return (
    <section
      aria-label={stage.name}
      className={cn(
        'flex w-[284px] shrink-0 snap-start flex-col rounded-xl bg-muted transition-[background-color,box-shadow] duration-150 md:w-[300px]',
        isOver && 'bg-moss-100 shadow-[inset_0_0_0_1.5px_var(--color-moss-700)]',
      )}
    >
      <header className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-[13px] font-semibold">{stage.name}</h2>
          <span className="tabular rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-moss-800">{leads.length}</span>
        </div>
        <p className="tabular mt-0.5 text-[11.5px] text-muted-foreground">
          {money(setup)} setup · {money(mrr)}/mês{won ? ' · 30 dias' : ''}
        </p>
      </header>
      <div ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {children}
        {!leads.length && (
          <p className="m-1 rounded-lg border border-dashed border-moss-200 px-3 py-6 text-center text-xs text-muted-foreground">
            {won ? 'Arraste um lead para cá para registrar o ganho' : 'Nenhum lead nesta etapa'}
          </p>
        )}
      </div>
    </section>
  );
}

export function KanbanBoard({
  stages,
  leads,
  listKey,
  canEdit,
}: {
  stages: PipelineStage[];
  leads: Lead[];
  listKey: QueryKey;
  canEdit: (lead: Lead) => boolean;
}) {
  const move = useMoveStage(listKey);
  const [active, setActive] = useState<Lead | null>(null);
  const [closing, setClosing] = useState<Lead | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const byStage = useMemo(() => {
    const cutoff = Date.now() - 30 * 86_400_000;
    const map = new Map<string, Lead[]>(stages.map((s) => [s.key, []]));
    for (const l of leads) {
      if (l.status === 'won') {
        if (l.won_at && new Date(l.won_at).getTime() >= cutoff) map.get('won')?.push(l);
      } else if (l.status === 'open') map.get(l.stage_key ?? '')?.push(l);
    }
    return map;
  }, [leads, stages]);

  const onDragStart = (e: DragStartEvent) => setActive((e.active.data.current?.lead as Lead) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const lead = e.active.data.current?.lead as Lead | undefined;
    const target = e.over?.id as StageKey | undefined;
    if (!lead || !target || target === lead.stage_key || lead.status !== 'open') return;
    if (target === 'won') return setClosing(lead);
    const stage = stages.find((s) => s.key === target);
    if (stage) move.mutate({ id: lead.id, stage: target, stageId: stage.id });
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActive(null)}
        accessibility={{
          announcements: {
            onDragStart: () => 'Lead selecionado. Use as setas para escolher a etapa e espaço para soltar.',
            onDragOver: ({ over }) => (over ? `Sobre ${stages.find((s) => s.key === over.id)?.name}` : 'Fora de uma etapa'),
            onDragEnd: ({ over }) => (over ? `Movido para ${stages.find((s) => s.key === over.id)?.name}` : 'Movimento cancelado'),
            onDragCancel: () => 'Movimento cancelado',
          },
        }}
      >
        <div className="flex h-full snap-x snap-mandatory gap-3 overflow-x-auto pb-3 md:snap-none">
          {stages.map((s) => {
            const items = byStage.get(s.key) ?? [];
            return (
              <Column key={s.id} stage={s} leads={items}>
                {items.map((l) => (
                  <DraggableCard key={l.id} lead={l} disabled={l.status !== 'open' || !canEdit(l)} />
                ))}
              </Column>
            );
          })}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>
          {active ? <LeadCard lead={active} overlay className="w-[276px] md:w-[292px]" /> : null}
        </DragOverlay>
      </DndContext>
      {closing && <CloseLeadDialog lead={closing} open onOpenChange={(o) => !o && setClosing(null)} />}
    </>
  );
}
