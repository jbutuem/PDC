#!/usr/bin/env node
/**
 * Popula o Supabase com o cardápio extraído do PDF atual.
 *
 *   node scripts/seed.mjs
 *
 * Idempotente: casa os itens por `codigo_pdv`. Rodar duas vezes não duplica.
 * Usa a SERVICE_ROLE_KEY — nunca rode isto num navegador ou num CI público.
 */
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT = process.argv.find(a => a.startsWith('--tenant='))?.split('=')[1] ?? 'pao-da-primavera';

if (!URL || !CHAVE) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Rode:  export $(grep -v "^#" .env.local | xargs)  antes.');
  process.exit(1);
}

const sb = createClient(URL, CHAVE, { auth: { persistSession: false } });
const dados = JSON.parse(await readFile(new URL('../data/seed-menu.json', import.meta.url)));

const SUB = {
  pizzas: 'Todos os dias, das 17h30 às 21h45',
  refeicoes: 'Executivos das 15h às 21h45'
};

console.log(`Semeando o tenant "${TENANT}"…\n`);

const { data: tenant, error: eT } = await sb
  .from('tenants').select('id').eq('slug', TENANT).single();
if (eT || !tenant) {
  console.error('Tenant não encontrado. Aplique a migração 0001_init.sql primeiro.');
  process.exit(1);
}

let totalItens = 0, totalPrecos = 0;

for (const [ordem, s] of dados.entries()) {
  const { data: secao, error: eS } = await sb
    .from('secoes')
    .upsert({ tenant_id: tenant.id, slug: s.slug, nome: s.nome,
              subtitulo: SUB[s.slug] ?? null, ordem, visivel: true },
            { onConflict: 'tenant_id,slug' })
    .select('id').single();
  if (eS) { console.error(`  seção ${s.slug}:`, eS.message); continue; }

  for (const [i, it] of s.itens.entries()) {
    const duplo = it.pg != null;

    const { data: item, error: eI } = await sb
      .from('itens')
      .upsert({
        tenant_id: tenant.id, secao_id: secao.id,
        codigo_pdv: String(it.c), nome: it.n, descricao: it.d ?? null,
        tags: it.veg ? ['vegetariano'] : [],
        ordem: i, status: 'rascunho', esgotado: Boolean(it.esgotado)
      }, { onConflict: 'tenant_id,codigo_pdv' })
      .select('id').single();
    if (eI) { console.error(`  item ${it.c}:`, eI.message); continue; }
    totalItens++;

    const variantes = duplo
      ? [{ rotulo: 'GDE. 35 cm', ordem: 0, valor: it.pg },
         { rotulo: 'PEQ. 25 cm', ordem: 1, valor: it.pp }]
      : [{ rotulo: 'unica', ordem: 0, valor: it.p }];

    await sb.from('variantes').delete().eq('item_id', item.id);

    for (const v of variantes) {
      const { data: variante } = await sb
        .from('variantes')
        .insert({ item_id: item.id, rotulo: v.rotulo, ordem: v.ordem })
        .select('id').single();
      if (!variante) continue;
      await sb.from('precos').insert({ variante_id: variante.id, valor_centavos: v.valor });
      totalPrecos++;
    }

    // com preço vigente cadastrado, o item pode ser publicado
    await sb.from('itens').update({ status: 'publicado' }).eq('id', item.id);
  }

  console.log(`  ${s.nome.padEnd(24)} ${String(s.itens.length).padStart(3)} itens`);
}

console.log(`\n${totalItens} itens e ${totalPrecos} preços gravados.`);
console.log('Confira agora com:  node scripts/validar.mjs');
