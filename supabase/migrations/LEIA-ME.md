# Migrações

As quatro migrações já foram aplicadas no projeto Supabase
`akahkfstgicfamfsibvw` (região sa-east-1, São Paulo).

| Arquivo | O que faz |
|---|---|
| `0001_menu_pdp_estrutura.sql` | Tabelas, tipos, índices e a view `precos_vigentes` |
| `0002_triggers_validacoes.sql` | Auditoria, bloqueio de publicação sem preço, `marcar_esgotado` |
| `0003_rls.sql` | Row Level Security: leitura pública só do publicado, escrita por papel |
| `0004_endurecimento_seguranca.sql` | Fecha os avisos do linter do Supabase |
| `0005_seed_cardapio.sql` | Os 101 itens e 117 preços extraídos do cardápio atual |

Para recriar do zero noutro projeto, aplique na ordem. Todas são idempotentes
o suficiente para rodar de novo, exceto a 0001 (falha se as tabelas existirem).

## Estado atual

- 9 seções, 101 itens publicados, 117 preços vigentes
- 1 comunicado ativo
- RLS validado com 7 testes automatizados (ver `testes/rls.sql`)
