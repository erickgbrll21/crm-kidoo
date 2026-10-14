import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Lead } from '@kidoo/shared';
import { useCloseLead, useLoseLead } from '@/services/leads';
import { useUsers } from '@/services/operations';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const closeSchema = z.object({
  closed_setup: z.string().refine((v) => v !== '' && Number(v) >= 0, 'Informe o Setup contratado'),
  closed_mrr: z.string().refine((v) => v !== '' && Number(v) >= 0, 'Informe o MRR contratado'),
  services: z.string(),
  contract_ref: z.string(),
  start_date: z.string(),
  tech_owner_id: z.string(),
});

export function CloseLeadDialog({ lead, open, onOpenChange, suggestedServices }: { lead: Lead; open: boolean; onOpenChange: (o: boolean) => void; suggestedServices?: string }) {
  const close = useCloseLead(lead.id);
  const users = useUsers();
  const { register, handleSubmit, reset, formState } = useForm({ resolver: zodResolver(closeSchema) });
  const e = formState.errors;

  useEffect(() => {
    if (open)
      reset({
        closed_setup: lead.estimated_setup?.toString() ?? '',
        closed_mrr: lead.estimated_mrr?.toString() ?? '',
        services: suggestedServices ?? '',
        contract_ref: '',
        start_date: '',
        tech_owner_id: lead.owner_id ?? '',
      });
  }, [open, lead, suggestedServices, reset]);

  const onSubmit = handleSubmit(async (v) => {
    try {
      await close.mutateAsync({
        closed_setup: Number(v.closed_setup),
        closed_mrr: Number(v.closed_mrr),
        services: v.services.split(',').map((s) => s.trim()).filter(Boolean),
        contract_ref: v.contract_ref || null,
        start_date: v.start_date || null,
        tech_owner_id: v.tech_owner_id || null,
      });
      onOpenChange(false);
    } catch {
      /* toast exibido pela mutation */
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          title={`Marcar ${lead.company_name} como ganho`}
          description="Registre os valores contratados. O cliente e a trilha de onboarding são criados automaticamente; a cadência de follow-up é pausada."
        />
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Setup contratado (R$)" htmlFor="closed_setup" error={e.closed_setup?.message}>
              <Input id="closed_setup" type="number" min={0} step="100" autoFocus {...register('closed_setup')} aria-invalid={!!e.closed_setup || undefined} />
            </Field>
            <Field label="MRR contratado (R$/mês)" htmlFor="closed_mrr" error={e.closed_mrr?.message}>
              <Input id="closed_mrr" type="number" min={0} step="50" {...register('closed_mrr')} aria-invalid={!!e.closed_mrr || undefined} />
            </Field>
            <Field label="Serviços contratados" htmlFor="services" hint="Separe por vírgula" className="sm:col-span-2">
              <Input id="services" placeholder="Ex.: Agente de IA no WhatsApp, Automação de agenda" {...register('services')} />
            </Field>
            <Field label="Referência do contrato" htmlFor="contract_ref" hint="Número ou link do contrato assinado">
              <Input id="contract_ref" {...register('contract_ref')} />
            </Field>
            <Field label="Início previsto" htmlFor="start_date">
              <Input id="start_date" type="date" {...register('start_date')} />
            </Field>
            <Field label="Responsável pelo onboarding" htmlFor="tech_owner_id" className="sm:col-span-2">
              <NativeSelect id="tech_owner_id" {...register('tech_owner_id')}>
                {users.data?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={close.isPending}>
              Confirmar ganho
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const REASONS = ['Preço acima do orçamento', 'Sem prioridade no momento', 'Escolheu concorrente', 'Sem resposta após cadência', 'Fora do perfil (ICP)', 'Outro'];

export function LoseLeadDialog({ lead, open, onOpenChange }: { lead: Lead; open: boolean; onOpenChange: (o: boolean) => void }) {
  const lose = useLoseLead(lead.id);
  const [reason, setReason] = useState(REASONS[0]!);
  const [detail, setDetail] = useState('');
  useEffect(() => {
    if (open) {
      setReason(REASONS[0]!);
      setDetail('');
    }
  }, [open]);
  const full = reason === 'Outro' ? detail.trim() : detail.trim() ? `${reason}: ${detail.trim()}` : reason;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader
          title="Marcar como perdido"
          description="O lead vai para a Base de Reativação com o motivo registrado e pode ser reativado depois."
        />
        <form
          onSubmit={async (ev) => {
            ev.preventDefault();
            if (full.length < 3) return;
            try {
              await lose.mutateAsync(full);
              onOpenChange(false);
            } catch {
              /* toast exibido pela mutation */
            }
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <DialogBody className="space-y-4">
            <Field label="Motivo da perda" htmlFor="lose-reason">
              <NativeSelect id="lose-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                {REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={reason === 'Outro' ? 'Descreva o motivo' : 'Detalhes (opcional)'} htmlFor="lose-detail">
              <Textarea id="lose-detail" value={detail} onChange={(e) => setDetail(e.target.value)} required={reason === 'Outro'} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" loading={lose.isPending} disabled={full.length < 3}>
              Marcar como perdido
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
