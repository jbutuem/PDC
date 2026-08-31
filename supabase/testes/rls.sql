-- Testes de Row Level Security.
-- Rode no SQL Editor depois de QUALQUER mudança de policy.
-- Sai com exceção se qualquer teste falhar; silêncio = tudo passou.

do $$
declare n int; antes int; depois int; falhou boolean;
begin
  select count(*) into antes from itens;

  set local role anon;

  update itens set nome = 'INVASAO';
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FALHA: anon alterou % itens', n; end if;
  raise notice 'OK 1 - update em itens afetou 0 linhas';

  update precos set valor_centavos = 1;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FALHA: anon alterou % precos', n; end if;
  raise notice 'OK 2 - update em precos afetou 0 linhas';

  delete from itens;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FALHA: anon apagou % itens', n; end if;
  raise notice 'OK 3 - delete em itens afetou 0 linhas';

  falhou := false;
  begin
    insert into comunicados (tenant_id, texto) select id, 'INVASAO' from tenants limit 1;
  exception when others then falhou := true;
  end;
  if not falhou then raise exception 'FALHA: anon inseriu comunicado'; end if;
  raise notice 'OK 4 - insert em comunicados rejeitado';

  select count(*) into n from itens where status <> 'publicado';
  if n > 0 then raise exception 'FALHA: anon enxerga % rascunhos', n; end if;
  raise notice 'OK 5 - rascunhos invisiveis';

  select count(*) into n from audit_log;
  if n > 0 then raise exception 'FALHA: anon enxerga auditoria'; end if;
  raise notice 'OK 6 - audit_log invisivel';

  select count(*) into n from versoes;
  if n > 0 then raise exception 'FALHA: anon enxerga versoes'; end if;
  raise notice 'OK 7 - versoes invisiveis';

  reset role;
  select count(*) into depois from itens;
  if antes <> depois then raise exception 'FALHA: contagem mudou'; end if;

  raise notice '=== 7 TESTES DE RLS PASSARAM (% itens intactos) ===', depois;
end $$;
