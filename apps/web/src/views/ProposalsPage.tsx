import { useState } from 'react';
import { FileText, Paperclip, Plus } from 'lucide-react';
import { PROPOSAL_LABEL, PROPOSAL_STATUSES, type Proposal, type ProposalStatus } from '@kidoo/shared';
import { useLeadDrawer } from '@/hooks/useLeadDrawer';
import { openProposalDoc, useProposals, useUsers } from '@/services/operations';
import { date, money } from '@/lib/format';
import { EmptyState, ErrorState, PageHeader, Panel } from '@/components/common';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ProposalDialog } from '@/features/proposals/ProposalDialog';
import { ProposalBadge } from '@/features/leads/LeadDrawer';

export default function ProposalsPage() {
  const [status, setStatus] = useState('all');
  const [owner, setOwner] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Proposal | null>(null);
  const users = useUsers();
  const { open } = useLeadDrawer();
  const { data, isLoading, error, refetch } = useProposals({ status, owner_id: owner || undefined });
  const items = data?.data ?? [];

  return (
    <div className="space-y-5 px-4 py-5 md:px-6">
      <PageHeader
        title="Propostas"
        description="Aceitar uma proposta não fecha o contrato. O ganho é registrado no pipeline, com Setup e MRR contratados."
        actions={
          <Button onClick={() => setOpenForm(true)}>
            <Plus /> Nova proposta
          </Button>
        }
      />
      <div className="flex flex-wrap gap-2">
        <NativeSelect aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
          <option value="all">Todos os status</option>
          {PROPOSAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PROPOSAL_LABEL[s]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Closer" value={owner} onChange={(e) => setOwner(e.target.value)} className="w-44">
          <option value="">Todos os closers</option>
          {users.data?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <Panel className="overflow-hidden">
        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !items.length ? (
          <EmptyState icon={FileText} title="Nenhuma proposta" description="Crie a proposta a partir do dossiê, com Setup, MRR e validade." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead className="border-b border-border bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Proposta</th>
                  <th className="px-3 py-2.5 font-medium">Lead</th>
                  <th className="px-3 py-2.5 text-right font-medium">Setup</th>
                  <th className="px-3 py-2.5 text-right font-medium">MRR</th>
                  <th className="px-3 py-2.5 font-medium">Validade</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/60">
                    <td className="px-4 py-2.5">
                      <button className="text-left font-medium hover:underline" onClick={() => setEditing(p)}>
                        {p.title}
                      </button>
                      <p className="text-xs text-muted-foreground">{p.services.join(' · ') || 'Sem serviços listados'}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <button className="hover:underline" onClick={() => open(p.lead_id)}>
                        {p.lead?.company_name ?? '—'}
                      </button>
                    </td>
                    <td className="tabular px-3 py-2.5 text-right">{money(p.setup_value)}</td>
                    <td className="tabular px-3 py-2.5 text-right">{money(p.mrr_value)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{date(p.valid_until)}</td>
                    <td className="px-3 py-2.5">
                      <ProposalBadge status={p.status as ProposalStatus} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {p.document_path && (
                        <Button size="sm" variant="ghost" onClick={() => openProposalDoc(p.id)}>
                          <Paperclip /> Anexo
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <ProposalDialog open={openForm} onOpenChange={setOpenForm} />
      {editing && <ProposalDialog open onOpenChange={(o) => !o && setEditing(null)} proposal={editing} />}
    </div>
  );
}
