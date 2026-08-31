-- 20260831152000_0007_storage_e_bootstrap.sql
-- Buckets de imagem, policies do Storage e o bootstrap do primeiro usuário.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu', 'menu', true, 10485760, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('originais', 'originais', false, 52428800)
on conflict (id) do nothing;

create policy "menu leitura publica" on storage.objects for select
  to anon, authenticated using (bucket_id = 'menu');

create policy "menu escrita autenticada" on storage.objects for insert
  to authenticated with check (bucket_id = 'menu' and exists (
    select 1 from membros m where m.user_id = auth.uid()
      and m.papel in ('cliente_editor','agencia','owner')));

create policy "menu update autenticado" on storage.objects for update
  to authenticated using (bucket_id = 'menu' and exists (
    select 1 from membros m where m.user_id = auth.uid()
      and m.papel in ('cliente_editor','agencia','owner')));

create policy "menu delete agencia" on storage.objects for delete
  to authenticated using (bucket_id = 'menu' and exists (
    select 1 from membros m where m.user_id = auth.uid() and m.papel in ('agencia','owner')));

create policy "originais so agencia" on storage.objects for all
  to authenticated using (bucket_id = 'originais' and exists (
    select 1 from membros m where m.user_id = auth.uid() and m.papel in ('agencia','owner')));

-- Ovo e galinha: ninguém entra porque não há membro, e só membro cria membro.
-- O PRIMEIRO cadastro vira owner; do segundo em diante, viewer.
create or replace function fn_primeiro_membro() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_total int;
begin
  select id into v_tenant from tenants where slug = 'pao-da-primavera';
  if v_tenant is null then return new; end if;
  select count(*) into v_total from membros where tenant_id = v_tenant;
  insert into membros (user_id, tenant_id, papel, nome)
  values (new.id, v_tenant,
          case when v_total = 0 then 'owner'::papel else 'viewer'::papel end,
          coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (user_id, tenant_id) do nothing;
  return new;
end $$;

create trigger tg_primeiro_membro after insert on auth.users
  for each row execute function fn_primeiro_membro();

create or replace function fn_numero_versao() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.numero is null then
    select coalesce(max(numero), 0) + 1 into new.numero from versoes where tenant_id = new.tenant_id;
  end if;
  return new;
end $$;

create trigger tg_numero_versao before insert on versoes
  for each row execute function fn_numero_versao();

alter table versoes alter column numero drop not null;

create policy m_owner_ve on membros for select to authenticated using (pode_publicar(tenant_id));
create policy m_owner_gere on membros for all to authenticated
  using (meu_papel(tenant_id) = 'owner') with check (meu_papel(tenant_id) = 'owner');
