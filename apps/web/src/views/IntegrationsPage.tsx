import type { ReactNode } from 'react';
import { Cable, Check, CircleDashed } from 'lucide-react';
import { SOURCE_LABEL, type LeadSource } from '@kidoo/shared';
import { useIntegrationEvents, useIntegrationStatus } from '@/services/operations';
import { dateTime } from '@/lib/format';
import { EmptyState, ErrorState, PageHeader, Panel, PanelHeader } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { GoogleCalendarConnect, GoogleCalendarReturnToast } from '@/features/integrations/GoogleCalendarConnect';

export default function IntegrationsPage() {
  const status = useIntegrationStatus();
  const events = useIntegrationEvents();
  const s = status.data;

  return (
    <div className="space-y-5 px-4 py-5 md:px-6">
      <PageHeader
        title="Integrações"
        description="Leads enriquecidos entram pelo webhook. WhatsApp Business e Google Calendar só aparecem como ativos quando configurados."
      />
      <GoogleCalendarReturnToast />

      {status.error ? (
        <ErrorState error={status.error} onRetry={() => status.refetch()} />
      ) : !s ? (
        <Skeleton className="h-32" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <Card
            title="Antigravity Engine / Make.com"
            ok={s.antigravity_webhook.configured}
            detail={`POST ${s.antigravity_webhook.endpoint} com o header x-webhook-secret. Eventos repetidos (mesmo event_id) são ignorados.`}
          />
          <Card title="WhatsApp (wa.me)" ok={s.wa_me_links.configured} detail="Links diretos na primeira versão. Abrir a conversa não confirma o envio." />
          <Card
            title="WhatsApp Business Platform"
            ok={s.whatsapp_business.configured}
            detail={
              s.whatsapp_business.configured
                ? 'Credenciais presentes no servidor. Envio automático ainda não está ligado nesta versão.'
                : 'Não configurado. Defina WHATSAPP_BUSINESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID no servidor quando for o momento.'
            }
          />
          <Card
            title="Google Calendar"
            ok={s.google_calendar.configured && s.google_calendar.connected}
            detail={
              s.google_calendar.connected
                ? `Conta ${s.google_calendar.email} conectada. Reuniões desse calendário entram na agenda, e atividades com data vão para lá.`
                : s.google_calendar.configured
                  ? 'Credenciais no servidor. Conecte a sua conta Google para sincronizar.'
                  : 'Não configurado. Sem simulação de sincronização.'
            }
          >
            <div className="mt-3">
              <GoogleCalendarConnect returnTo="integracoes" />
            </div>
          </Card>
        </div>
      )}

      <Panel>
        <PanelHeader title="Eventos recebidos" description="Últimos 100 webhooks. Use para testar o Antigravity com cURL ou Postman." />
        {events.error ? (
          <ErrorState error={events.error} onRetry={() => events.refetch()} />
        ) : events.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : !events.data?.length ? (
          <EmptyState
            icon={Cable}
            title="Nenhum evento ainda"
            description="Envie um POST autenticado para /api/v1/webhooks/antigravity. O segredo fica só no servidor."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="border-b border-border bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Quando</th>
                  <th className="px-3 py-2.5 font-medium">Origem</th>
                  <th className="px-3 py-2.5 font-medium">Evento</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Detalhe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.data.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2.5 text-muted-foreground">{dateTime(e.created_at)}</td>
                    <td className="px-3 py-2.5">{SOURCE_LABEL[e.source as LeadSource] ?? e.source}</td>
                    <td className="px-3 py-2.5">
                      <code className="text-[12px]">{e.event_id}</code>
                      <p className="text-xs text-muted-foreground">{e.event_type}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={e.status === 'processed' ? 'success' : e.status === 'failed' ? 'danger' : e.status === 'duplicate' ? 'warning' : 'outline'}>
                        {e.status}
                      </Badge>
                    </td>
                    <td className="max-w-xs truncate px-3 py-2.5 text-muted-foreground">{e.error ?? e.dedupe_match ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel className="p-5">
        <h2 className="text-sm font-semibold">Teste com cURL</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">Substitua a URL da API e o segredo. Nunca commite o valor real.</p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-moss-950 p-4 text-[12px] leading-relaxed text-moss-50">
{`curl -X POST "$API_URL/api/v1/webhooks/antigravity" \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-secret: $WEBHOOK_SECRET" \\
  -d '{"event_id":"ag-demo-1","event_type":"lead.enriched","company":{"name":"Clínica Exemplo","industry":"Clínica médica","estimated_monthly_revenue":180000},"contact":{"name":"Mariana","phone":"5531999999999","email":"mariana@example.com"},"diagnostic":{"deep_niche":"Clínica particular","specific_pain":"Demora no atendimento","proposed_solution":"Automação com IA","suggested_setup":6500,"suggested_mrr":1200,"opening_hook":"Mensagem consultiva"},"source":"antigravity"}'`}
        </pre>
      </Panel>
    </div>
  );
}

function Card({ title, ok, detail, children }: { title: string; ok: boolean; detail: string; children?: ReactNode }) {
  return (
    <Panel className="p-5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        {ok ? <Check className="size-4 text-success" /> : <CircleDashed className="size-4 text-muted-foreground" />}
        {title}
      </p>
      <p className="mt-2 text-[13px] text-muted-foreground">{detail}</p>
      {children}
    </Panel>
  );
}
