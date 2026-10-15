import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { AuthShell } from '@/layouts/AuthShell';
import { Field, Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setReady(true);
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.');
    if (password !== confirm) return setError('As senhas não coincidem.');
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError('Não foi possível redefinir a senha. Solicite um novo link.');
      return;
    }
    toast.success('Senha atualizada');
    router.replace('/');
  };

  if (!ready) return null;

  if (!hasSession) {
    return (
      <AuthShell title="Link inválido ou expirado" description="Solicite um novo e-mail de recuperação para continuar.">
        <Button asChild className="w-full">
          <Link href="/recuperar-senha">Pedir novo link</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Nova senha" description="Defina uma senha com pelo menos 8 caracteres.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nova senha" htmlFor="password" error={error ?? undefined}>
          <Input id="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirmar senha" htmlFor="confirm">
          <Input id="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full" loading={loading}>
          Salvar senha
        </Button>
      </form>
    </AuthShell>
  );
}
