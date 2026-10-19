'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useQueryPatch } from '@/hooks/useQueryPatch';
import { useDisconnectGoogleCalendar, useGoogleCalendarStatus, useStartGoogleCalendarConnect } from '@/services/operations';
import { Button } from '@/components/ui/button';

export function GoogleCalendarConnect({ returnTo }: { returnTo: 'agenda' | 'integracoes' }) {
  const status = useGoogleCalendarStatus();
  const connect = useStartGoogleCalendarConnect();
  const disconnect = useDisconnectGoogleCalendar();
  const s = status.data;

  if (status.isLoading || !s) return <p className="text-xs text-muted-foreground">Verificando Google Calendar…</p>;

  if (!s.configured) {
    return (
      <p className="text-xs text-muted-foreground">
        Google Calendar ainda não está ligado no servidor. Quando as credenciais existirem, cada pessoa conecta a própria conta aqui.
      </p>
    );
  }

  if (s.connected) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-muted-foreground">
          Sincronizando com <span className="font-medium text-foreground">{s.email}</span>. Atividades com data vão para esse calendário.
        </p>
        <Button size="sm" variant="outline" loading={disconnect.isPending} onClick={() => disconnect.mutate()}>
          Desconectar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-xs text-muted-foreground">Pronto no servidor. Conecte sua conta Google para enviar as atividades à sua agenda.</p>
      <Button size="sm" loading={connect.isPending} onClick={() => connect.mutate(returnTo)}>
        Conectar Google Calendar
      </Button>
    </div>
  );
}

export function GoogleCalendarReturnToast() {
  const [params, setParams] = useQueryPatch();
  useEffect(() => {
    const g = params.get('google');
    if (!g) return;
    if (g === 'connected') toast.success('Google Calendar conectado');
    else if (g === 'denied') toast.error('Conexão com o Google cancelada');
    else toast.error('Não foi possível conectar o Google Calendar');
    setParams((p) => {
      p.delete('google');
      return p;
    });
  }, [params, setParams]);
  return null;
}
