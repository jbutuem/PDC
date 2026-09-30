-- 0010 — Duas lojas, um catálogo.
--
-- Pão do Cambuí e Pão da Primavera vendem praticamente o mesmo cardápio.
-- Em vez de duplicar 234 itens (e voltar ao retrabalho que o projeto quer
-- matar), o catálogo é um só e cada loja guarda apenas as EXCEÇÕES:
--
--   itens_lojas  -> a loja não vende este item   (sem linha = vende)
--   precos.loja_id -> preço próprio da loja      (null = preço base, vale para todas)
--
-- Promoções, recados e hero ganham loja_id opcional (null = aparece nas duas).
-- Grupos organizam os ~30 subtítulos do cardápio dentro das 9 seções.

create table if not exists lojas (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  slug        text not null,
  nome        text not null,
  assinatura  text default 'Boulangerie',
  desde       integer,
  site        text,
  instagram   text,
  facebook    text,
  whatsapp    text,
  endereco    text,
  mapa        text,
  abre        time,
  fecha       time,
  ordem       integer not null default 0,
  ativo       boolean not null default true,
  unique (tenant_id, slug)
);
alter table lojas enable row level security;
create policy pub_lojas on lojas for select using (ativo);
create policy ag_lojas on lojas for all using (pode_publicar(tenant_id)) with check (pode_publicar(tenant_id));

create table if not exists itens_lojas (
  item_id    uuid not null references itens(id) on delete cascade,
  loja_id    uuid not null references lojas(id) on delete cascade,
  disponivel boolean not null default true,
  primary key (item_id, loja_id)
);
create index if not exists itens_lojas_loja_idx on itens_lojas (loja_id) where not disponivel;
alter table itens_lojas enable row level security;
create policy pub_itens_lojas on itens_lojas for select using (true);
create policy ed_itens_lojas on itens_lojas for all
  using (exists (select 1 from itens i where i.id = item_id and pode_editar(i.tenant_id)))
  with check (exists (select 1 from itens i where i.id = item_id and pode_editar(i.tenant_id)));

-- Preço por loja. Um vigente por variante e loja; o base é o de loja nula.
alter table precos add column if not exists loja_id uuid references lojas(id) on delete cascade;
create unique index if not exists precos_um_vigente
  on precos (variante_id, coalesce(loja_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where vigencia_fim is null;

-- A view era usada pela régua de preço suspeito. Continua olhando só o base.
create or replace view precos_vigentes with (security_invoker = true) as
  select distinct on (variante_id) variante_id, valor_centavos, vigencia_inicio
  from precos
  where loja_id is null
    and vigencia_inicio <= now()
    and (vigencia_fim is null or vigencia_fim > now())
  order by variante_id, vigencia_inicio desc;

-- Subtítulos dentro das seções (Sucos naturais, Pizzas doces, Omeletes…)
create table if not exists grupos (
  id        uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  secao_id  uuid not null references secoes(id) on delete cascade,
  nome      text not null,
  nota      text,
  ordem     integer not null default 0,
  unique (secao_id, nome)
);
alter table grupos enable row level security;
create policy pub_grupos on grupos for select using (true);
create policy ed_grupos on grupos for all using (pode_editar(tenant_id)) with check (pode_editar(tenant_id));

alter table itens add column if not exists grupo_id uuid references grupos(id) on delete set null;
create index if not exists itens_grupo_idx on itens (grupo_id, ordem);

-- O cardápio impresso usa o mesmo código PDV em duas seções com preços
-- diferentes (2224 e 26767: acréscimo no suco x no açaí). Único por seção.
alter table itens drop constraint if exists itens_tenant_id_codigo_pdv_key;
alter table itens add constraint itens_tenant_secao_codigo_key unique (tenant_id, secao_id, codigo_pdv);

-- Vitrine por loja (null = aparece nas duas)
alter table promocoes   add column if not exists loja_id uuid references lojas(id) on delete cascade;
alter table comunicados add column if not exists loja_id uuid references lojas(id) on delete cascade;
alter table imagens     add column if not exists loja_id uuid references lojas(id) on delete cascade;

-- Auditoria: quem tirou um item de uma loja
create or replace function fn_audit_item_loja() returns trigger
language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  select tenant_id into tid from itens where id = coalesce(new.item_id, old.item_id);
  insert into audit_log (tenant_id, user_id, acao, tabela, registro_id, antes, depois)
  values (tid, auth.uid(), lower(tg_op), 'itens_lojas', coalesce(new.item_id, old.item_id),
          case when tg_op = 'INSERT' then null else to_jsonb(old) end,
          case when tg_op = 'DELETE' then null else to_jsonb(new) end);
  return coalesce(new, old);
end $$;
revoke execute on function fn_audit_item_loja() from anon, authenticated, public;
drop trigger if exists tg_audit_itens_lojas on itens_lojas;
create trigger tg_audit_itens_lojas after insert or update or delete on itens_lojas
  for each row execute function fn_audit_item_loja();

-- As duas lojas
insert into lojas (tenant_id, slug, nome, desde, site, instagram, facebook, mapa, abre, fecha, ordem)
select t.id, v.slug, v.nome, v.desde, v.site, v.ig, v.fb, v.mapa, '07:00', '21:45', v.ordem
from tenants t, (values
  ('cambui', 'Pão do Cambuí', 1994, 'https://www.paodocambui.com.br', 'paodocambuioficial', 'panificadora.paodocambui',
   'https://www.google.com/maps/search/?api=1&query=P%C3%A3o+do+Camb%C3%BAi+Campinas', 0),
  ('primavera', 'Pão da Primavera', 1999, 'https://www.paodaprimavera.com.br', 'paodaprimaveracampinas', 'paodaprimavera',
   'https://www.google.com/maps/search/?api=1&query=P%C3%A3o+da+Primavera+Boulangerie+Campinas', 1)
) as v(slug, nome, desde, site, ig, fb, mapa, ordem)
where t.slug = 'pao-da-primavera'
on conflict (tenant_id, slug) do nothing;

update tenants set nome = 'Pão do Cambuí e Pão da Primavera' where slug = 'pao-da-primavera';
