-- 20260831110830_0001_menu_pdp_estrutura.sql
-- Tabelas, tipos, índices e a view de preços vigentes.
-- Aplicada em 31/08/2026 no projeto akahkfstgicfamfsibvw.

create extension if not exists "uuid-ossp";
create extension if not exists "unaccent";
create extension if not exists "pg_trgm";

-- ============ TENANTS E PESSOAS ============

create table tenants (
  id           uuid primary key default uuid_generate_v4(),
  slug         text unique not null,
  nome         text not null,
  assinatura   text,
  site         text,
  instagram    text,
  facebook     text,
  rodape_legal text,
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

-- SECURITY DEFINER para não recursar dentro das próprias policies.
create or replace function meu_papel(t uuid)
returns papel language sql stable security definer set search_path = public as $$
  select papel from membros where user_id = auth.uid() and tenant_id = t limit 1;
$$;

create or replace function pode_editar(t uuid)
returns boolean language sql stable set search_path = public as $$
  select meu_papel(t) in ('cliente_editor','agencia','owner');
$$;

create or replace function pode_publicar(t uuid)
returns boolean language sql stable set search_path = public as $$
  select meu_papel(t) in ('agencia','owner');
$$;

-- ============ ESTRUTURA DO MENU ============

create table secoes (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  slug        text not null,
  nome        text not null,
  subtitulo   text,
  ordem       int  not null default 0,
  hora_inicio time,
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
  codigo_pdv    text,                          -- chave de conciliação com o PDV
  nome          text not null,
  descricao     text,
  observacao    text,
  tags          text[] default '{}',
  ordem         int not null default 0,
  status        status_item not null default 'rascunho',
  esgotado      boolean not null default false,
  esgotado_ate  timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (tenant_id, codigo_pdv)
);

create index itens_secao_idx  on itens (tenant_id, secao_id, ordem);
create index itens_status_idx on itens (tenant_id, status);
create index itens_busca_idx  on itens
  using gin ((nome || ' ' || coalesce(descricao,'')) gin_trgm_ops);

-- Tamanho/porção. Item simples tem exatamente uma variante ('unica').
create table variantes (
  id        uuid primary key default uuid_generate_v4(),
  item_id   uuid not null references itens(id) on delete cascade,
  rotulo    text not null default 'unica',
  gramatura text,
  ordem     int not null default 0
);
create index variantes_item_idx on variantes (item_id, ordem);

-- Preço é histórico, não coluna: permite reajuste agendado e auditoria.
create table precos (
  id              uuid primary key default uuid_generate_v4(),
  variante_id     uuid not null references variantes(id) on delete cascade,
  valor_centavos  int  not null check (valor_centavos > 0),
  vigencia_inicio timestamptz not null default now(),
  vigencia_fim    timestamptz,
  criado_por      uuid references auth.users(id),
  criado_em       timestamptz not null default now()
);
create index precos_variante_idx on precos (variante_id, vigencia_inicio desc);

create view precos_vigentes with (security_invoker = true) as
  select distinct on (variante_id) variante_id, valor_centavos, vigencia_inicio
  from precos
  where vigencia_inicio <= now() and (vigencia_fim is null or vigencia_fim > now())
  order by variante_id, vigencia_inicio desc;

-- ============ IMAGENS ============

create type papel_imagem as enum ('regular','destaque','hero','promo');

create table imagens (
  id           uuid primary key default uuid_generate_v4(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  item_id      uuid references itens(id) on delete cascade,
  papel        papel_imagem not null default 'regular',
  storage_path text not null,
  alt          text,
  largura      int,
  altura       int,
  foco_x       numeric(3,2) not null default 0.5 check (foco_x between 0 and 1),
  foco_y       numeric(3,2) not null default 0.5 check (foco_y between 0 and 1),
  creditos     text,
  criado_em    timestamptz not null default now()
);

create unique index imagens_papel_unico on imagens (item_id, papel)
  where papel in ('destaque','hero');

-- ============ BANNERS, PROMOÇÕES, COMUNICADOS ============

create table banners (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  posicao     text not null default 'hero',
  titulo      text,
  linha_apoio text,
  imagem_id   uuid references imagens(id) on delete set null,
  item_id     uuid references itens(id) on delete set null,
  ordem       int not null default 0,
  inicio      timestamptz,
  fim         timestamptz,
  ativo       boolean not null default true
);

create table promocoes (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  titulo      text not null,
  chamada     text,
  selo        text,
  inicio      timestamptz not null,
  fim         timestamptz not null,
  dias_semana int[] default '{0,1,2,3,4,5,6}',
  ativo       boolean not null default true,
  check (fim > inicio)
);

create table promocao_itens (
  promocao_id          uuid references promocoes(id) on delete cascade,
  variante_id          uuid references variantes(id) on delete cascade,
  preco_promo_centavos int not null check (preco_promo_centavos > 0),
  primary key (promocao_id, variante_id)
);

create type nivel_comunicado as enum ('info','atencao','urgente');

create table comunicados (
  id         uuid primary key default uuid_generate_v4(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  texto      text not null,
  nivel      nivel_comunicado not null default 'info',
  inicio     timestamptz not null default now(),
  fim        timestamptz,
  ativo      boolean not null default true,
  criado_por uuid references auth.users(id)
);

-- ============ PUBLICAÇÃO E AUDITORIA ============

create type status_versao as enum ('rascunho','em_revisao','publicada','revertida');

create table versoes (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  numero        int not null,
  status        status_versao not null default 'rascunho',
  snapshot      jsonb,                         -- é o que permite rollback
  nota          text,
  enviada_por   uuid references auth.users(id),
  enviada_em    timestamptz,
  publicada_por uuid references auth.users(id),
  publicada_em  timestamptz,
  unique (tenant_id, numero)
);

create table revisoes_ia (
  id             uuid primary key default uuid_generate_v4(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  entidade       text not null,
  entidade_id    uuid,
  campo          text not null,
  texto_original text not null,
  texto_sugerido text,
  alteracoes     jsonb,
  alertas        jsonb,
  decisao        text check (decisao in ('aceita','recusada','pendente')) default 'pendente',
  decidido_por   uuid references auth.users(id),
  criado_em      timestamptz not null default now()
);

create table audit_log (
  id          bigserial primary key,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  user_id     uuid references auth.users(id),
  acao        text not null,
  tabela      text not null,
  registro_id uuid,
  antes       jsonb,
  depois      jsonb,
  em          timestamptz not null default now()
);
create index audit_log_idx on audit_log (tenant_id, em desc);
