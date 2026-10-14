import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LEAD_SOURCES, PRIORITIES, PRIORITY_LABEL, SOURCE_LABEL, type Lead, type LeadSource, type Priority } from '@kidoo/shared';
import { useAuth } from '@/hooks/useAuth';
import { useLeadDrawer } from '@/hooks/useLeadDrawer';
import { useCreateLead, useUpdateLead } from '@/services/leads';
import { useUsers } from '@/services/operations';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Field, Input, NativeSelect } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export const NICHES = [
  'Clínica médica',
  'Clínica odontológica',
  'Desentupidora',
  'Locadora B2B',
  'Escritório contábil',
  'Manutenção predial',
  'Serviços empresariais',
];

const optionalMoney = z
  .string()
  .refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0), 'Valor inválido');

const schema = z.object({
  company_name: z.string().trim().min(2, 'Informe o nome da empresa'),
  cnpj: z.string().trim().refine((v) => v === '' || [11, 14].includes(v.replace(/\D/g, '').length), 'CNPJ deve ter 14 dígitos'),
  website: z.string().trim(),
  niche: z.string().trim(),
  estimated_monthly_revenue: optionalMoney,
  source: z.enum(LEAD_SOURCES),
  priority: z.enum(PRIORITIES),
  owner_id: z.string(),
  estimated_setup: optionalMoney,
  estimated_mrr: optionalMoney,
  contact_name: z.string().trim(),
  contact_role: z.string().trim(),
  contact_phone: z.string().trim().refine((v) => v === '' || v.replace(/\D/g, '').length >= 10, 'Telefone com DDD'),
  contact_email: z.union([z.literal(''), z.email('E-mail inválido')]),
});
type FormValues = z.infer<typeof schema>;

const num = (v: string) => (v === '' ? null : Number(v));
const str = (v: string) => (v === '' ? null : v);

function defaults(lead?: Lead, userId?: string): FormValues {
  return {
    company_name: lead?.company_name ?? '',
    cnpj: lead?.cnpj ?? '',
    website: lead?.website ?? '',
    niche: lead?.niche ?? '',
    estimated_monthly_revenue: lead?.estimated_monthly_revenue?.toString() ?? '',
    source: (lead?.source as LeadSource) ?? 'manual',
    priority: (lead?.priority as Priority) ?? 'medium',
    owner_id: lead?.owner_id ?? userId ?? '',
    estimated_setup: lead?.estimated_setup?.toString() ?? '',
    estimated_mrr: lead?.estimated_mrr?.toString() ?? '',
    contact_name: lead?.contact_name ?? '',
    contact_role: lead?.contact_role ?? '',
    contact_phone: lead?.contact_phone ?? '',
    contact_email: lead?.contact_email ?? '',
  };
}

