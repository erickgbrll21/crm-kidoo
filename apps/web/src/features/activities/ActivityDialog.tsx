import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ACTIVITY_LABEL, PRIORITIES, PRIORITY_LABEL, type ActivityType } from '@kidoo/shared';
import { useAuth } from '@/hooks/useAuth';
import { useCreateActivity, useUsers } from '@/services/operations';
import { useLeads } from '@/services/leads';
import { isoToLocalInput, localInputToIso } from '@/lib/format';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const SCHEDULABLE: ActivityType[] = ['call', 'whatsapp', 'email', 'meeting', 'proposal', 'followup', 'task'];
const CONTACT: ActivityType[] = ['whatsapp', 'call', 'email', 'meeting'];

const schema = z.object({
  lead_id: z.string(),
  type: z.string().min(1),
  title: z.string().trim().min(1, 'Informe um título'),
  description: z.string(),
  due_at: z.string(),
  priority: z.enum(PRIORITIES),
  owner_id: z.string(),
});
type Values = z.infer<typeof schema>;

/**
 * mode "schedule": agenda uma atividade futura.
 * mode "log": registra um contato já realizado (conta como interação comercial real).
 * mode "note": anotação no histórico.
 */
export function ActivityDialog({
  open,
  onOpenChange,
  mode,
  leadId,
  defaultType,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: 'schedule' | 'log' | 'note';
  leadId?: string;
  defaultType?: ActivityType;
}) {
  const { profile, can } = useAuth();
  const create = useCreateActivity(mode === 'log' ? 'Contato registrado' : mode === 'note' ? 'Anotação adicionada' : 'Atividade agendada');
  const users = useUsers();
  const leads = useLeads({ status: 'open', page_size: 500, sort: 'created_at' });
  const initial = (): Values => ({
    lead_id: leadId ?? '',
    type: mode === 'note' ? 'note' : (defaultType ?? (mode === 'log' ? 'whatsapp' : 'call')),
    title: mode === 'note' ? 'Anotação' : mode === 'log' ? 'Contato realizado' : '',
    description: '',
    due_at: mode === 'schedule' ? '' : isoToLocalInput(new Date().toISOString()),
    priority: 'medium',
    owner_id: profile?.id ?? '',
  });
  const { register, handleSubmit, reset, formState, setError } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial() });
  const e = formState.errors;

  useEffect(() => {
    if (open) reset(initial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, leadId, mode]);

  const onSubmit = handleSubmit(async (v) => {
    if (mode === 'schedule' && !v.due_at) return setError('due_at', { message: 'Informe data e horário' });
    try {
      await create.mutateAsync({
        lead_id: v.lead_id || null,
        type: v.type as ActivityType,
        title: mode === 'note' ? 'Anotação' : v.title,
        description: mode === 'log' ? null : v.description || null,
        outcome: mode === 'log' ? v.description || null : null,
        due_at: mode === 'schedule' ? localInputToIso(v.due_at) : null,
        priority: v.priority,
        owner_id: v.owner_id || undefined,
        done: mode !== 'schedule',
      });
      onOpenChange(false);
    } catch {
      /* toast exibido pela mutation */
    }
  });

  const types = mode === 'log' ? CONTACT : SCHEDULABLE;
  const title = mode === 'log' ? 'Registrar contato' : mode === 'note' ? 'Adicionar anotação' : 'Agendar atividade';
  const description =
    mode === 'log'
      ? 'Contatos registrados atualizam a última interação e zeram o termômetro de estagnação.'
      : mode === 'note'
        ? 'A anotação aparece no histórico comercial do lead.'
        : 'Atividades agendadas suspendem o alerta de estagnação até a data marcada.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader title={title} description={description} />
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            {!leadId && (
              <Field label="Lead" htmlFor="act-lead" className="sm:col-span-2">
                <NativeSelect id="act-lead" {...register('lead_id')}>
                  <option value="">Sem lead (tarefa interna)</option>
                  {leads.data?.data.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.company_name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            {mode !== 'note' && (
              <>
                <Field label={mode === 'log' ? 'Canal' : 'Tipo'} htmlFor="act-type">
                  <NativeSelect id="act-type" {...register('type')}>
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {ACTIVITY_LABEL[t]}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label={mode === 'log' ? 'Quando' : 'Data e horário'} htmlFor="act-due" error={e.due_at?.message}>
                  <Input id="act-due" type="datetime-local" disabled={mode === 'log'} {...register('due_at')} aria-invalid={!!e.due_at || undefined} />
                </Field>
                <Field label="Título" htmlFor="act-title" error={e.title?.message} className="sm:col-span-2">
                  <Input
                    id="act-title"
                    placeholder={mode === 'log' ? 'Ex.: Retorno sobre a proposta' : 'Ex.: Call diagnóstica de 15 min'}
                    {...register('title')}
                    aria-invalid={!!e.title || undefined}
                  />
                </Field>
              </>
            )}
            <Field label={mode === 'log' ? 'Resultado do contato' : mode === 'note' ? 'Anotação' : 'Descrição'} htmlFor="act-desc" className="sm:col-span-2">
              <Textarea id="act-desc" rows={mode === 'note' ? 5 : 3} placeholder={mode === 'schedule' ? 'Link da reunião, pauta, observações' : undefined} {...register('description')} />
            </Field>
            {mode === 'schedule' && (
              <>
                <Field label="Prioridade" htmlFor="act-priority">
                  <NativeSelect id="act-priority" {...register('priority')}>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABEL[p]}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                {can('leads.assign') && (
                  <Field label="Responsável" htmlFor="act-owner">
                    <NativeSelect id="act-owner" {...register('owner_id')}>
                      {users.data?.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                )}
              </>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={create.isPending}>
              {mode === 'log' ? 'Registrar contato' : mode === 'note' ? 'Salvar anotação' : 'Agendar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
