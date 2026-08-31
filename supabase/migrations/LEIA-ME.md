# Migrações

Aplique **na ordem do nome do arquivo**. Já estão todas aplicadas no projeto
`akahkfstgicfamfsibvw` (região sa-east-1, São Paulo).

| Ordem | Arquivo | O que faz |
|---|---|---|
| 1 | `20260831110830_0001_menu_pdp_estrutura.sql` | 14 tabelas, 5 tipos enum, índices, view `precos_vigentes` |
| 2 | `20260831110851_0002_triggers_validacoes.sql` | Auditoria, bloqueio de publicação sem preço, `marcar_esgotado()` |
| 3 | `20260831110911_0003_rls.sql` | 24 policies de Row Level Security |
| 4 | `20260831111213_0004_endurecimento_seguranca.sql` | Fecha os avisos do linter do Supabase |
| 5 | `20260831111400_0005_tenant_e_secoes.sql` | O tenant Pão da Primavera e as 9 seções |
| 6 | `20260831111500_0006_seed_cardapio.sql` | Os 101 itens e 117 preços |

## Como aplicar num projeto novo

**Pelo painel:** SQL Editor → New query → cole cada arquivo na ordem → Run.

**Pela CLI:**
```bash
supabase link --project-ref SEU-REF
supabase db push
```

As migrações 4, 5 e 6 são idempotentes (podem rodar de novo). As migrações 1, 2 e 3
falham se os objetos já existirem — o que é o comportamento correto.

## Depois de aplicar, teste

```sql
-- no SQL Editor, cole o conteúdo de:
supabase/testes/rls.sql
```

Ele roda 7 verificações e lança exceção se qualquer uma falhar. **Rode depois de
qualquer alteração em policy** — é a única coisa que separa o cardápio de ser
editável por qualquer visitante do site.

## Verificação de completude

Em 31/08/2026 comparei os 63 objetos existentes no banco (tabelas, views, policies,
funções, triggers, tipos e índices) contra o que estes arquivos declaram: todos
presentes. Se você alterar o banco pelo painel, **traga a alteração para cá** —
senão o próximo projeto criado do zero não terá o que você fez.

## Estado atual do banco

- 9 seções, 101 itens publicados, 117 preços vigentes
- 1 comunicado ativo (feriado 7/9 — apague antes de produção)
- 1 item marcado como esgotado (código 2050) para testar o estado visual
