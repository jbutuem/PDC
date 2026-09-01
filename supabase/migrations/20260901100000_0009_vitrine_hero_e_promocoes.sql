-- Aplicada em produção em 01/09/2026. Registrada aqui para o histórico
-- do repositório acompanhar o banco.

-- A hero deixa de emprestar o texto de um item do cardápio.
alter table imagens
  add column if not exists chamada     text,
  add column if not exists titulo      text,
  add column if not exists linha_apoio text;

comment on column imagens.chamada is 'Etiqueta curta acima do título na hero. Ex.: DA CHAPA, AGORA';
comment on column imagens.titulo  is 'Título da hero/destaque. Se nulo, usa o nome do item vinculado.';

-- Promoções ganham os campos que o card da home já exibia e que antes viviam
-- escritos à mão dentro de app/page.js.
alter table promocoes
  add column if not exists preco_de_centavos  integer,
  add column if not exists preco_por_centavos integer,
  add column if not exists observacao         text,
  add column if not exists tipo               text not null default 'oferta',
  add column if not exists imagem_id          uuid references imagens(id) on delete set null,
  add column if not exists ordem              integer not null default 0;

alter table promocoes drop constraint if exists promocoes_tipo_check;
alter table promocoes add constraint promocoes_tipo_check
  check (tipo in ('oferta', 'novo', 'tempo'));

alter table promocoes drop constraint if exists promocoes_precos_check;
alter table promocoes add constraint promocoes_precos_check
  check (preco_de_centavos is null or preco_por_centavos is null
         or preco_de_centavos > preco_por_centavos);

alter table promocoes drop constraint if exists promocoes_periodo_check;
alter table promocoes add constraint promocoes_periodo_check check (fim > inicio);

create index if not exists promocoes_vitrine_idx
  on promocoes (tenant_id, ativo, ordem) where ativo;
