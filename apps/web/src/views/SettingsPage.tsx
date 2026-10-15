import { useEffect, useState } from 'react';
import { ROLE_LABEL, SIZE_LABEL, type Role } from '@kidoo/shared';
import { useAuth } from '@/hooks/useAuth';
import { useInviteUser, useSettings, useUpdateSettings, useUpdateUser, useUsers } from '@/services/operations';
import { PageHeader, Panel, PanelHeader } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Field, Input, NativeSelect } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsPage() {
  const { profile, can } = useAuth();
  return (
    <div className="space-y-6 px-4 py-5 md:px-6">
      <PageHeader title="Configurações" description="Papéis, faixas de porte, termômetro e cadência — sem nomes fixos no código." />
      <ProfileSection />
      {can('users.manage') && <UsersSection />}
      {can('settings.manage') && <OpsSection />}
      {!can('settings.manage') && profile?.role !== 'admin' && (
        <p className="text-[13px] text-muted-foreground">Faixas comerciais, cadência e usuários são geridos pelo administrador.</p>
      )}
    </div>
  );
}

function ProfileSection() {
  const { profile } = useAuth();
  const update = useUpdateUser();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [title, setTitle] = useState(profile?.title ?? '');
  useEffect(() => {
    setName(profile?.full_name ?? '');
    setTitle(profile?.title ?? '');
  }, [profile]);
  if (!profile) return <Skeleton className="h-40" />;
  return (
    <Panel>
      <PanelHeader title="Meu perfil" />
      <form
        className="grid gap-4 px-5 pb-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({ id: profile.id, full_name: name, title: title || null });
        }}
      >
        <Field label="Nome" htmlFor="me-name">
          <Input id="me-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Cargo" htmlFor="me-title">
          <Input id="me-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="E-mail" htmlFor="me-email">
          <Input id="me-email" value={profile.email} disabled />
        </Field>
        <Field label="Papel" htmlFor="me-role">
          <Input id="me-role" value={ROLE_LABEL[profile.role]} disabled />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" loading={update.isPending}>
            Salvar perfil
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function UsersSection() {
  const users = useUsers();
  const update = useUpdateUser();
  const invite = useInviteUser();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('closer');
  return (
    <Panel>
      <PanelHeader title="Usuários" description="Convites saem por e-mail do Supabase Auth. O papel é gravado no servidor, não no cliente." />
      <form
        className="flex flex-wrap gap-2 border-b border-border px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          invite.mutate({ email, full_name: name, role }, { onSuccess: () => { setEmail(''); setName(''); } });
        }}
      >
        <Input required placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} className="w-40" />
        <Input required type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className="w-56" />
        <NativeSelect value={role} onChange={(e) => setRole(e.target.value as Role)} className="w-44">
          <option value="admin">Administrador</option>
          <option value="manager">Gestor Comercial</option>
          <option value="closer">Closer</option>
        </NativeSelect>
        <Button type="submit" size="sm" loading={invite.isPending}>
          Convidar
        </Button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="px-5 py-2 font-medium">Pessoa</th>
              <th className="px-3 py-2 font-medium">Papel</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.data?.map((u) => (
              <tr key={u.id}>
                <td className="px-5 py-2.5">
                  <p className="font-medium">{u.full_name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </td>
                <td className="px-3 py-2.5">
                  <NativeSelect
                    aria-label={`Papel de ${u.full_name}`}
                    value={u.role}
                    className="w-44"
                    onChange={(e) => update.mutate({ id: u.id, role: e.target.value as Role })}
                  >
                    <option value="admin">Administrador</option>
                    <option value="manager">Gestor Comercial</option>
                    <option value="closer">Closer</option>
                  </NativeSelect>
                </td>
                <td className="px-3 py-2.5">
                  <button onClick={() => update.mutate({ id: u.id, is_active: !u.is_active })} className="cursor-pointer">
                    <Badge variant={u.is_active ? 'success' : 'outline'}>{u.is_active ? 'Ativo' : 'Inativo'}</Badge>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function OpsSection() {
  const { data } = useSettings();
  const save = useUpdateSettings();
  const [ranges, setRanges] = useState(data?.size_ranges);
  const [warn, setWarn] = useState(data?.stagnation.warning_hours ?? 24);
  const [cold, setCold] = useState(data?.stagnation.cold_hours ?? 48);
  const [all, setAll] = useState(data?.closer_sees_all_leads ?? true);
  const [expiry, setExpiry] = useState(data?.proposal_expiry_warning_days ?? 3);
  useEffect(() => {
    if (!data) return;
    setRanges(data.size_ranges);
    setWarn(data.stagnation.warning_hours);
    setCold(data.stagnation.cold_hours);
    setAll(data.closer_sees_all_leads);
    setExpiry(data.proposal_expiry_warning_days);
  }, [data]);
  if (!data || !ranges) return <Skeleton className="h-64" />;

  return (
    <Panel>
      <PanelHeader title="Regras comerciais" description="Porte, termômetro de estagnação e visibilidade do closer." />
      <div className="space-y-5 px-5 pb-5">
        <div>
          <p className="mb-2 text-[13px] font-medium">Faixas de porte (faturamento mensal máximo)</p>
          <div className="grid gap-2 sm:grid-cols-5">
            {ranges.map((r, i) => (
              <Field key={r.size} label={SIZE_LABEL[r.size]} htmlFor={`size-${r.size}`}>
                <Input
                  id={`size-${r.size}`}
                  type="number"
                  disabled={r.max === null}
                  value={r.max ?? ''}
                  placeholder="sem teto"
                  onChange={(e) => {
                    const next = ranges.map((x, j) => (j === i ? { ...x, max: e.target.value === '' ? null : Number(e.target.value) } : x));
                    setRanges(next);
                  }}
                />
              </Field>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Atenção após (horas)" htmlFor="warn">
            <Input id="warn" type="number" value={warn} onChange={(e) => setWarn(Number(e.target.value))} />
          </Field>
          <Field label="Esfriando após (horas)" htmlFor="cold">
            <Input id="cold" type="number" value={cold} onChange={(e) => setCold(Number(e.target.value))} />
          </Field>
          <Field label="Aviso de proposta (dias)" htmlFor="exp">
            <Input id="exp" type="number" value={expiry} onChange={(e) => setExpiry(Number(e.target.value))} />
          </Field>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-sm">
          Closer vê todos os leads
          <Switch checked={all} onCheckedChange={setAll} />
        </label>
        <p className="text-xs text-muted-foreground">
          Cadência padrão: D+1 pós-call, D+3 valor, D+5 objeções, D+8 decisão. O marco é a data da call, configurável ao agendar.
        </p>
        <Button
          loading={save.isPending}
          onClick={() =>
            save.mutate({
              size_ranges: ranges,
              stagnation: { warning_hours: warn, cold_hours: cold },
              closer_sees_all_leads: all,
              proposal_expiry_warning_days: expiry,
            })
          }
        >
          Salvar regras
        </Button>
      </div>
    </Panel>
  );
}
