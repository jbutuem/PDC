-- 20260831111400_0005a_tenant_e_secoes.sql
-- O tenant, as 9 seções e o comunicado inicial.
-- Precisa vir ANTES do seed dos itens.
-- Aplicada em 31/08/2026 no projeto akahkfstgicfamfsibvw.

insert into tenants (slug, nome, assinatura, site, instagram, facebook, rodape_legal)
values (
  'pao-da-primavera',
  'Pão da Primavera',
  'Boulangerie — Desde 1999',
  'www.paodaprimavera.com.br',
  'paodaprimaveracampinas',
  'paodaprimavera',
  'O acesso às dependências onde são preparados e armazenados nossos alimentos é garantido pela lei nº 8431, de 17 de julho de 1995. Proibida a venda de bebidas alcoólicas para menores de 18 anos. Procon Campinas – R. Maria Monteiro, 1028 – Cambuí, Campinas/SP – CEP 13.025-151. Disque 151. Art. 5 – No caso de divergência de preço para o mesmo produto entre sistemas de informação de preços utilizados pelo estabelecimento, o consumidor pagará o menor dentre eles – Lei Federal nº 10.962/04.'
)
on conflict (slug) do nothing;

insert into secoes (tenant_id, slug, nome, subtitulo, ordem, hora_inicio, hora_fim)
select t.id, s.slug, s.nome, s.sub, s.ord, s.hi::time, s.hf::time
from tenants t, (values
  ('cafes',      'Cafés e matinais',      null,                                 0, null,    null),
  ('toasts',     'Toasts e ciabattas',    null,                                 1, null,    null),
  ('tapiocas',   'Tapiocas e crepiocas',  null,                                 2, null,    null),
  ('sanduiches', 'Sanduíches',            null,                                 3, null,    null),
  ('burgers',    'Hambúrgueres e mignon', null,                                 4, null,    null),
  ('pizzas',     'Pizzas',                'Todos os dias, das 17h30 às 21h45',  5, '17:30', '21:45'),
  ('bebidas',    'Bebidas',               null,                                 6, null,    null),
  ('acai',       'Açaí e doces',          null,                                 7, null,    null),
  ('refeicoes',  'Refeições',             'Executivos das 15h às 21h45',        8, null,    null)
) as s(slug, nome, sub, ord, hi, hf)
where t.slug = 'pao-da-primavera'
on conflict (tenant_id, slug) do nothing;

-- Comunicado de exemplo. Apague quando for para produção de verdade.
insert into comunicados (tenant_id, texto, nivel)
select id, '<b>Feriado 7/9:</b> abrimos das 7h às 14h. Almoço por quilo até 13h30.', 'atencao'
from tenants where slug = 'pao-da-primavera';
