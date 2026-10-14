import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { addDays, format } from 'date-fns';
import { PROPOSAL_LABEL, PROPOSAL_STATUSES, type Proposal, type ProposalStatus } from '@kidoo/shared';
import { useCreateProposal, useUpdateProposal, useUploadProposalDoc } from '@/services/operations';
import { useLeads } from '@/services/leads';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const schema = z.object({
  lead_id: z.string().min(1, 'Selecione o lead'),
  title: z.string().trim().min(2, 'Informe o título'),
  description: z.string(),
  services: z.string(),
  setup_value: z.string().refine((v) => v !== '' && Number(v) >= 0, 'Informe o Setup'),
  mrr_value: z.string().refine((v) => v !== '' && Number(v) >= 0, 'Informe o MRR'),
  implementation_days: z.string(),
  valid_until: z.string(),
  status: z.enum(PROPOSAL_STATUSES),
});
type Values = z.infer<typeof schema>;

export interface ProposalPrefill {
  lead_id: string;
  setup?: number | null;
  mrr?: number | null;
  services?: string | null;
}

export function ProposalDialog({
  open,
  onOpenChange,
  proposal,
  prefill,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  proposal?: Proposal;
  prefill?: ProposalPrefill;
}) {
  const create = useCreateProposal();
  const update = useUpdateProposal();
  const upload = useUploadProposalDoc();
  const leads = useLeads({ status: 'open', page_size: 500 });
  const [file, setFile] = useState<File | null>(null);
  const { register, handleSubmit, reset, formState } = useForm<Values>({ resolver: zodResolver(schema) });
  const e = formState.errors;

  useEffect(() => {
    if (!open) return;
    setFile(null);
    reset({
      lead_id: proposal?.lead_id ?? prefill?.lead_id ?? '',
      title: proposal?.title ?? 'Proposta comercial Kidoo Hub',
      description: proposal?.description ?? '',
      services: proposal?.services.join(', ') ?? prefill?.services ?? '',
      setup_value: (proposal?.setup_value ?? prefill?.setup)?.toString() ?? '',
      mrr_value: (proposal?.mrr_value ?? prefill?.mrr)?.toString() ?? '',
      implementation_days: proposal?.implementation_days?.toString() ?? '30',
      valid_until: proposal?.valid_until ?? format(addDays(new Date(), 15), 'yyyy-MM-dd'),
      status: proposal?.status ?? 'draft',
    });
  }, [open, proposal, prefill, reset]);

  const onSubmit = handleSubmit(async (v) => {
    const body = {
      title: v.title,
      description: v.description || null,
      services: v.services.split(',').map((s) => s.trim()).filter(Boolean),
      setup_value: Number(v.setup_value),
      mrr_value: Number(v.mrr_value),
      implementation_days: v.implementation_days ? Number(v.implementation_days) : null,
      valid_until: v.valid_until || null,
      status: v.status as ProposalStatus,
    };
    try {
      const saved = proposal ? await update.mutateAsync({ id: proposal.id, ...body }) : await create.mutateAsync({ lead_id: v.lead_id, ...body });
      if (file) await upload.mutateAsync({ id: saved.id, file });
      onOpenChange(false);
    } catch {
      /* toast exibido pela mutation */
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader
          title={proposal ? 'Editar proposta' : 'Nova proposta'}
          description="Aceitar uma proposta não fecha o negócio: o ganho é registrado no lead após o contrato assinado."
        />
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            {!proposal && !prefill?.lead_id && (
              <Field label="Lead" htmlFor="pr-lead" error={e.lead_id?.message} className="sm:col-span-2">
                <NativeSelect id="pr-lead" {...register('lead_id')} aria-invalid={!!e.lead_id || undefined}>
                  <option value="">Selecione</option>
                  {leads.data?.data.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.company_name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            <Field label="Título" htmlFor="pr-title" error={e.title?.message} className="sm:col-span-2">
              <Input id="pr-title" {...register('title')} aria-invalid={!!e.title || undefined} />
            </Field>
            <Field label="Serviços incluídos" htmlFor="pr-services" hint="Separe por vírgula" className="sm:col-span-2">
              <Input id="pr-services" placeholder="Ex.: Agente de IA no WhatsApp, Integração com agenda" {...register('services')} />
            </Field>
            <Field label="Setup (R$)" htmlFor="pr-setup" error={e.setup_value?.message}>
              <Input id="pr-setup" type="number" min={0} step="100" {...register('setup_value')} aria-invalid={!!e.setup_value || undefined} />
            </Field>
            <Field label="MRR (R$/mês)" htmlFor="pr-mrr" error={e.mrr_value?.message}>
              <Input id="pr-mrr" type="number" min={0} step="50" {...register('mrr_value')} aria-invalid={!!e.mrr_value || undefined} />
            </Field>
            <Field label="Prazo de implantação (dias)" htmlFor="pr-days">
              <Input id="pr-days" type="number" min={0} {...register('implementation_days')} />
            </Field>
            <Field label="Validade" htmlFor="pr-valid">
              <Input id="pr-valid" type="date" {...register('valid_until')} />
            </Field>
            <Field label="Status" htmlFor="pr-status">
              <NativeSelect id="pr-status" {...register('status')}>
                {PROPOSAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PROPOSAL_LABEL[s]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Documento" htmlFor="pr-file" hint={proposal?.document_name ? `Atual: ${proposal.document_name}` : 'PDF, DOCX, PPTX ou imagem até 20 MB'}>
              <Input
                id="pr-file"
                type="file"
                accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg"
                className="pt-1.5 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-moss-100 file:px-2 file:py-0.5 file:text-xs file:font-medium file:text-moss-800"
                onChange={(ev) => setFile(ev.target.files?.[0] ?? null)}
              />
            </Field>
            <Field label="Escopo / descrição" htmlFor="pr-desc" className="sm:col-span-2">
              <Textarea id="pr-desc" rows={4} {...register('description')} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending || upload.isPending}>
              {proposal ? 'Salvar proposta' : 'Registrar proposta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
