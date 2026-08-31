-- =====================================================================
-- MENU DIGITAL — Pão da Primavera / Pão do Cambuí
-- Supabase / Postgres — schema, RLS e seed inicial
-- =====================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "unaccent";
create extension if not exists "pg_trgm";   -- busca por similaridade (erro de digitação na busca)

-- ---------------------------------------------------------------------
-- 1. TENANTS E PESSOAS
-- ---------------------------------------------------------------------

create table tenants (
  id           uuid primary key default uuid_generate_v4(),
  slug         text unique not null,          -- 'pao-da-primavera'
  nome         text not null,
  assinatura   text,                          -- 'Boulangerie — Desde 1999'
  site         text,
  instagram    text,
  facebook     text,
  rodape_legal text,                          -- avisos Procon / Lei 10.962
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now()
);

create type papel as enum ('viewer','operador','cliente_editor','agencia','owner');

create table membros (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  tenant_id  uuid not null references tenants(id) on delete cascade,
  papel      papel not null default 'viewer',
  nome       text,
  criado_em  timestamptz not null default now(),
  unique (user_id, tenant_id)
);

-- Helpers usados por todas as policies. SECURITY DEFINER para não recursar em RLS.
create or replace function meu_papel(t uuid)
returns papel language sql stable security definer set search_path = public as $$
  select papel from membros where user_id = auth.uid() and tenant_id = t limit 1;
$$;

create or replace function pode_editar(t uuid)
returns boolean language sql stable as $$
  select meu_papel(t) in ('cliente_editor','agencia','owner');
$$;

create or replace function pode_publicar(t uuid)
returns boolean language sql stable as $$
  select meu_papel(t) in ('agencia','owner');
$$;

-- ---------------------------------------------------------------------
-- 2. ESTRUTURA DO MENU
-- ---------------------------------------------------------------------

create table secoes (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  slug        text not null,                  -- 'pizzas'
  nome        text not null,                  -- 'Pizzas'
  subtitulo   text,                           -- 'Todos os dias, das 17h30 às 21h45'
  ordem       int  not null default 0,
  hora_inicio time,                           -- disponibilidade; null = sempre
  hora_fim    time,
  dias_semana int[] default '{0,1,2,3,4,5,6}',
  visivel     boolean not null default true,
  unique (tenant_id, slug)
);

create type status_item as enum ('rascunho','publicado','arquivado');

create table itens (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  secao_id      uuid not null references secoes(id) on delete restrict,
  codigo_pdv    text,                          -- 6593, 5002... chave de conciliação com o PDV
  nome          text not null,
  descricao     text,                          -- ingredientes
  observacao    text,                          -- 'Acompanha pão francês 1 un.'
  tags          text[] default '{}',           -- 'vegetariano','sem-gluten','novo'
  ordem         int not null default 0,
  status        status_item not null default 'rascunho',
  esgotado      boolean not null default false,-- única escrita direta em produção (operador)
  esgotado_ate  timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (tenant_id, codigo_pdv)
);

create index on itens (tenant_id, secao_id, ordem);
create index itens_busca_idx on itens using gin ((nome || ' ' || coalesce(descricao,'')) gin_trgm_ops);

-- Tamanho / porção. Item simples tem exatamente uma variante ('unica').
create table variantes (
  id        uuid primary key default uuid_generate_v4(),
  item_id   uuid not null references itens(id) on delete cascade,
  rotulo    text not null default 'unica',    -- 'GDE. 35 cm', 'PEQ. 25 cm', '400 ml'
  gramatura text,                             -- '250 g', '400 ml'
  ordem     int not null default 0
);

-- Preço é histórico, não coluna. Permite reajuste agendado e auditoria.
create table precos (
  id              uuid primary key default uuid_generate_v4(),
  variante_id     uuid not null references variantes(id) on delete cascade,
  valor_centavos  int  not null check (valor_centavos > 0),
  vigencia_inicio timestamptz not null default now(),
  vigencia_fim    timestamptz,                -- null = vigente
  criado_por      uuid references auth.users(id),
  criado_em       timestamptz not null default now()
);

create index on precos (variante_id, vigencia_inicio desc);

create or replace view precos_vigentes as
  select distinct on (variante_id) variante_id, valor_centavos, vigencia_inicio
  from precos
  where vigencia_inicio <= now() and (vigencia_fim is null or vigencia_fim > now())
  order by variante_id, vigencia_inicio desc;

-- ---------------------------------------------------------------------
-- 3. IMAGENS
-- ---------------------------------------------------------------------

