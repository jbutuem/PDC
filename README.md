# Menu Digital — Pão da Primavera

Menu digital em Next.js, hospedado na Vercel, com dados no Supabase.
Este README é o passo a passo para colocar no ar e testar.

---

## O que já está pronto neste repositório

| Caminho | O que é |
|---|---|
| `app/page.js` | Menu público, gerado estaticamente (ISR) |
| `components/Menu.js` | Renderização, busca, índice lateral, slots de imagem |
| `app/globals.css` | O design system inteiro — celular, tablet e desktop |
| `lib/menu.js` | Consulta ao Supabase, **com fallback para o seed local** |
| `app/api/health/route.js` | Diagnóstico do deploy |
| `app/api/revalidate/route.js` | Webhook que regenera o site após publicar |
| `supabase/migrations/0001_init.sql` | Schema completo com RLS |
| `scripts/seed.mjs` | Popula o banco com os itens do cardápio atual |
| `scripts/validar.mjs` | Confere preços, códigos e descrições |
| `data/seed-menu.json` | O cardápio extraído do PDF |

**O fallback é o que torna este passo a passo confortável:** sem Supabase configurado, o site sobe funcionando com o seed local e mostra uma tarja avisando. Você vê o menu no ar antes de mexer em banco nenhum.

---

# PARTE 1 — No ar em 15 minutos, sem banco

## 1.1 Rodar na sua máquina

Requer Node 20 ou superior.

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. O menu aparece com a tarja laranja
"Dados do seed local". Estreite a janela para ver os três layouts.

Se der erro de versão do Node: `node -v` precisa mostrar 20 ou mais.

## 1.2 Subir para o GitHub

```bash
git init
git add .
git commit -m "Menu digital PDP — base"
git branch -M main
git remote add origin git@github.com:SUA-ORG/menu-pdp.git
git push -u origin main
```

Crie o repositório **privado** e na organização da agência, não na sua conta pessoal.

**Confira antes do push:** `git status` não pode listar `.env.local`.
O `.gitignore` já cobre, mas vale o olhar.

## 1.3 Conectar na Vercel

1. vercel.com → **Add New** → **Project** → **Import Git Repository**
2. Escolha `menu-pdp`
3. Framework: **Next.js** (detecta sozinho). Não mude nada.
4. **Deploy**

Em cerca de dois minutos você tem `https://menu-pdp-xxxx.vercel.app` no ar.

## 1.4 Testar

Abra a URL da Vercel:

- [ ] O menu carrega com a tarja de seed local
- [ ] A busca filtra (digite `pizza`, depois `5002`, depois `abacate`)
- [ ] O índice lateral acompanha a rolagem no desktop
- [ ] O trilho de categorias gruda no topo no celular
- [ ] O botão **Ver slots de imagem** mostra as especificações
- [ ] `SUA-URL.vercel.app/api/health` devolve JSON com tudo `false` — correto, ainda não há banco

**Abra no celular de verdade**, no 4G, não só no simulador do navegador.

Se chegou aqui, a parte de front está resolvida. Agora o banco.

---

# PARTE 2 — Conectar o Supabase

## 2.1 Criar dois projetos

Em supabase.com, na organização da agência:

- `menu-pdp-staging`
- `menu-pdp-prod`

Região **South America (São Paulo)**. Guarde a senha do Postgres no
gerenciador de senhas — o Supabase mostra uma vez só.

**Faça tudo primeiro no staging.** Testar migração em produção é como testar freio na descida.

## 2.2 Aplicar o schema

Modo mais simples, sem CLI: **SQL Editor** → **New query** → cole todo o
conteúdo de `supabase/migrations/0001_init.sql` → **Run**.

Deve terminar com "Success". Confira em **Table Editor** que apareceram
`tenants`, `secoes`, `itens`, `variantes`, `precos`, `imagens`, `versoes` e as demais.

Se preferir CLI:

```bash
npm i -g supabase
supabase login
supabase link --project-ref SEU-REF-DO-STAGING
supabase db push
```

## 2.3 Pegar as chaves

**Project Settings → API**:

- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` → `SUPABASE_SERVICE_ROLE_KEY`

> **A `service_role` ignora todas as regras de RLS.** Ela só pode aparecer em
> rotas de servidor e no script de seed. Se vazar para o navegador, qualquer
> pessoa reescreve o cardápio. Nunca a coloque numa variável `NEXT_PUBLIC_`.

## 2.4 Configurar localmente

```bash
cp .env.example .env.local
```

Preencha as três chaves e gere o segredo do revalidate:

```bash
openssl rand -hex 32
```

## 2.5 Popular o banco

```bash
export $(grep -v '^#' .env.local | xargs)
npm run seed
```

Saída esperada:

```
Semeando o tenant "pao-da-primavera"…
  Cafés e matinais          14 itens
  Toasts e ciabattas         6 itens
  ...
