-- 20260831111500_0005_seed_cardapio.sql
-- Os 101 itens e 117 preços extraídos do cardápio impresso 2026.
-- Idempotente: casa por codigo_pdv, rodar de novo não duplica.
--
-- ATENÇÃO: estes preços vieram de extração automática do PDF.
-- A conferência humana de duas pessoas (Etapa 2.4 do runbook) NÃO foi feita.
-- Se o PDF original trouxer um preço errado, ele entrou aqui igual.
--
-- Pré-requisito: o tenant 'pao-da-primavera' e as 9 seções já devem existir.
-- Ver 20260831111400_0005_tenant_e_secoes.sql

do $$
declare
  v_tenant uuid; v_secao uuid; v_item uuid; v_var uuid; r record; k int;
begin
  select id into v_tenant from tenants where slug='pao-da-primavera';
  for r in select * from (values
    ('cafes','2201','Pão francês na chapa com manteiga','70 g',ARRAY['vegetariano']::text[],0,false,ARRAY['unica']::text[], ARRAY[1050]::int[]),
    ('cafes','2009','Pão francês, integral ou caseiro com manteiga na chapa','70 g',ARRAY['vegetariano']::text[],1,false,ARRAY['unica']::text[], ARRAY[1290]::int[]),
    ('cafes','3096','Pão francês, integral ou caseiro com requeijão','120 g',ARRAY['vegetariano']::text[],2,false,ARRAY['unica']::text[], ARRAY[1380]::int[]),
    ('cafes','6821','Pão de fermentação natural com requeijão na chapa','120 g','{}'::text[],3,false,ARRAY['unica']::text[], ARRAY[1490]::int[]),
    ('cafes','6025','Baguete de fermentação natural com requeijão casquinha','140 g','{}'::text[],4,false,ARRAY['unica']::text[], ARRAY[1990]::int[]),
    ('cafes','6547','Croissant na chapa com manteiga','90 g','{}'::text[],5,false,ARRAY['unica']::text[], ARRAY[1490]::int[]),
    ('cafes','6548','Croissant com requeijão casquinha na chapa','140 g',ARRAY['vegetariano']::text[],6,false,ARRAY['unica']::text[], ARRAY[1700]::int[]),
    ('cafes','2418','2 ovos mexidos ou fritos','100 g',ARRAY['vegetariano']::text[],7,false,ARRAY['unica']::text[], ARRAY[1490]::int[]),
    ('cafes','2301','Café espresso','50 ml','{}'::text[],8,false,ARRAY['unica']::text[], ARRAY[950]::int[]),
    ('cafes','2465','Cappuccino','180 ml','{}'::text[],9,false,ARRAY['unica']::text[], ARRAY[1790]::int[]),
    ('cafes','2307','Pingado','180 ml','{}'::text[],10,false,ARRAY['unica']::text[], ARRAY[1290]::int[]),
    ('cafes','2775','Cappuccino Paris','Café, creme Paris e chantilly — 200 ml','{}'::text[],11,false,ARRAY['unica']::text[], ARRAY[2690]::int[]),
    ('cafes','2460','Chocolate grande','Quente ou frio — 350 ml','{}'::text[],12,false,ARRAY['unica']::text[], ARRAY[1790]::int[]),
    ('cafes','2284','Cappuccino gelado com chantilly','350 ml','{}'::text[],13,false,ARRAY['unica']::text[], ARRAY[2490]::int[]),
    ('toasts','6593','Toast de abacate','Creme de abacate, cebola roxa, mix de castanhas, ovo e batata chips — 250 g',ARRAY['vegetariano']::text[],0,false,ARRAY['unica']::text[], ARRAY[4590]::int[]),
    ('toasts','6633','Toast de roast beef','Roast beef caseiro temperado, parmesão, ovo e batata chips — 200 g','{}'::text[],1,false,ARRAY['unica']::text[], ARRAY[4290]::int[]),
    ('toasts','6040','Toast no pão italiano','Ovo, queijo fresco, tomate e manjericão — 150 g',ARRAY['vegetariano']::text[],2,false,ARRAY['unica']::text[], ARRAY[4590]::int[]),
    ('toasts','5998','Toast de bacon e ricota','Pão italiano, ovos, bacon Sadia® e creme de ricota — 150 g','{}'::text[],3,false,ARRAY['unica']::text[], ARRAY[4590]::int[]),
    ('toasts','6595','Ciabatta de muçarela','Muçarela 80 g, tomate, manjericão e orégano',ARRAY['vegetariano']::text[],4,false,ARRAY['unica']::text[], ARRAY[3290]::int[]),
    ('toasts','6596','Ciabatta de roast beef','Roast beef caseiro 100 g, patê de gorgonzola e rúcula','{}'::text[],5,false,ARRAY['unica']::text[], ARRAY[4590]::int[]),
    ('tapiocas','6609','Tapioca de frango com requeijão','200 g','{}'::text[],0,false,ARRAY['unica']::text[], ARRAY[3190]::int[]),
    ('tapiocas','6611','Tapioca de presunto e queijo','Prato ou muçarela — 200 g','{}'::text[],1,false,ARRAY['unica']::text[], ARRAY[3190]::int[]),
    ('tapiocas','6610','Tapioca de peito de peru com queijo','Fresco, prato ou muçarela — 200 g','{}'::text[],2,false,ARRAY['unica']::text[], ARRAY[3520]::int[]),
    ('tapiocas','6615','Tapioca de queijo fresco','200 g',ARRAY['vegetariano']::text[],3,false,ARRAY['unica']::text[], ARRAY[3520]::int[]),
    ('tapiocas','6613','Tapioca de morango com Nutella®','200 g',ARRAY['vegetariano']::text[],4,false,ARRAY['unica']::text[], ARRAY[3520]::int[]),
    ('tapiocas','2037','Crepioca de frango com requeijão','250 g','{}'::text[],5,false,ARRAY['unica']::text[], ARRAY[3520]::int[]),
    ('tapiocas','3054','Crepioca de presunto e queijo prato','Tomate e cebola — 250 g','{}'::text[],6,false,ARRAY['unica']::text[], ARRAY[3520]::int[]),
    ('tapiocas','8027','Crepioca de peito de peru e queijo fresco','250 g','{}'::text[],7,false,ARRAY['unica']::text[], ARRAY[3890]::int[]),
    ('tapiocas','8008','Crepioca de queijo fresco','200 g',ARRAY['vegetariano']::text[],8,false,ARRAY['unica']::text[], ARRAY[3890]::int[]),
    ('sanduiches','2419','Americano','Presunto Sadia®, queijo prato, alface, tomate e ovo — 80 g','{}'::text[],0,false,ARRAY['unica']::text[], ARRAY[3190]::int[]),
    ('sanduiches','2420','Bauru','Presunto Sadia®, queijo prato e tomate — 80 g','{}'::text[],1,false,ARRAY['unica']::text[], ARRAY[2790]::int[]),
    ('sanduiches','2421','Misto quente ou frio','Presunto Sadia® e queijo prato — 80 g','{}'::text[],2,false,ARRAY['unica']::text[], ARRAY[2490]::int[]),
    ('sanduiches','15437','Misto com muçarela de búfala','Presunto Sadia® e muçarela de búfala — 80 g','{}'::text[],3,false,ARRAY['unica']::text[], ARRAY[2990]::int[]),
    ('sanduiches','2050','Queijo fresco quente ou frio','80 g',ARRAY['vegetariano']::text[],4,true,ARRAY['unica']::text[], ARRAY[2590]::int[]),
    ('sanduiches','8005','Rosbife na baguete de fermentação natural','Queijo estepe, rúcula e tomate — 100 g','{}'::text[],5,false,ARRAY['unica']::text[], ARRAY[4890]::int[]),
    ('sanduiches','5997','Peito de peru na baguete de fermentação natural','Muçarela de búfala, rúcula e tomate — 100 g','{}'::text[],6,false,ARRAY['unica']::text[], ARRAY[4890]::int[]),
    ('sanduiches','6474','Filé mignon no croissant','Queijo prato, alface americana e tomate — 130 g','{}'::text[],7,false,ARRAY['unica']::text[], ARRAY[5190]::int[]),
    ('sanduiches','2445','Salame Sadia® e queijo provolone','100 g','{}'::text[],8,false,ARRAY['unica']::text[], ARRAY[4390]::int[]),
    ('sanduiches','2435','Rosbife, queijo gouda, tomate e pepino','100 g','{}'::text[],9,false,ARRAY['unica']::text[], ARRAY[4490]::int[]),
    ('sanduiches','2493','Mortadela Ceratti e queijo prato','100 g','{}'::text[],10,false,ARRAY['unica']::text[], ARRAY[3520]::int[]),
    ('sanduiches','8101','Calabresa com queijo prato e salada','100 g','{}'::text[],11,false,ARRAY['unica']::text[], ARRAY[3190]::int[]),
    ('burgers','2400','Hambúrguer com queijo prato','100 g','{}'::text[],0,false,ARRAY['unica']::text[], ARRAY[3790]::int[]),
    ('burgers','2401','Hambúrguer, queijo prato, alface e tomate','100 g','{}'::text[],1,false,ARRAY['unica']::text[], ARRAY[3990]::int[]),
    ('burgers','2402','Hambúrguer, queijo prato e bacon Sadia®','100 g','{}'::text[],2,false,ARRAY['unica']::text[], ARRAY[4190]::int[]),
    ('burgers','8020','Hambúrguer com cebola caramelizada e fritas','Queijo prato, alface, tomate e fritas — 100 g','{}'::text[],3,false,ARRAY['unica']::text[], ARRAY[5590]::int[]),
    ('burgers','8026','Hambúrguer completo','Queijo prato, presunto, ovo, bacon, alface, tomate e fritas — 100 g','{}'::text[],4,false,ARRAY['unica']::text[], ARRAY[5660]::int[]),
    ('burgers','2406','Filé mignon e queijo prato','100 g','{}'::text[],5,false,ARRAY['unica']::text[], ARRAY[4490]::int[]),
    ('burgers','2409','Filé mignon, queijo prato e bacon Sadia®','100 g','{}'::text[],6,false,ARRAY['unica']::text[], ARRAY[4890]::int[]),
    ('burgers','1462','Filé mignon, muçarela de búfala, rúcula e tomate','100 g','{}'::text[],7,false,ARRAY['unica']::text[], ARRAY[5190]::int[]),
    ('burgers','2411','Frango e queijo prato','100 g','{}'::text[],8,false,ARRAY['unica']::text[], ARRAY[3790]::int[]),
    ('burgers','3057','Porção de fritas','300 g',ARRAY['vegetariano']::text[],9,false,ARRAY['unica']::text[], ARRAY[3190]::int[]),
    ('pizzas','5000','Muçarela','Muçarela, tomate e azeitonas',ARRAY['vegetariano']::text[],0,false,ARRAY['GDE. 35 cm','PEQ. 25 cm']::text[], ARRAY[8890,6190]::int[]),
    ('pizzas','5002','Marguerita','Muçarela, parmesão, manjericão, tomate e azeitonas',ARRAY['vegetariano']::text[],1,false,ARRAY['GDE. 35 cm','PEQ. 25 cm']::text[], ARRAY[9990,6990]::int[]),
    ('pizzas','6259','Queijo brie com geleia de pimenta','Molho caseiro, muçarela, brie, geleia de pimenta e mel',ARRAY['vegetariano']::text[],2,false,ARRAY['GDE. 35 cm','PEQ. 25 cm']::text[], ARRAY[12590,8890]::int[]),
    ('pizzas','5001','Muçarela especial','Muçarela de búfala, tomate e azeitonas',ARRAY['vegetariano']::text[],3,false,ARRAY['GDE. 35 cm','PEQ. 25 cm']::text[], ARRAY[11090,7390]::int[]),
    ('pizzas','5064','Três queijos','Muçarela, provolone, catupiry e azeitonas',ARRAY['vegetariano']::text[],4,false,ARRAY['GDE. 35 cm','PEQ. 25 cm']::text[], ARRAY[11090,7990]::int[]),
    ('pizzas','5016','Quatro queijos','Muçarela, provolone, gorgonzola, catupiry e azeitonas',ARRAY['vegetariano']::text[],5,false,ARRAY['GDE. 35 cm','PEQ. 25 cm']::text[], ARRAY[11090,7990]::int[]),
    ('pizzas','5006','Portuguesa','Muçarela, presunto Sadia®, ovo, ervilha, cebola e azeitonas','{}'::text[],6,false,ARRAY['GDE. 35 cm','PEQ. 25 cm']::text[], ARRAY[9990,6990]::int[]),
    ('pizzas','5049','Portuguesa da casa','Búfala, peito de peru, ovo, ervilha, cebola e tomate-cereja','{}'::text[],7,false,ARRAY['GDE. 35 cm','PEQ. 25 cm']::text[], ARRAY[11090,7390]::int[]),
    ('pizzas','6255','Calabresa artesanal','Molho caseiro, búfala, calabresa defumada, parmesão e manjericão','{}'::text[],8,false,ARRAY['GDE. 35 cm','PEQ. 25 cm']::text[], ARRAY[11590,8090]::int[]),
    ('pizzas','5008','Calabresa da casa','Muçarela, calabresa fatiada, cebola e azeitonas','{}'::text[],9,false,ARRAY['GDE. 35 cm','PEQ. 25 cm']::text[], ARRAY[9490,6690]::int[]),
    ('pizzas','5068','Pepperoni especial','Muçarela, pepperoni Sadia®, pimenta americana, cebola roxa e champignon','{}'::text[],10,false,ARRAY['GDE. 35 cm','PEQ. 25 cm']::text[], ARRAY[13190,8890]::int[]),
    ('pizzas','5017','Frango com catupiry','Muçarela, frango desfiado, catupiry e azeitonas','{}'::text[],11,false,ARRAY['GDE. 35 cm','PEQ. 25 cm']::text[], ARRAY[9990,6990]::int[]),
    ('pizzas','5023','Brócolis','Muçarela, brócolis, bacon Sadia®, catupiry e azeitonas','{}'::text[],12,false,ARRAY['GDE. 35 cm','PEQ. 25 cm']::text[], ARRAY[10490,6990]::int[]),
    ('pizzas','5042','Pesto','Muçarela de búfala, tomate, azeitonas e molho pesto',ARRAY['vegetariano']::text[],13,false,ARRAY['GDE. 35 cm','PEQ. 25 cm']::text[], ARRAY[11090,7390]::int[]),
    ('pizzas','5041','Oriental','Muçarela, shimeji, shiitake, parmesão e azeitonas',ARRAY['vegetariano']::text[],14,false,ARRAY['GDE. 35 cm','PEQ. 25 cm']::text[], ARRAY[11090,7390]::int[]),
    ('pizzas','5043','Parma especial','Muçarela de búfala, presunto parma Speciale, tomate e azeitonas','{}'::text[],15,false,ARRAY['GDE. 35 cm','PEQ. 25 cm']::text[], ARRAY[15490,10490]::int[]),
    ('bebidas','6592','Cappuccino de pistache','Creme de pistache, raspas de chocolate, café, leite, chantilly e crocante — 250 ml','{}'::text[],0,false,ARRAY['unica']::text[], ARRAY[2990]::int[]),
    ('bebidas','2291','Suco de laranja','400 ml',ARRAY['vegetariano']::text[],1,false,ARRAY['unica']::text[], ARRAY[1790]::int[]),
    ('bebidas','2289','Suco de abacaxi','400 ml',ARRAY['vegetariano']::text[],2,false,ARRAY['unica']::text[], ARRAY[1790]::int[]),
    ('bebidas','2519','Limonada suíça','400 ml',ARRAY['vegetariano']::text[],3,false,ARRAY['unica']::text[], ARRAY[2190]::int[]),
    ('bebidas','8009','Havaí','Abacaxi, limão e hortelã — 400 ml',ARRAY['vegetariano']::text[],4,false,ARRAY['unica']::text[], ARRAY[2190]::int[]),
    ('bebidas','8011','Detox','Melancia, morango, hortelã e gengibre — 400 ml',ARRAY['vegetariano']::text[],5,false,ARRAY['unica']::text[], ARRAY[2190]::int[]),
    ('bebidas','2769','Suco verde','Abacaxi, laranja e couve — 400 ml',ARRAY['vegetariano']::text[],6,false,ARRAY['unica']::text[], ARRAY[2190]::int[]),
    ('bebidas','1592','Da casa','Morango, maracujá e laranja — 400 ml',ARRAY['vegetariano']::text[],7,false,ARRAY['unica']::text[], ARRAY[2300]::int[]),
    ('bebidas','4263','Soda italiana de limão siciliano','400 ml',ARRAY['vegetariano']::text[],8,false,ARRAY['unica']::text[], ARRAY[1990]::int[]),
    ('bebidas','2297','Vitamina especial','Mamão, banana, maçã, aveia e mel — 400 ml',ARRAY['vegetariano']::text[],9,false,ARRAY['unica']::text[], ARRAY[2090]::int[]),
    ('bebidas','13227','Cerveja Heineken','600 ml','{}'::text[],10,false,ARRAY['unica']::text[], ARRAY[2190]::int[]),
    ('bebidas','10678','Refrigerante lata','350 ml','{}'::text[],11,false,ARRAY['unica']::text[], ARRAY[990]::int[]),
    ('acai','3068','Açaí na tigela ou no copo','400 ml, com até 3 acompanhamentos',ARRAY['vegetariano']::text[],0,false,ARRAY['unica']::text[], ARRAY[3190]::int[]),
    ('acai','5994','Iogurte natural com morango e granola','250 g',ARRAY['vegetariano']::text[],1,false,ARRAY['unica']::text[], ARRAY[2450]::int[]),
    ('acai','2491','Salada de frutas','250 g',ARRAY['vegetariano']::text[],2,false,ARRAY['unica']::text[], ARRAY[1590]::int[]),
    ('acai','4244','Torta de morango','120 g',ARRAY['vegetariano']::text[],3,false,ARRAY['unica']::text[], ARRAY[1890]::int[]),
    ('acai','4476','Torta holandesa','120 g',ARRAY['vegetariano']::text[],4,false,ARRAY['unica']::text[], ARRAY[1890]::int[]),
    ('acai','4240','Torta de limão','120 g',ARRAY['vegetariano']::text[],5,false,ARRAY['unica']::text[], ARRAY[1790]::int[]),
    ('acai','4484','Pudim individual','150 g',ARRAY['vegetariano']::text[],6,false,ARRAY['unica']::text[], ARRAY[1790]::int[]),
    ('acai','4481','Bomba de creme','120 g',ARRAY['vegetariano']::text[],7,false,ARRAY['unica']::text[], ARRAY[1790]::int[]),
    ('acai','3055','Milk-shake','Creme, chocolate ou morango — 300 ml',ARRAY['vegetariano']::text[],8,false,ARRAY['unica']::text[], ARRAY[2990]::int[]),
    ('acai','5046','Pizza doce de Nutella®','Creme de Nutella® com xerém de amendoim — 4 pedaços',ARRAY['vegetariano']::text[],9,false,ARRAY['unica']::text[], ARRAY[7980]::int[]),
    ('refeicoes','—','Almoço por quilo','Seg a sex 11h–14h50 · Sáb, dom e feriados 11h30–14h50','{}'::text[],0,false,ARRAY['unica']::text[], ARRAY[12490]::int[]),
    ('refeicoes','8015','Salada de frango em tiras','Alface-americana, rúcula, tomate-cereja, palmito e azeitonas — 200 g','{}'::text[],1,false,ARRAY['unica']::text[], ARRAY[4590]::int[]),
    ('refeicoes','8025','Salada de filé mignon em tiras','Alface-americana, rúcula, tomate e palmito — 200 g','{}'::text[],2,false,ARRAY['unica']::text[], ARRAY[4890]::int[]),
    ('refeicoes','2765','Strogonoff de carne','Acompanha arroz e batata frita — 150 g','{}'::text[],3,false,ARRAY['unica']::text[], ARRAY[5660]::int[]),
    ('refeicoes','2766','Strogonoff de frango','Acompanha arroz e batata frita — 150 g','{}'::text[],4,false,ARRAY['unica']::text[], ARRAY[5190]::int[]),
    ('refeicoes','8016','Filé mignon à parmegiana','Acompanha arroz e batata frita — 150 g','{}'::text[],5,false,ARRAY['unica']::text[], ARRAY[5660]::int[]),
    ('refeicoes','8019','Filé mignon grelhado','Acompanha arroz, fritas e salada — 150 g','{}'::text[],6,false,ARRAY['unica']::text[], ARRAY[6390]::int[]),
    ('refeicoes','2767','Frango grelhado','Acompanha arroz, fritas e salada — 150 g','{}'::text[],7,false,ARRAY['unica']::text[], ARRAY[4990]::int[]),
    ('refeicoes','2506','Café da manhã — sábados, domingos e feriados','7h às 11h, por pessoa','{}'::text[],8,false,ARRAY['unica']::text[], ARRAY[6990]::int[]),
    ('refeicoes','1540','Sopas — buffet completo','17h às 21h40, por pessoa','{}'::text[],9,false,ARRAY['unica']::text[], ARRAY[6990]::int[]),
    ('refeicoes','2500','Marmitex normal','11h às 15h','{}'::text[],10,false,ARRAY['unica']::text[], ARRAY[2900]::int[]),
    ('refeicoes','2501','Marmitex executiva','11h às 15h','{}'::text[],11,false,ARRAY['unica']::text[], ARRAY[3100]::int[])
  ) as x(secao text, cod text, nome text, descricao text, tags text[], ordem int,
         esgotado boolean, rotulos text[], valores int[])
  loop
    select id into v_secao from secoes where tenant_id=v_tenant and slug=r.secao;

    insert into itens (tenant_id, secao_id, codigo_pdv, nome, descricao, tags, ordem, esgotado, status)
    values (v_tenant, v_secao, r.cod, r.nome, r.descricao, r.tags, r.ordem, r.esgotado, 'rascunho')
    on conflict (tenant_id, codigo_pdv)
      do update set nome = excluded.nome, descricao = excluded.descricao,
                    secao_id = excluded.secao_id, ordem = excluded.ordem, status = 'rascunho'
    returning id into v_item;

    delete from variantes where item_id = v_item;

    for k in 1 .. array_length(r.rotulos, 1) loop
      insert into variantes (item_id, rotulo, ordem)
      values (v_item, r.rotulos[k], k - 1)
      returning id into v_var;
      insert into precos (variante_id, valor_centavos) values (v_var, r.valores[k]);
    end loop;

    update itens set status = 'publicado' where id = v_item;
  end loop;
end $$;