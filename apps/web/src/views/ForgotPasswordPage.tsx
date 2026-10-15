import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { AuthShell } from '@/layouts/AuthShell';
import { Field, Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setLoading(false);
    if (err) {
      setError('Não foi possível enviar o e-mail. Confira o endereço e tente de novo.');
      return;
    }
    setSent(true);
  };

  return (
    <AuthShell title="Recuperar senha" description="Enviamos um link de redefinição para o seu e-mail.">
      {sent ? (
        <p className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">
          Se <strong>{email}</strong> estiver cadastrado, o link já saiu. Confira também o spam.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="E-mail" htmlFor="email" error={error ?? undefined}>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full" loading={loading}>
            Enviar link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-[13px]">
        <Link href="/login" className="font-medium text-moss-800 hover:underline">
          Voltar ao login
        </Link>
      </p>
    </AuthShell>
  );
}