export function LeadFormDialog({ open, onOpenChange, lead }: { open: boolean; onOpenChange: (o: boolean) => void; lead?: Lead }) {
  const { profile, can } = useAuth();
  const users = useUsers();
  const create = useCreateLead();
  const update = useUpdateLead(lead?.id ?? '');
  const { open: openLead } = useLeadDrawer();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults(lead, profile?.id) });
  const { register, handleSubmit, formState, reset } = form;
  const e = formState.errors;

  useEffect(() => {
    if (open) reset(defaults(lead, profile?.id));
  }, [open, lead, profile?.id, reset]);

  const onSubmit = handleSubmit(async (v) => {
    const fields = {
      company_name: v.company_name,
      cnpj: str(v.cnpj),
      website: str(v.website),
      niche: str(v.niche),
      estimated_monthly_revenue: num(v.estimated_monthly_revenue),
      source: v.source,
      priority: v.priority,
      estimated_setup: num(v.estimated_setup),
      estimated_mrr: num(v.estimated_mrr),
    };
    const contact = v.contact_name
      ? { name: v.contact_name, role: str(v.contact_role), phone: str(v.contact_phone), email: str(v.contact_email) }
      : undefined;
    try {
      if (lead) {
        await update.mutateAsync({ ...fields, contact });
      } else {
        const created = await create.mutateAsync({ ...fields, owner_id: v.owner_id || null, contact });
        openLead(created.id);
      }
      onOpenChange(false);
    } catch {
      // erro já exibido pelo toast da mutation; o formulário continua aberto com os dados
    }
  });

  const busy = create.isPending || update.isPending;
  const err = (k: keyof FormValues) => ({ 'aria-invalid': !!e[k] || undefined, 'aria-describedby': e[k] ? `${k}-error` : undefined });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader
          title={lead ? 'Editar lead' : 'Novo lead'}
          description={lead ? 'As alterações ficam registradas na auditoria.' : 'O lead entra na etapa Leads Enriquecidos.'}
        />
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-6">
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-3 text-xs font-semibold text-muted-foreground">Empresa</legend>
              <Field label="Nome da empresa" htmlFor="company_name" error={e.company_name?.message} className="sm:col-span-2">
                <Input id="company_name" autoFocus placeholder="Ex.: Clínica Vida Plena" {...register('company_name')} {...err('company_name')} />
              </Field>
              <Field label="CNPJ" htmlFor="cnpj" error={e.cnpj?.message}>
                <Input id="cnpj" inputMode="numeric" placeholder="00.000.000/0000-00" {...register('cnpj')} {...err('cnpj')} />
              </Field>
              <Field label="Website" htmlFor="website">
                <Input id="website" placeholder="empresa.com.br" {...register('website')} />
              </Field>
              <Field label="Nicho" htmlFor="niche">
                <Input id="niche" list="niche-options" placeholder="Selecione ou digite" {...register('niche')} />
                <datalist id="niche-options">
                  {NICHES.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </Field>
              <Field label="Faturamento mensal estimado (R$)" htmlFor="estimated_monthly_revenue" error={e.estimated_monthly_revenue?.message} hint="Define o porte automaticamente">
                <Input id="estimated_monthly_revenue" type="number" min={0} step="1000" inputMode="decimal" {...register('estimated_monthly_revenue')} {...err('estimated_monthly_revenue')} />
              </Field>
            </fieldset>

            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-3 text-xs font-semibold text-muted-foreground">Contato principal</legend>
              <Field label="Nome" htmlFor="contact_name">
                <Input id="contact_name" autoComplete="off" {...register('contact_name')} />
              </Field>
              <Field label="Cargo" htmlFor="contact_role">
                <Input id="contact_role" placeholder="Ex.: Sócia-diretora" {...register('contact_role')} />
              </Field>
              <Field label="Telefone / WhatsApp" htmlFor="contact_phone" error={e.contact_phone?.message}>
                <Input id="contact_phone" type="tel" inputMode="tel" placeholder="(31) 99999-0000" {...register('contact_phone')} {...err('contact_phone')} />
              </Field>
              <Field label="E-mail" htmlFor="contact_email" error={e.contact_email?.message}>
                <Input id="contact_email" type="email" {...register('contact_email')} {...err('contact_email')} />
              </Field>
            </fieldset>

            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-3 text-xs font-semibold text-muted-foreground">Oportunidade</legend>
              <Field label="Setup estimado (R$)" htmlFor="estimated_setup" error={e.estimated_setup?.message} hint="Faixa usual: R$ 2.000 a R$ 15.000">
                <Input id="estimated_setup" type="number" min={0} step="100" {...register('estimated_setup')} {...err('estimated_setup')} />
              </Field>
              <Field label="MRR estimado (R$/mês)" htmlFor="estimated_mrr" error={e.estimated_mrr?.message} hint="Faixa usual: R$ 600 a R$ 6.000">
                <Input id="estimated_mrr" type="number" min={0} step="50" {...register('estimated_mrr')} {...err('estimated_mrr')} />
              </Field>
              <Field label="Origem" htmlFor="source">
                <NativeSelect id="source" {...register('source')}>
                  {LEAD_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {SOURCE_LABEL[s]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Prioridade" htmlFor="priority">
                <NativeSelect id="priority" {...register('priority')}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              {!lead && can('leads.assign') && (
                <Field label="Closer responsável" htmlFor="owner_id">
                  <NativeSelect id="owner_id" {...register('owner_id')}>
                    {users.data?.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              )}
            </fieldset>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={busy}>
              {lead ? 'Salvar alterações' : 'Cadastrar lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