101 itens e 117 preços gravados.
```

O script casa por `codigo_pdv` e é idempotente — rodar duas vezes não duplica.

## 2.6 Validar

```bash
npm run validar
```

Ele reporta itens sem preço vigente, códigos duplicados, preços fora de ±40%
da média da seção e descrições longas demais para o impresso.
**Bloqueio sai com código 1.** Alerta é para olho humano.

## 2.7 Testar o RLS — não pule esta

No **SQL Editor**, aba **anon** (ou com a chave anon via curl):

```sql
select count(*) from itens;              -- deve devolver só os publicados
update itens set nome = 'teste';         -- DEVE FALHAR
insert into precos (variante_id, valor_centavos) values (gen_random_uuid(), 1); -- DEVE FALHAR
```

Se qualquer escrita passar, **pare e conserte antes de seguir.** Não existe
"resolvo depois" nisso: significa que qualquer pessoa com a chave pública,
que está no HTML do site, consegue mudar preços.

## 2.8 Rodar local contra o banco

```bash
npm run dev
```

A tarja laranja deve **sumir**. Se ela continuar, o `lib/menu.js` caiu no
fallback — olhe o console do servidor, ele imprime o motivo.

---

# PARTE 3 — Deploy com o banco

## 3.1 Variáveis na Vercel

**Project → Settings → Environment Variables.** Adicione as quatro,
marcando **Production**, **Preview** e **Development**:

| Nome | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | do staging por enquanto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon do staging |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role do staging |
| `REVALIDATE_SECRET` | o hex que você gerou |

## 3.2 Redeploy

Variável nova **não** entra em deploy antigo. Vá em **Deployments** → o
último → **⋯** → **Redeploy**. Ou apenas empurre um commit.

## 3.3 Testar

- [ ] `/api/health` mostra os quatro `true`, `banco: "ok"` e a contagem de itens
- [ ] O menu carrega **sem** a tarja laranja
- [ ] Os preços batem com o cardápio impresso

## 3.4 Testar o ciclo de publicação

É o teste que decide se o projeto funciona. No **Table Editor**, mude o
preço de um item. Depois:

```bash
curl -X POST "https://SUA-URL.vercel.app/api/revalidate?secret=SEU_SEGREDO"
# {"ok":true,"revalidado":"/","em":"..."}
```

Recarregue o site. O preço novo tem que aparecer **em menos de 30 segundos**.

Se não aparecer, nada mais do projeto importa — é este webhook que liga o
banco ao site. Confira o segredo e os logs em **Vercel → Deployments → Functions**.

---

# PARTE 4 — Produção e domínio

## 4.1 Promover para o projeto de produção

Repita 2.2 a 2.6 no `menu-pdp-prod` e troque as três variáveis do Supabase
na Vercel, no escopo **Production** apenas. Deixe **Preview** apontando para
o staging — assim todo pull request abre um preview com dados de teste,
sem risco de escrever em produção.

## 4.2 Apontar o domínio

**Vercel → Project → Settings → Domains** → adicione
`cardapio.paodaprimavera.com.br`.

A Vercel mostra o registro a criar. Para subdomínio é sempre CNAME:

```
Tipo:  CNAME
Nome:  cardapio
Valor: cname.vercel-dns.com
TTL:   3600
```

Se for domínio raiz, a Vercel pede um `A` para `76.76.21.21` — mas confirme
na tela dela, o IP pode mudar.

Propagação leva de minutos a algumas horas. Acompanhe:

```bash
dig cardapio.paodaprimavera.com.br CNAME +short
```

O HTTPS é emitido sozinho quando o DNS resolve. Se ficar em "Invalid
Configuration" por mais de uma hora, quase sempre é proxy do Cloudflare
ligado — desligue a nuvem laranja para esse registro.

## 4.3 Só depois do domínio no ar

**Gere os QR codes apontando para o domínio final, nunca para a URL da
Vercel.** Se o domínio mudar depois, os adesivos das mesas viram lixo.

---

## Solução de problemas

| Sintoma | Causa provável |
|---|---|
| Tarja laranja mesmo com variáveis configuradas | Deploy antigo. Faça Redeploy |
| `/api/health` com `banco: "erro"` | Chave errada ou schema não aplicado. A mensagem vem no JSON |
| Build falha na Vercel mas passa local | Node diferente. Fixe em Settings → General → Node.js Version |
| Menu vazio, sem erro | Itens em `rascunho`. O seed publica ao final; rode de novo |
| Preço não atualiza | O revalidate não foi chamado, ou o segredo está errado |
| Fontes não carregam | Rede bloqueando o Google Fonts. Considere `next/font` na Fase 2 |

## Comandos

```bash
npm run dev        # desenvolvimento
npm run build      # build de produção (rode antes de todo push importante)
npm run seed       # popula o banco
npm run validar    # confere preços e códigos
```

## O que ainda não está aqui

Fase 2 em diante: `/admin` com login por magic link, revisão de texto por IA,
upload de imagem com ponto de foco, fluxo de rascunho → revisão → publicação,
e a geração da brochura impressa. A base deste repositório já suporta tudo isso.
