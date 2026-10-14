import { useEffect, useMemo, useState } from 'react';
import { addDays } from 'date-fns';
import { buildCadence, DEFAULT_SETTINGS } from '@kidoo/shared';
import { useCreateCadence, useCreateFollowup, useSettings } from '@/services/operations';
import { isoToLocalInput, localInputToIso, relativeDay } from '@/lib/format';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/menu';

export function FollowupDialog({ leadId, open, onOpenChange }: { leadId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const settings = useSettings();
  const cadence = useCreateCadence();
  const single = useCreateFollowup();
  const [tab, setTab] = useState('cadence');
  const [anchor, setAnchor] = useState('');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    setTab('cadence');
    setAnchor(isoToLocalInput(new Date().toISOString()));
    setTitle('Follow-up');
    setDue(isoToLocalInput(addDays(new Date(), 1).toISOString()));
    setMessage('');
  }, [open]);

  const steps = settings.data?.cadence.steps ?? DEFAULT_SETTINGS.cadence.steps;
  const preview = useMemo(() => (anchor ? buildCadence(new Date(anchor), steps) : []), [anchor, steps]);

  const submit = async () => {
    try {
      if (tab === 'cadence') await cadence.mutateAsync({ lead_id: leadId, anchor_at: localInputToIso(anchor)! });
      else await single.mutateAsync({ lead_id: leadId, title, due_at: localInputToIso(due)!, message: message || undefined });
      onOpenChange(false);
    } catch {
      /* toast exibido pela mutation */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader title="Agendar follow-up" description="As mensagens são geradas com os dados reais do lead e podem ser editadas antes do envio." />
        <DialogBody>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="cadence">Cadência completa</TabsTrigger>
              <TabsTrigger value="single">Follow-up único</TabsTrigger>
            </TabsList>
            <TabsContent value="cadence" className="space-y-4">
              <Field label="Marco inicial" htmlFor="fu-anchor" hint="Normalmente a data da call diagnóstica. Substitui uma cadência pendente anterior.">
                <Input id="fu-anchor" type="datetime-local" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
              </Field>
              <ol className="divide-y divide-border rounded-lg border border-border">
                {preview.map((p, i) => (
                  <li key={p.step} className="flex items-center justify-between gap-3 px-3 py-2.5 text-[13px]">
                    <span className="flex items-center gap-2.5">
                      <span className="tabular inline-flex size-5 items-center justify-center rounded-full bg-moss-100 text-[11px] font-semibold text-moss-800">{i + 1}</span>
                      <span>
                        <span className="font-medium">{p.title}</span>
                        <span className="block text-xs text-muted-foreground">{steps[i]?.goal}</span>
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-xs text-muted-foreground">{relativeDay(p.due_at)}</span>
                  </li>
                ))}
              </ol>
            </TabsContent>
            <TabsContent value="single" className="grid gap-4">
              <Field label="Título" htmlFor="fu-title">
                <Input id="fu-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              <Field label="Data e horário" htmlFor="fu-due">
                <Input id="fu-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
              </Field>
              <Field label="Mensagem (opcional)" htmlFor="fu-msg">
                <Textarea id="fu-msg" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
              </Field>
            </TabsContent>
          </Tabs>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={cadence.isPending || single.isPending} disabled={tab === 'cadence' ? !anchor : !title.trim() || !due}>
            {tab === 'cadence' ? `Agendar ${preview.length} follow-ups` : 'Agendar follow-up'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
