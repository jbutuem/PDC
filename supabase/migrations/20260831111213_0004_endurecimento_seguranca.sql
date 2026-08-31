-- 20260831111213_0004_endurecimento_seguranca.sql
-- Fecha os avisos do linter de segurança do Supabase.
-- Aplicada em 31/08/2026 no projeto akahkfstgicfamfsibvw.

-- 1. Funções de gatilho não devem ser chamáveis pela API REST.
--    Elas rodam como SECURITY DEFINER e só fazem sentido dentro do trigger.
--    Sem isto ficam expostas como endpoints /rest/v1/rpc/fn_audit.
revoke execute on function public.fn_audit()       from anon, authenticated, public;
revoke execute on function public.fn_audit_preco() from anon, authenticated, public;

-- 2. meu_papel() só faz sentido para quem está logado.
revoke execute on function public.meu_papel(uuid) from anon, public;

-- 3. marcar_esgotado() exige login. A própria função já checa o papel,
--    mas não precisa ficar exposta ao anônimo.
revoke execute on function public.marcar_esgotado(uuid, boolean, timestamptz) from anon, public;

-- 4. Extensões fora do schema public.
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
alter extension unaccent set schema extensions;
alter extension pg_trgm  set schema extensions;

-- O índice de busca depende de pg_trgm; recria apontando para o novo schema.
drop index if exists itens_busca_idx;
create index itens_busca_idx on itens
  using gin ((nome || ' ' || coalesce(descricao,'')) extensions.gin_trgm_ops);
