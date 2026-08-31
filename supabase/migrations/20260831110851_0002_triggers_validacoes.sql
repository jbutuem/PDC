-- 20260831110851_0002_triggers_validacoes.sql
-- Auditoria automática, bloqueio de publicação sem preço e a exceção do operador.
-- Aplicada em 31/08/2026 no projeto akahkfstgicfamfsibvw.

-- ============ AUDITORIA ============

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

-- precos não tem tenant_id direto; audita pelo item.
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

-- ============ NÃO PUBLICA ITEM SEM PREÇO VIGENTE ============
-- Esta é a proteção legal: item no ar sem preço vigente é divergência
-- de preço na acepção da Lei 10.962/04.

create or replace function fn_valida_publicacao() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'publicado' then
    if not exists (
      select 1 from variantes v
      join precos p on p.variante_id = v.id
      where v.item_id = new.id
        and p.vigencia_inicio <= now()
        and (p.vigencia_fim is null or p.vigencia_fim > now())
    ) then
      raise exception 'Item "%" nao pode ser publicado: nenhum preco vigente.', new.nome;
    end if;
  end if;
  new.atualizado_em := now();
  return new;
end $$;

create trigger tg_valida_publicacao before insert or update on itens
  for each row execute function fn_valida_publicacao();

-- ============ SINALIZADOR DE PREÇO SUSPEITO ============
-- Régua grosseira de propósito: pega dígito trocado. Alerta, não bloqueia.
-- NOTA: a média por seção é imprecisa quando a seção mistura unidades de
-- venda (por quilo x por porção). Ver a discussão em 11-SUPABASE-estado-atual.md.

create or replace function preco_suspeito(p_variante uuid, p_valor int)
returns boolean language sql stable set search_path = public as $$
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

-- ============ EXCEÇÃO DELIBERADA: OPERADOR MARCA ESGOTADO ============
-- Única escrita direta em produção. Falta de estoque não espera aprovação.
-- Restrito a estas duas colunas via RPC; a função checa o papel.

create or replace function marcar_esgotado(p_item uuid, p_esgotado boolean, p_ate timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  select tenant_id into tid from itens where id = p_item;
  if meu_papel(tid) not in ('operador','cliente_editor','agencia','owner') then
    raise exception 'Sem permissao.';
  end if;
  update itens set esgotado = p_esgotado, esgotado_ate = p_ate, atualizado_em = now()
  where id = p_item;
end $$;