create type papel_imagem as enum ('regular','destaque','hero');

create table imagens (
  id         uuid primary key default uuid_generate_v4(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  item_id    uuid references itens(id) on delete cascade,
  papel      papel_imagem not null default 'regular',
  storage_path text not null,                 -- 'pdp/itens/5002-marguerita.jpg'
  alt        text,
  largura    int,
  altura     int,
  foco_x     numeric(3,2) not null default 0.5 check (foco_x between 0 and 1),
  foco_y     numeric(3,2) not null default 0.5 check (foco_y between 0 and 1),
  creditos   text,
  criado_em  timestamptz not null default now()
);

-- Um item não pode ter dois heróis nem dois destaques.
create unique index on imagens (item_id, papel) where papel in ('destaque','hero');

-- ---------------------------------------------------------------------
-- 4. BANNERS, PROMOÇÕES, COMUNICADOS
-- ---------------------------------------------------------------------

create table banners (
  id           uuid primary key default uuid_generate_v4(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  posicao      text not null default 'hero',  -- 'hero' | 'faixa'
  titulo       text,
  linha_apoio  text,
  imagem_id    uuid references imagens(id) on delete set null,
  item_id      uuid references itens(id) on delete set null,  -- destino do toque
  ordem        int not null default 0,
  inicio       timestamptz,
  fim          timestamptz,
  ativo        boolean not null default true
);

create table promocoes (
  id                uuid primary key default uuid_generate_v4(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  titulo            text not null,            -- 'Terça da Pizza'
  chamada           text,                     -- 'Grande por R$ 79,90 o dia todo'
  inicio            timestamptz not null,
  fim               timestamptz not null,
  dias_semana       int[] default '{0,1,2,3,4,5,6}',
  ativo             boolean not null default true,
  check (fim > inicio)
);

create table promocao_itens (
  promocao_id            uuid references promocoes(id) on delete cascade,
  variante_id            uuid references variantes(id) on delete cascade,
  preco_promo_centavos   int not null check (preco_promo_centavos > 0),
  primary key (promocao_id, variante_id)
);

create type nivel_comunicado as enum ('info','atencao','urgente');

create table comunicados (
  id        uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  texto     text not null,
  nivel     nivel_comunicado not null default 'info',
  inicio    timestamptz not null default now(),
  fim       timestamptz,
  ativo     boolean not null default true,
  criado_por uuid references auth.users(id)
);

-- ---------------------------------------------------------------------
-- 5. PUBLICAÇÃO, REVISÃO E AUDITORIA
-- ---------------------------------------------------------------------

create type status_versao as enum ('rascunho','em_revisao','publicada','revertida');

create table versoes (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  numero        int not null,                 -- incremental por tenant
  status        status_versao not null default 'rascunho',
  snapshot      jsonb,                        -- menu inteiro congelado: é o que permite rollback
  nota          text,                         -- 'Reajuste de agosto'
  enviada_por   uuid references auth.users(id),
  enviada_em    timestamptz,
  publicada_por uuid references auth.users(id),
  publicada_em  timestamptz,
  unique (tenant_id, numero)
);

create table revisoes_ia (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  entidade      text not null,                -- 'itens' | 'comunicados' | 'banners'
  entidade_id   uuid,
  campo         text not null,                -- 'nome' | 'descricao'
  texto_original text not null,
  texto_sugerido text,
  alteracoes    jsonb,                        -- [{de, para, tipo}]
  alertas       jsonb,                        -- [{tipo, msg}]
  decisao       text check (decisao in ('aceita','recusada','pendente')) default 'pendente',
  decidido_por  uuid references auth.users(id),
  criado_em     timestamptz not null default now()
);

create table audit_log (
  id         bigserial primary key,
  tenant_id  uuid not null references tenants(id) on delete cascade,
  user_id    uuid references auth.users(id),
  acao       text not null,                   -- 'insert' | 'update' | 'delete' | 'publish'
  tabela     text not null,
  registro_id uuid,
  antes      jsonb,
  depois     jsonb,
  em         timestamptz not null default now()
);

create index on audit_log (tenant_id, em desc);

create or replace function fn_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  tid := coalesce(new.tenant_id, old.tenant_id);
  insert into audit_log (tenant_id, user_id, acao, tabela, registro_id, antes, depois)
  values (tid, auth.uid(), lower(tg_op), tg_table_name,
          coalesce(new.id, old.id),
          case when tg_op = 'INSERT' then null else to_jsonb(old) end,
          case when tg_op = 'DELETE' then null else to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create trigger tg_audit_itens after insert or update or delete on itens
  for each row execute function fn_audit();
create trigger tg_audit_secoes after insert or update or delete on secoes
  for each row execute function fn_audit();
create trigger tg_audit_comunicados after insert or update or delete on comunicados
  for each row execute function fn_audit();

-- Preço não tem tenant_id direto; audita pelo item.
create or replace function fn_audit_preco() returns trigger
language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  select i.tenant_id into tid
  from variantes v join itens i on i.id = v.item_id
  where v.id = coalesce(new.variante_id, old.variante_id);
  insert into audit_log (tenant_id, user_id, acao, tabela, registro_id, antes, depois)
  values (tid, auth.uid(), lower(tg_op), 'precos', coalesce(new.id, old.id),
          case when tg_op = 'INSERT' then null else to_jsonb(old) end,
          case when tg_op = 'DELETE' then null else to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create trigger tg_audit_precos after insert or update or delete on precos
  for each row execute function fn_audit_preco();

-- ---------------------------------------------------------------------
-- 6. VALIDAÇÕES DETERMINÍSTICAS (o que não deve depender de IA)
-- ---------------------------------------------------------------------

-- Bloqueia publicar item sem preço vigente.
create or replace function fn_valida_publicacao() returns trigger
language plpgsql as $$
begin
  if new.status = 'publicado' then
    if not exists (
      select 1 from variantes v join precos_vigentes p on p.variante_id = v.id
      where v.item_id = new.id
    ) then
      raise exception 'Item % não pode ser publicado: nenhum preço vigente.', new.nome;
    end if;
  end if;
  new.atualizado_em := now();
  return new;
end $$;

create trigger tg_valida_publicacao before insert or update on itens
  for each row execute function fn_valida_publicacao();

-- Preço fora de ±40% da média da seção: não bloqueia, sinaliza para revisão humana.
create or replace function preco_suspeito(p_variante uuid, p_valor int)
returns boolean language sql stable as $$
  with sec as (
    select i.secao_id from variantes v join itens i on i.id = v.item_id where v.id = p_variante
  ),
  media as (
    select avg(pv.valor_centavos) m
    from itens i
    join variantes v on v.item_id = i.id
    join precos_vigentes pv on pv.variante_id = v.id
    where i.secao_id = (select secao_id from sec) and i.status = 'publicado'
  )
  select case when (select m from media) is null then false
              else abs(p_valor - (select m from media)) > (select m from media) * 0.4 end;
$$;

-- ---------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------

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

-- Leitura pública: só o que está publicado e visível.
create policy pub_tenants on tenants for select using (ativo);
create policy pub_secoes  on secoes  for select using (visivel);
create policy pub_itens   on itens   for select using (status = 'publicado');
create policy pub_var     on variantes for select using (
  exists (select 1 from itens i where i.id = item_id and i.status = 'publicado'));
create policy pub_precos  on precos for select using (
  exists (select 1 from variantes v join itens i on i.id = v.item_id
          where v.id = variante_id and i.status = 'publicado'));
create policy pub_img     on imagens for select using (true);
create policy pub_banners on banners for select using (
  ativo and (inicio is null or inicio <= now()) and (fim is null or fim > now()));
create policy pub_promo   on promocoes for select using (ativo and now() between inicio and fim);
create policy pub_promoi  on promocao_itens for select using (true);
create policy pub_com     on comunicados for select using (
  ativo and inicio <= now() and (fim is null or fim > now()));

-- Membros veem o próprio vínculo.
create policy m_self on membros for select using (user_id = auth.uid());

-- Edição: cliente_editor, agencia, owner.
create policy ed_itens on itens for all
  using (pode_editar(tenant_id)) with check (pode_editar(tenant_id));
create policy ed_secoes on secoes for all
  using (pode_editar(tenant_id)) with check (pode_editar(tenant_id));
create policy ed_img on imagens for all
  using (pode_editar(tenant_id)) with check (pode_editar(tenant_id));
create policy ed_com on comunicados for all
  using (pode_editar(tenant_id)) with check (pode_editar(tenant_id));
create policy ed_promo on promocoes for all
  using (pode_editar(tenant_id)) with check (pode_editar(tenant_id));
create policy ed_rev on revisoes_ia for all
  using (pode_editar(tenant_id)) with check (pode_editar(tenant_id));

create policy ed_var on variantes for all using (
  exists (select 1 from itens i where i.id = item_id and pode_editar(i.tenant_id)));
create policy ed_precos on precos for all using (
  exists (select 1 from variantes v join itens i on i.id = v.item_id
          where v.id = variante_id and pode_editar(i.tenant_id)));

-- Banners e hero: só a agência.
create policy ag_banners on banners for all
  using (pode_publicar(tenant_id)) with check (pode_publicar(tenant_id));

-- Publicação: só agencia/owner.
create policy ag_versoes on versoes for all
  using (pode_publicar(tenant_id)) with check (pode_publicar(tenant_id));

-- Auditoria: leitura pela agência, escrita só pelos triggers.
create policy ag_audit on audit_log for select using (pode_publicar(tenant_id));

-- Exceção deliberada: operador marca esgotado direto em produção.
-- (aplicar via RPC com security definer, para restringir o UPDATE a essas colunas)
create or replace function marcar_esgotado(p_item uuid, p_esgotado boolean, p_ate timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  select tenant_id into tid from itens where id = p_item;
  if meu_papel(tid) not in ('operador','cliente_editor','agencia','owner') then
    raise exception 'Sem permissão.';
  end if;
  update itens set esgotado = p_esgotado, esgotado_ate = p_ate, atualizado_em = now()
  where id = p_item;
end $$;

-- ---------------------------------------------------------------------
-- 8. SEED
-- ---------------------------------------------------------------------

insert into tenants (slug, nome, assinatura, site, instagram, facebook, rodape_legal)
values ('pao-da-primavera', 'Pão da Primavera', 'Boulangerie — Desde 1999',
        'www.paodaprimavera.com.br', 'paodaprimaveracampinas', 'paodaprimavera',
        'O acesso às dependências onde são preparados e armazenados nossos alimentos é garantido pela lei nº 8431, de 17 de julho de 1995. Proibida a venda de bebidas alcoólicas para menores de 18 anos. Procon Campinas – R. Maria Monteiro, 1028 – Cambuí, Campinas/SP. Disque 151. Art. 5 – No caso de divergência de preço para o mesmo produto entre sistemas de informação de preços utilizados pelo estabelecimento, o consumidor pagará o menor dentre eles – Lei Federal nº 10.962/04.');

insert into secoes (tenant_id, slug, nome, subtitulo, ordem, hora_inicio, hora_fim)
select id, s.slug, s.nome, s.sub, s.ord, s.hi, s.hf from tenants, (values
  ('cafes',      'Cafés e matinais',   null,                                  1, null,        null),
  ('toasts',     'Toasts e ciabattas', null,                                  2, null,        null),
  ('tapiocas',   'Tapiocas e crepiocas', null,                                3, null,        null),
  ('sanduiches', 'Sanduíches',         null,                                  4, null,        null),
  ('burgers',    'Hambúrgueres e mignon', null,                               5, null,        null),
  ('pizzas',     'Pizzas',             'Todos os dias, das 17h30 às 21h45',   6, '17:30'::time,'21:45'::time),
  ('bebidas',    'Bebidas',            null,                                  7, null,        null),
  ('acai',       'Açaí e doces',       null,                                  8, null,        null),
  ('refeicoes',  'Refeições',          'Executivos das 15h às 21h45',         9, null,        null)
) as s(slug, nome, sub, ord, hi, hf)
where tenants.slug = 'pao-da-primavera';

-- Exemplo de item completo com duas variantes e preços vigentes.
with t as (select id from tenants where slug = 'pao-da-primavera'),
     s as (select id from secoes where slug = 'pizzas' and tenant_id = (select id from t)),
     i as (
       insert into itens (tenant_id, secao_id, codigo_pdv, nome, descricao, tags, status, ordem)
       values ((select id from t), (select id from s), '5002', 'Marguerita',
               'Muçarela, parmesão, manjericão, tomate e azeitonas',
               '{vegetariano}', 'rascunho', 4)
       returning id
     ),
     vg as (
       insert into variantes (item_id, rotulo, gramatura, ordem)
       values ((select id from i), 'GDE. 35 cm', null, 0) returning id
     ),
     vp as (
       insert into variantes (item_id, rotulo, gramatura, ordem)
       values ((select id from i), 'PEQ. 25 cm', null, 1) returning id
     )
insert into precos (variante_id, valor_centavos)
values ((select id from vg), 9990), ((select id from vp), 6990);

-- O restante dos ~200 itens entra pelo script de importação
-- (extração do PDF + docx já concluída; ver scripts/seed.ts).
