-- Exclusão de usuário numa transação: o histórico comercial fica, a conta some.
-- Atividades, follow-ups e propostas exigem responsável; passam para quem exclui.
-- O restante (leads, auditoria, onboarding) já anula a referência ao apagar o perfil.

create or replace function public.remove_user(p_user uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user = p_actor then
    raise exception 'self_delete' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  if (select role from public.profiles where id = p_user) = 'admin'
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'last_admin' using errcode = 'P0001';
  end if;

  update public.activities set owner_id = p_actor where owner_id = p_user;
  update public.followups set owner_id = p_actor where owner_id = p_user;
  update public.proposals set owner_id = p_actor where owner_id = p_user;

  begin
    delete from auth.users where id = p_user;
  exception
    when foreign_key_violation then
      raise exception 'user_still_referenced' using errcode = 'P0001';
  end;
end $$;

revoke execute on function public.remove_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.remove_user(uuid, uuid) to service_role;
