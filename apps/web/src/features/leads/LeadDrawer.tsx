import { useState } from 'react';
import { Dialog as D } from 'radix-ui';
import { toast } from 'sonner';
import {
  Archive,
  ArrowRightLeft,
  CalendarPlus,
  Check,
  Copy,
  FilePlus2,
  FileText,
  Globe,
  Mail,
  MessageCircle,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Phone,
  PhoneCall,
  RotateCcw,
  Sparkles,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';
import {
  ACTIVITY_LABEL,
  followupMessage,
  PRIORITY_LABEL,
  PROPOSAL_LABEL,
  SIZE_LABEL,
  SOURCE_LABEL,
  whatsappLink,
  type LeadSource,
  type TimelineItem,
} from '@kidoo/shared';
import { useAuth } from '@/hooks/useAuth';
import { useLeadDrawer } from '@/hooks/useLeadDrawer';
import { useChangeOwner, useLead, useReactivateLead, useUpdateLead, type LeadDetail } from '@/services/leads';
import { openProposalDoc, useCompleteActivity, useCompleteFollowup, useUsers } from '@/services/operations';
import { cnpj, date, dateTime, money, phone, relativeDay } from '@/lib/format';
import { cn } from '@/lib/utils';
import { SheetContent } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
} from '@/components/ui/menu';
import { ActivityDialog } from '@/features/activities/ActivityDialog';
import { FollowupDialog } from '@/features/followups/FollowupDialog';
import { ProposalDialog } from '@/features/proposals/ProposalDialog';
import { CloseLeadDialog, LoseLeadDialog } from './DealDialogs';
import { LeadFormDialog } from './LeadFormDialog';
import { StagnationMeter, useStagnation } from './Stagnation';

type DialogName = 'log' | 'note' | 'schedule' | 'followup' | 'proposal' | 'close' | 'lose' | 'edit' | 'archive' | null;

export function LeadDrawer() {
  const { leadId, close } = useLeadDrawer();
  return (
    <D.Root open={!!leadId} onOpenChange={(o) => !o && close()}>
      <SheetContent aria-describedby={undefined}>{leadId && <DrawerBody id={leadId} onClose={close} />}</SheetContent>
    </D.Root>
  );
}

