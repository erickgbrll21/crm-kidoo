import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { safeNext } from '@/routes/guards';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { AuthShell } from '@/layouts/AuthShell';
import { Field, Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!supabaseConfigured) {
    return (
      <AuthShell title="Configuração pendente" description="O CRM precisa das variáveis do Supabase para autenticar.">
        <p className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          Copie <code className="text-foreground">.env.example</code> para <code className="text-foreground">.env</code> e preencha{' '}
          <code className="text-foreground">NEXT_PUBLIC_SUPABASE_URL</code> e <code className="text-foreground">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
        </p>
      </AuthShell>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) {
      setError(err.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar. Tente novamente.');
      return;
    }
    toast.success('Bem-vindo de volta');
    router.replace(safeNext(search.get('from')));
  };

  return (
    <AuthShell title="Entrar" description="Use o e-mail corporativo da Kidoo Hub.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="E-mail" htmlFor="email" error={error ?? undefined}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!error}
          />
        </Field>
        <Field label="Senha" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" className="w-full" loading={loading}>
          Entrar
        </Button>
        <p className="text-center text-[13px]">
          <Link href="/recuperar-senha" className="font-medium text-moss-800 hover:underline">
            Esqueci minha senha
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
