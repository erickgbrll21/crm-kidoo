import { useState } from 'react';
import { Handshake, Plus } from 'lucide-react';
import { ONBOARDING_LABEL, ONBOARDING_STAGES, type OnboardingStage } from '@kidoo/shared';
import { useLeadDrawer } from '@/hooks/useLeadDrawer';
import { useAddTask, useClients, useToggleTask, useUpdateClient, type ClientRow } from '@/services/insights';
import { useUsers } from '@/services/operations';
import { date, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export default function ClientsPage() {
  const { data, isLoading, error, refetch } = useClients();
  const { open } = useLeadDrawer();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-5 px-4 py-5 md:px-6">
      <PageHeader
        title="Clientes e onboarding"
        description="Separado do pipeline comercial. O negócio original continua no histórico do lead."
      />
      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-64" />
      ) : !data?.length ? (
        <Panel>
          <EmptyState
            icon={Handshake}
            title="Nenhum cliente ainda"
            description="Ao marcar um negócio como ganho, o cadastro de cliente e as etapas de implantação são criados automaticamente."
          />
        </Panel>
      ) : (
        <div className="space-y-3">
          {data.map((c) => (
            <ClientCard key={c.id} client={c} expanded={openId === c.id} onToggle={() => setOpenId(openId === c.id ? null : c.id)} onLead={() => open(c.lead_id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClientCard({ client, expanded, onToggle, onLead }: { client: ClientRow; expanded: boolean; onToggle: () => void; onLead: () => void }) {
  const update = useUpdateClient();
  const toggle = useToggleTask();
  const add = useAddTask();
  const users = useUsers();
  const [title, setTitle] = useState('');
  const done = client.onboarding_tasks.filter((t) => t.status === 'done').length;
  const total = client.onboarding_tasks.length;

  return (
    <Panel>
      <button onClick={onToggle} className="flex w-full flex-wrap items-start justify-between gap-3 px-5 py-4 text-left">
        <div>
          <p className="text-sm font-semibold">{client.company_name}</p>
          <p className="text-xs text-muted-foreground">
            Setup {money(client.setup_value)} · MRR {money(client.mrr_value)} · início {date(client.start_date)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={client.status === 'active' ? 'success' : client.status === 'paused' ? 'warning' : 'danger'}>
            {client.status === 'active' ? 'Ativo' : client.status === 'paused' ? 'Pausado' : 'Churn'}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {done}/{total} tarefas
          </span>
        </div>
      </button>
      <div className="px-5 pb-3">
        <ol className="flex flex-wrap gap-1.5">
          {ONBOARDING_STAGES.map((s, i) => {
            const current = ONBOARDING_STAGES.indexOf(client.onboarding_stage);
            return (
              <li key={s}>
                <button
                  onClick={() => update.mutate({ id: client.id, onboarding_stage: s })}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px]',
                    i <= current ? 'bg-moss-800 text-white' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {i + 1}. {ONBOARDING_LABEL[s]}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      {expanded && (
        <div className="space-y-3 border-t border-border px-5 py-4">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <button className="text-moss-800 hover:underline" onClick={onLead}>
              Abrir negócio original
            </button>
            <span className="text-muted-foreground">·</span>
            <span>Técnico: {client.tech_owner?.full_name ?? 'não definido'}</span>
            <NativeSelect
              aria-label="Responsável técnico"
              className="w-48"
              value={client.tech_owner_id ?? ''}
              onChange={(e) => update.mutate({ id: client.id, tech_owner_id: e.target.value || null })}
            >
              <option value="">Sem responsável técnico</option>
              {users.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {client.onboarding_tasks
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
                  <input
                    type="checkbox"
                    checked={t.status === 'done'}
                    onChange={(e) => toggle.mutate({ id: t.id, done: e.target.checked })}
                    className="size-4 accent-moss-800"
                    aria-label={t.title}
                  />
                  <span className={cn('flex-1', t.status === 'done' && 'text-muted-foreground line-through')}>{t.title}</span>
                  <span className="text-xs text-muted-foreground">{ONBOARDING_LABEL[t.stage]}</span>
                </li>
              ))}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) return;
              add.mutate({ clientId: client.id, stage: client.onboarding_stage as OnboardingStage, title: title.trim() });
              setTitle('');
            }}
          >
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nova tarefa de implantação" />
            <Button type="submit" size="sm" variant="outline">
              <Plus /> Adicionar
            </Button>
          </form>
        </div>
      )}
    </Panel>
  );
}