function DrawerBody({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading, error, refetch } = useLead(id);
  if (isLoading)
    return (
      <div className="space-y-4 p-6">
        <D.Title className="sr-only">Carregando lead</D.Title>
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  if (error || !data)
    return (
      <div className="p-6">
        <D.Title className="sr-only">Erro ao carregar lead</D.Title>
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    );
  return <Dossier detail={data} onClose={onClose} />;
}

function Dossier({ detail, onClose }: { detail: LeadDetail; onClose: () => void }) {
  const { lead, diagnostics, timeline, proposals, activities, followups } = detail;
  const { profile, can } = useAuth();
  const users = useUsers();
  const changeOwner = useChangeOwner(lead.id);
  const reactivate = useReactivateLead(lead.id);
  const archive = useUpdateLead(lead.id);
  const completeActivity = useCompleteActivity();
  const completeFollowup = useCompleteFollowup();
  const [dialog, setDialog] = useState<DialogName>(null);
  const { level, hours } = useStagnation(lead);
  const diag = diagnostics[0];
  const editable = can('leads.write_any') || lead.owner_id === profile?.id;
  const isOpen = lead.status === 'open';

  const message =
    diag?.opening_hook ??
    followupMessage(lead.last_interaction_at ? 'd1' : 'opening', {
      company_name: lead.company_name,
      contact_name: lead.contact_name,
      sender_name: lead.owner_name ?? profile?.full_name,
      specific_pain: diag?.specific_pain,
      proposed_solution: diag?.proposed_solution,
    });
  const wa = whatsappLink(lead.contact_phone, message);
  const pending = [
    ...activities.filter((a) => a.status === 'pending').map((a) => ({ kind: 'activity' as const, id: a.id, title: a.title, due: a.due_at, label: ACTIVITY_LABEL[a.type] })),
    ...followups.filter((f) => f.status === 'pending').map((f) => ({ kind: 'followup' as const, id: f.id, title: f.title, due: f.due_at, label: 'Follow-up' })),
  ].sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''));

  const copy = async () => {
    await navigator.clipboard.writeText(message);
    toast.success('Mensagem copiada');
  };

  return (
    <>
      <header className="border-b border-border px-5 pt-4 pb-4 md:px-6">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={lead.status} stage={detail.lead.stage_key} />
              {lead.archived_at && <Badge variant="outline">Arquivado</Badge>}
              <Badge variant="outline">Prioridade {PRIORITY_LABEL[lead.priority].toLowerCase()}</Badge>
            </div>
            <D.Title className="mt-2 truncate text-xl font-semibold tracking-[-0.02em]">{lead.company_name}</D.Title>
            <D.Description className="mt-0.5 truncate text-[13px] text-muted-foreground">
              {[lead.niche, lead.size && SIZE_LABEL[lead.size], SOURCE_LABEL[lead.source as LeadSource] ?? lead.source].filter(Boolean).join(' · ')}
            </D.Description>
          </div>
          <D.Close asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Fechar dossiê">
              <X />
            </Button>
          </D.Close>
        </div>

        <dl className="tabular mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label={lead.status === 'won' ? 'Setup contratado' : 'Setup estimado'} value={money(lead.status === 'won' ? lead.closed_setup : lead.estimated_setup)} />
          <Metric label={lead.status === 'won' ? 'MRR contratado' : 'MRR estimado'} value={money(lead.status === 'won' ? lead.closed_mrr : lead.estimated_mrr)} />
          <div>
            <dt className="text-[11px] text-muted-foreground">Última interação</dt>
            <dd className="mt-1">
              {isOpen ? (
                <StagnationMeter level={level} hours={hours} hasInteraction={!!lead.last_interaction_at} />
              ) : (
                <span className="text-[13px]">{relativeDay(lead.last_interaction_at)}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted-foreground">Closer</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-[13px] font-medium">
              <Avatar name={lead.owner_name} className="size-5 text-[9px]" />
              {lead.owner_name ?? 'Sem responsável'}
            </dd>
          </div>
        </dl>

        {editable && (
          <div className="mt-4 flex flex-wrap gap-1.5" role="toolbar" aria-label="Ações rápidas">
            {wa ? (
              <Button size="sm" asChild>
                <a href={wa} target="_blank" rel="noreferrer">
                  <MessageCircle /> WhatsApp
                </a>
              </Button>
            ) : (
              <Tooltip content="Cadastre um telefone com DDD para abrir o WhatsApp">
                <span>
                  <Button size="sm" disabled>
                    <MessageCircle /> WhatsApp
                  </Button>
                </span>
              </Tooltip>
            )}
            <Button size="sm" variant="outline" onClick={copy}>
              <Copy /> Copiar mensagem
            </Button>
            {isOpen && (
              <>
                <Button size="sm" variant="outline" onClick={() => setDialog('log')}>
                  <PhoneCall /> Registrar contato
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDialog('followup')}>
                  <CalendarPlus /> Follow-up
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" aria-label="Mais ações">
                  <MoreHorizontal /> Mais
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onSelect={() => setDialog('note')}>
                  <NotebookPen /> Adicionar anotação
                </DropdownMenuItem>
                {isOpen && (
                  <DropdownMenuItem onSelect={() => setDialog('schedule')}>
                    <CalendarPlus /> Agendar atividade
                  </DropdownMenuItem>
                )}
                {isOpen && (
                  <DropdownMenuItem onSelect={() => setDialog('proposal')}>
                    <FilePlus2 /> Criar proposta
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => setDialog('edit')}>
                  <Pencil /> Editar dados
                </DropdownMenuItem>
                {can('leads.assign') && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Alterar closer</DropdownMenuLabel>
                    {users.data
                      ?.filter((u) => u.id !== lead.owner_id)
                      .map((u) => (
                        <DropdownMenuItem key={u.id} onSelect={() => changeOwner.mutate(u.id)}>
                          <ArrowRightLeft /> {u.full_name}
                        </DropdownMenuItem>
                      ))}
                  </>
                )}
                <DropdownMenuSeparator />
                {isOpen && (
                  <>
                    <DropdownMenuItem onSelect={() => setDialog('close')} className="text-success">
                      <Trophy /> Marcar como ganho
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setDialog('lose')} className="text-destructive">
                      <XCircle /> Marcar como perdido
                    </DropdownMenuItem>
                  </>
                )}
                {lead.status === 'lost' && (
                  <DropdownMenuItem onSelect={() => reactivate.mutate('approach')}>
                    <RotateCcw /> Reativar lead
                  </DropdownMenuItem>
                )}
                {can('leads.archive') && !lead.archived_at && (
                  <DropdownMenuItem onSelect={() => setDialog('archive')}>
                    <Archive /> Arquivar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </header>

      <Tabs defaultValue="dossier" className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border px-5 py-2.5 md:px-6">
          <TabsList>
            <TabsTrigger value="dossier">Dossiê</TabsTrigger>
            <TabsTrigger value="xray">
              <Sparkles /> Raio-X
            </TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
            <TabsTrigger value="proposals">Propostas{proposals.length ? ` (${proposals.length})` : ''}</TabsTrigger>
          </TabsList>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">
          <TabsContent value="dossier" className="space-y-6">
            {lead.status === 'lost' && (
              <div className="rounded-lg bg-destructive-soft px-4 py-3 text-[13px]">
                <p className="font-medium text-destructive">Perdido em {date(lead.lost_at)}</p>
                <p className="mt-0.5 text-moss-800">{lead.lost_reason}</p>
              </div>
            )}
            <section>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Próximas atividades</h3>
              {pending.length ? (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {pending.map((p) => {
                    const overdue = p.due && new Date(p.due) < new Date();
                    return (
                      <li key={`${p.kind}-${p.id}`} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium">{p.title}</p>
                          <p className={cn('text-xs', overdue ? 'text-destructive' : 'text-muted-foreground')}>
                            {p.label} · {overdue ? 'Atrasada · ' : ''}
                            {relativeDay(p.due)}
                          </p>
                        </div>
                        {editable && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              p.kind === 'activity' ? completeActivity.mutate({ id: p.id }) : completeFollowup.mutate({ id: p.id, channel: 'whatsapp' })
                            }
                          >
                            <Check /> Concluir
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[13px] text-muted-foreground">
                  Nenhuma atividade agendada. Agende um follow-up para o lead não esfriar.
                </p>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Dados cadastrais</h3>
              <dl className="grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
                <Info label="Empresa" value={lead.company_name} />
                <Info label="CNPJ" value={cnpj(lead.cnpj)} />
                <Info label="Contato" value={lead.contact_name} />
                <Info label="Cargo" value={lead.contact_role} />
                <Info label="Telefone" value={lead.contact_phone ? phone(lead.contact_phone) : null} icon={Phone} />
                <Info label="E-mail" value={lead.contact_email} icon={Mail} href={lead.contact_email ? `mailto:${lead.contact_email}` : undefined} />
                <Info
                  label="Website"
                  value={lead.website}
                  icon={Globe}
                  href={lead.website ? (lead.website.startsWith('http') ? lead.website : `https://${lead.website}`) : undefined}
                />
                <Info label="Nicho" value={lead.niche} />
                <Info label="Faturamento estimado" value={lead.estimated_monthly_revenue ? `${money(lead.estimated_monthly_revenue)}/mês` : null} />
                <Info label="Porte" value={lead.size ? SIZE_LABEL[lead.size] : null} />
                <Info label="Origem" value={SOURCE_LABEL[lead.source as LeadSource] ?? lead.source} />
                <Info label="Criado em" value={dateTime(lead.created_at)} />
              </dl>
            </section>
          </TabsContent>

          <TabsContent value="xray">
            <XRay diagnostics={diagnostics} />
          </TabsContent>

          <TabsContent value="history">
            <Timeline items={timeline} />
          </TabsContent>

          <TabsContent value="proposals" className="space-y-3">
            {proposals.length ? (
              proposals.map((p) => (
                <article key={p.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[13.5px] font-semibold">{p.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Criada em {date(p.created_at)}
                        {p.valid_until && ` · válida até ${date(`${p.valid_until}T12:00:00`)}`}
                      </p>
                    </div>
                    <ProposalBadge status={p.status} />
                  </div>
                  <p className="tabular mt-3 text-[13px]">
                    Setup <strong>{money(p.setup_value)}</strong> · MRR <strong>{money(p.mrr_value)}</strong>/mês
                  </p>
                  {p.services.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{p.services.join(' · ')}</p>}
                  {p.document_path && (
                    <Button variant="link" size="sm" className="mt-2 h-auto" onClick={() => openProposalDoc(p.id)}>
                      <FileText /> {p.document_name}
                    </Button>
                  )}
                </article>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[13px] text-muted-foreground">
                Nenhuma proposta registrada para este lead.
              </p>
            )}
            {editable && isOpen && (
              <Button variant="outline" size="sm" onClick={() => setDialog('proposal')}>
                <FilePlus2 /> Criar proposta
              </Button>
            )}
          </TabsContent>
        </div>
      </Tabs>

      <ActivityDialog open={dialog === 'log'} onOpenChange={(o) => !o && setDialog(null)} mode="log" leadId={lead.id} />
      <ActivityDialog open={dialog === 'note'} onOpenChange={(o) => !o && setDialog(null)} mode="note" leadId={lead.id} />
      <ActivityDialog open={dialog === 'schedule'} onOpenChange={(o) => !o && setDialog(null)} mode="schedule" leadId={lead.id} />
      <FollowupDialog open={dialog === 'followup'} onOpenChange={(o) => !o && setDialog(null)} leadId={lead.id} />
      <ProposalDialog
        open={dialog === 'proposal'}
        onOpenChange={(o) => !o && setDialog(null)}
        prefill={{ lead_id: lead.id, setup: diag?.suggested_setup ?? lead.estimated_setup, mrr: diag?.suggested_mrr ?? lead.estimated_mrr, services: diag?.proposed_solution }}
      />
      <CloseLeadDialog lead={lead} open={dialog === 'close'} onOpenChange={(o) => !o && setDialog(null)} suggestedServices={proposals[0]?.services.join(', ') || diag?.proposed_solution || ''} />
      <LoseLeadDialog lead={lead} open={dialog === 'lose'} onOpenChange={(o) => !o && setDialog(null)} />
      <LeadFormDialog open={dialog === 'edit'} onOpenChange={(o) => !o && setDialog(null)} lead={lead} />
      <ConfirmDialog
        open={dialog === 'archive'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Arquivar este lead?"
        description="Leads arquivados saem do pipeline, das listas e das métricas. O histórico é preservado e o lead pode ser restaurado."
        confirmLabel="Arquivar"
        onConfirm={() => archive.mutate({ archived: true }, { onSuccess: onClose })}
      />
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-[15px] font-semibold">{value}</dd>
    </div>
  );
}

function Info({ label, value, icon: Icon, href }: { label: string; value: string | null | undefined; icon?: typeof Phone; href?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-1.5 truncate">
        {Icon && value && <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
        {value ? (
          href ? (
            <a href={href} target="_blank" rel="noreferrer" className="truncate underline decoration-moss-300 hover:decoration-moss-800">
              {value}
            </a>
          ) : (
            <span className="truncate">{value}</span>
          )
        ) : (
          <span className="text-muted-foreground">Não informado</span>
        )}
      </dd>
    </div>
  );
}

export function StatusBadge({ status, stage }: { status: string; stage?: string }) {
  if (status === 'won') return <Badge variant="success">Fechado / Ganho</Badge>;
  if (status === 'lost') return <Badge variant="danger">Perdido / Reativação</Badge>;
  const names: Record<string, string> = {
    enriched: 'Leads Enriquecidos',
    approach: 'Abordagem C-Level',
    call_scheduled: 'Call agendada',
    proposal_sent: 'Proposta enviada',
    followup: 'Follow-up ativo',
  };
  return <Badge variant="solid">{names[stage ?? ''] ?? 'Em aberto'}</Badge>;
}

export function ProposalBadge({ status }: { status: keyof typeof PROPOSAL_LABEL }) {
  const variant = { accepted: 'success', rejected: 'danger', expired: 'warning', draft: 'outline', sent: 'default', negotiating: 'default' } as const;
  return <Badge variant={variant[status]}>{PROPOSAL_LABEL[status]}</Badge>;
}

function XRay({ diagnostics }: { diagnostics: LeadDetail['diagnostics'] }) {
  const d = diagnostics[0];
  if (!d)
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted-foreground">
        Este lead ainda não tem diagnóstico. Leads recebidos do Antigravity Engine ou Make.com chegam com o Raio-X preenchido.
      </p>
    );
  const blocks: [string, string | null][] = [
    ['Nicho profundo', d.deep_niche],
    ['Dor específica', d.specific_pain],
    ['Solução arquitetada', d.proposed_solution],
    ['Gancho de abertura', d.opening_hook],
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {d.verified_at ? (
          <Badge variant="success">
            <Check /> Verificado em {date(d.verified_at)}
          </Badge>
        ) : (
          <Badge variant="warning">
            <Sparkles /> Estimativa gerada por IA, não verificada
          </Badge>
        )}
        <span>
          Fonte: {d.source} · {dateTime(d.generated_at)}
        </span>
      </div>
      {blocks.map(([label, text]) => (
        <section key={label}>
          <h3 className="text-xs font-semibold text-muted-foreground">{label}</h3>
          <p className="mt-1 text-[13.5px] leading-relaxed text-pretty">{text ?? <span className="text-muted-foreground">Não informado pelo diagnóstico</span>}</p>
        </section>
      ))}
      <section className="rounded-lg bg-muted px-4 py-3">
        <h3 className="text-xs font-semibold text-muted-foreground">Precificação sugerida</h3>
        <p className="tabular mt-1 text-[15px] font-semibold">
          Setup {money(d.suggested_setup)} · MRR {money(d.suggested_mrr)}/mês
        </p>
      </section>
      {diagnostics.length > 1 && <p className="text-xs text-muted-foreground">{diagnostics.length - 1} diagnóstico(s) anterior(es) preservado(s) no histórico.</p>}
    </div>
  );
}

const DOT: Record<TimelineItem['kind'], string> = {
  created: 'bg-moss-400',
  stage_changed: 'bg-moss-700',
  owner_changed: 'bg-moss-500',
  won: 'bg-success',
  lost: 'bg-destructive',
  reactivated: 'bg-moss-700',
  activity: 'bg-moss-300',
  followup: 'bg-moss-300',
  proposal: 'bg-moss-800',
};

function Timeline({ items }: { items: TimelineItem[] }) {
  if (!items.length) return <p className="text-[13px] text-muted-foreground">Sem registros ainda.</p>;
  return (
    <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-border">
      {items.map((i) => (
        <li key={i.id} className="relative flex gap-3 pl-0">
          <span className={cn('relative z-10 mt-1.5 size-[11px] shrink-0 rounded-full ring-3 ring-white', DOT[i.kind])} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium">{i.title}</p>
            {i.detail && <p className="mt-0.5 text-[13px] text-pretty text-muted-foreground">{i.detail}</p>}
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              {dateTime(i.at)}
              {i.actor_name && ` · ${i.actor_name}`}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
