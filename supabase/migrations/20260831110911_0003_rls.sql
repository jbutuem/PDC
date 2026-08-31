-- 20260831110911_0003_rls.sql
-- Row Level Security. É isto que impede que a chave anônima — que fica
-- visível no HTML do site — sirva para alterar preços.
-- Aplicada em 31/08/2026 no projeto akahkfstgicfamfsibvw.
--
-- Depois de QUALQUER mudança aqui, rode supabase/testes/rls.sql.

alter table tenants        enable row level security;
alter table membros        enable row level security;
alter table secoes         enable row level security;
alter table itens          enable row level security;
alter table variantes      enable row level security;
alter table precos         enable row level security;
alter table imagens        enable row level security;
alter table banners        enable row level security;
alter table promocoes      enable row level security;
alter table promocao_itens enable row level security;
alter table comunicados    enable row level security;
alter table versoes        enable row level security;
alter table revisoes_ia    enable row level security;
alter table audit_log      enable row level security;

-- ---------- LEITURA PÚBLICA: só o que está publicado ----------

create policy pub_tenants on tenants for select to anon, authenticated using (ativo);
create policy pub_secoes  on secoes  for select to anon, authenticated using (visivel);
create policy pub_itens   on itens   for select to anon, authenticated using (status = 'publicado');

create policy pub_var on variantes for select to anon, authenticated using (
  exists (select 1 from itens i where i.id = item_id and i.status = 'publicado'));

create policy pub_precos on precos for select to anon, authenticated using (
  exists (select 1 from variantes v join itens i on i.id = v.item_id
          where v.id = variante_id and i.status = 'publicado'));

create policy pub_img on imagens for select to anon, authenticated using (true);

create policy pub_banners on banners for select to anon, authenticated using (
  ativo and (inicio is null or inicio <= now()) and (fim is null or fim > now()));

create policy pub_promo on promocoes for select to anon, authenticated using (
  ativo and now() between inicio and fim);

create policy pub_promoi on promocao_itens for select to anon, authenticated using (true);

create policy pub_com on comunicados for select to anon, authenticated using (
  ativo and inicio <= now() and (fim is null or fim > now()));

-- ---------- MEMBROS: cada um vê só o próprio vínculo ----------

create policy m_self on membros for select to authenticated using (user_id = auth.uid());

-- ---------- EDIÇÃO: cliente_editor, agencia, owner ----------

create policy ed_itens on itens for all to authenticated
  using (pode_editar(tenant_id)) with check (pode_editar(tenant_id));
create policy ed_secoes on secoes for all to authenticated
  using (pode_editar(tenant_id)) with check (pode_editar(tenant_id));
create policy ed_img on imagens for all to authenticated
  using (pode_editar(tenant_id)) with check (pode_editar(tenant_id));
create policy ed_com on comunicados for all to authenticated
  using (pode_editar(tenant_id)) with check (pode_editar(tenant_id));
create policy ed_promo on promocoes for all to authenticated
  using (pode_editar(tenant_id)) with check (pode_editar(tenant_id));

create policy ed_promoi on promocao_itens for all to authenticated using (
  exists (select 1 from promocoes p where p.id = promocao_id and pode_editar(p.tenant_id)));

create policy ed_rev on revisoes_ia for all to authenticated
  using (pode_editar(tenant_id)) with check (pode_editar(tenant_id));

create policy ed_var on variantes for all to authenticated using (
  exists (select 1 from itens i where i.id = item_id and pode_editar(i.tenant_id)));

create policy ed_precos on precos for all to authenticated using (
  exists (select 1 from variantes v join itens i on i.id = v.item_id
          where v.id = variante_id and pode_editar(i.tenant_id)));

-- ---------- SÓ A AGÊNCIA: hero, banners, publicação, auditoria ----------

create policy ag_banners on banners for all to authenticated
  using (pode_publicar(tenant_id)) with check (pode_publicar(tenant_id));
create policy ag_versoes on versoes for all to authenticated
  using (pode_publicar(tenant_id)) with check (pode_publicar(tenant_id));
create policy ag_audit on audit_log for select to authenticated
  using (pode_publicar(tenant_id));
create policy ag_tenants_w on tenants for update to authenticated
  using (pode_publicar(id)) with check (pode_publicar(id));
