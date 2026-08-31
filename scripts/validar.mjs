#!/usr/bin/env node
/**
 * Confere o cardápio no banco antes de qualquer publicação.
 *
 *   node scripts/validar.mjs
 *
 * A IA cuida de linguagem. Este script cuida de aritmética.
 * Sai com código 1 se houver bloqueio — dá para usar em CI.
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !CHAVE) { console.error('Faltam variáveis de ambiente.'); process.exit(1); }

const sb = createClient(URL, CHAVE, { auth: { persistSession: false } });
const brl = c => 'R$ ' + (c / 100).toFixed(2).replace('.', ',');

const { data: secoes } = await sb
  .from('secoes')
  .select('slug, nome, itens ( id, codigo_pdv, nome, status, descricao, variantes ( id, rotulo, precos ( valor_centavos, vigencia_fim ) ) )')
  .order('ordem');

const bloqueios = [], alertas = [];
const codigos = new Map();

for (const s of secoes ?? []) {
  const valores = [];
  for (const it of s.itens ?? []) {
    if (codigos.has(it.codigo_pdv)) {
      bloqueios.push(`Código ${it.codigo_pdv} duplicado: "${it.nome}" e "${codigos.get(it.codigo_pdv)}".`);
    }
    codigos.set(it.codigo_pdv, it.nome);

    const precos = (it.variantes ?? []).flatMap(v =>
      (v.precos ?? []).filter(p => !p.vigencia_fim).map(p => p.valor_centavos));

    if (!precos.length) {
      bloqueios.push(`"${it.nome}" (${it.codigo_pdv}) não tem preço vigente.`);
    }
    valores.push(...precos);

    if ((it.descricao ?? '').length > 90) {
      alertas.push(`"${it.nome}" (${it.codigo_pdv}): descrição com ${it.descricao.length} caracteres — quebra a grade do impresso.`);
    }
  }

  if (valores.length > 3) {
    const media = valores.reduce((a, b) => a + b, 0) / valores.length;
    for (const it of s.itens ?? []) {
      for (const v of it.variantes ?? []) {
        for (const p of (v.precos ?? []).filter(x => !x.vigencia_fim)) {
          const desvio = Math.abs(p.valor_centavos - media) / media;
          if (desvio > 0.4) {
            alertas.push(`"${it.nome}" (${it.codigo_pdv}) ${v.rotulo}: ${brl(p.valor_centavos)} — ${Math.round(desvio * 100)}% fora da média de ${s.nome} (${brl(Math.round(media))}).`);
          }
        }
      }
    }
  }
}

const publicados = (secoes ?? []).flatMap(s => s.itens ?? []).filter(i => i.status === 'publicado').length;
console.log(`${publicados} itens publicados em ${secoes?.length ?? 0} seções.\n`);

if (alertas.length) {
  console.log(`ALERTAS (${alertas.length}) — revisão humana:`);
  alertas.forEach(a => console.log('  · ' + a));
  console.log('');
}
if (bloqueios.length) {
  console.log(`BLOQUEIOS (${bloqueios.length}) — corrija antes de publicar:`);
  bloqueios.forEach(b => console.log('  ✗ ' + b));
  process.exit(1);
}
console.log('Nenhum bloqueio. Pode publicar.');
