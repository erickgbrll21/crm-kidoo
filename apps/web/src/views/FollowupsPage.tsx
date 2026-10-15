import { useState } from 'react';
import { useQueryPatch } from '@/hooks/useQueryPatch';
import { addDays } from 'date-fns';
import { toast } from 'sonner';
import { Check, Copy, MessageCircle, MessagesSquare, Pause, Pencil, Plus } from 'lucide-react';
import { followupMessage, whatsappLink } from '@kidoo/shared';
import { useAuth } from '@/hooks/useAuth';
import { useLeadDrawer } from '@/hooks/useLeadDrawer';
import { useCompleteFollowup, useFollowups, useUpdateFollowup, useUsers, type FollowupRow } from '@/services/operations';
import { relativeDay } from '@/lib/format';
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/common';
import { Button } from '@/components/ui/button';
import { NativeSelect, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/menu';
import { FollowupDialog } from '@/features/followups/FollowupDialog';

type View = 'overdue' | 'today' | 'upcoming' | 'all';

export default function FollowupsPage() {
  const [params, setParams] = useQueryPatch();
  const view = (params.get('view') as View) || 'overdue';
  const [owner, setOwner] = useState('');
  const [composeLead, setComposeLead] = useState<string | null>(null);
  const users = useUsers();
  const { data, isLoading, error, refetch } = useFollowups({ view, owner_id: owner || undefined, status: 'pending' });
  const items = data?.data ?? [];

  return (
    <div className="space-y-5 px-4 py-5 md:px-6">
      <PageHeader
        title="Follow-ups"
        description="Cadência D+1 a D+8. Abrir o WhatsApp não registra o envio — confirme o contato depois."
      />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={view}
          onValueChange={(v) =>
            setParams((p) => {
              p.set('view', v);
              return p;
            })
          }
        >
          <TabsList>
            <TabsTrigger value="overdue">Vencidos</TabsTrigger>
            <TabsTrigger value="today">Hoje</TabsTrigger>
            <TabsTrigger value="upcoming">Próximos</TabsTrigger>
            <TabsTrigger value="all">Todos pendentes</TabsTrigger>
          </TabsList>
        </Tabs>
        <NativeSelect aria-label="Closer" value={owner} onChange={(e) => setOwner(e.target.value)} className="w-44">
          <option value="">Todos os closers</option>
          {users.data?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name}
            </option>
          ))}
        </NativeSelect>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : !items.length ? (
        <Panel>
          <EmptyState
            icon={MessagesSquare}
            title={view === 'overdue' ? 'Nenhum follow-up vencido' : 'Nada na cadência neste recorte'}
            description="Abra um lead no pipeline e agende a cadência a partir da call diagnóstica."
          />
        </Panel>
      ) : (
        <div className="space-y-3">
          {items.map((f) => (
            <FollowupCard key={f.id} row={f} onCadence={() => f.lead_id && setComposeLead(f.lead_id)} />
          ))}
        </div>
      )}
      {composeLead && <FollowupDialog leadId={composeLead} open onOpenChange={(o) => !o && setComposeLead(null)} />}
    </div>
  );
}

function FollowupCard({ row, onCadence }: { row: FollowupRow; onCadence: () => void }) {
  const { profile } = useAuth();
  const { open } = useLeadDrawer();
  const update = useUpdateFollowup();
  const complete = useCompleteFollowup();
  const [editing, setEditing] = useState(false);
  const diag = row.lead?.lead_diagnostics?.[0];
  const generated = followupMessage(row.step, {
    company_name: row.lead?.company_name ?? '',
    contact_name: row.lead?.contact_name,
    sender_name: profile?.full_name,
    specific_pain: diag?.specific_pain,
    proposed_solution: diag?.proposed_solution,
    opening_hook: diag?.opening_hook,
  });
  const [text, setText] = useState(row.message || generated);
  const wa = whatsappLink(row.lead?.contact_phone, text);
  const overdue = new Date(row.due_at).getTime() < Date.now();

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    toast.success('Mensagem copiada. Lembre de registrar o contato depois do envio.');
  };

  return (
    <Panel className="p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button className="min-w-0 text-left" onClick={() => open(row.lead_id)}>
          <p className="text-sm font-semibold">{row.lead?.company_name}</p>
          <p className="text-xs text-muted-foreground">
            {row.title} · {row.lead?.contact_name ?? 'Sem contato'} · {relativeDay(row.due_at)}
          </p>
        </button>
        <Badge variant={overdue ? 'danger' : 'default'}>{overdue ? 'Vencido' : 'Pendente'}</Badge>
      </div>
      {editing ? (
        <Textarea className="mt-3" value={text} onChange={(e) => setText(e.target.value)} rows={4} />
      ) : (
        <p className="mt-3 text-[13.5px] leading-relaxed text-pretty">{text}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={copy}>
          <Copy /> Copiar
        </Button>
        {wa && (
          <Button size="sm" variant="outline" asChild>
            <a href={wa} target="_blank" rel="noreferrer">
              <MessageCircle /> WhatsApp
            </a>
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (editing) update.mutate({ id: row.id, message: text });
            setEditing((v) => !v);
          }}
        >
          <Pencil /> {editing ? 'Salvar texto' : 'Editar'}
        </Button>
        <Button size="sm" loading={complete.isPending} onClick={() => complete.mutate({ id: row.id, channel: 'whatsapp' })}>
          <Check /> Registrar contato
        </Button>
        <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: row.id, due_at: addDays(new Date(), 1).toISOString() })}>
          Adiar 1 dia
        </Button>
        <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: row.id, status: 'paused' })}>
          <Pause /> Pausar
        </Button>
        <Button size="sm" variant="ghost" onClick={onCadence}>
          <Plus /> Nova cadência
        </Button>
      </div>
    </Panel>
  );
}
