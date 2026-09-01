'use server';

import { revalidatePath } from 'next/cache';
import { sessaoAtual, PODE_EDITAR } from '@/lib/auth';

async function exigir() {
  const s = await sessaoAtual();
  if (!s?.membro || !PODE_EDITAR.includes(s.membro.papel)) throw new Error('Sem permissão.');
  return s;
}

function atualizar() {
  revalidatePath('/admin/vitrine');
  revalidatePath('/');
}

const texto = v => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** "29,90" ou "R$ 29,90" viram 2990. Devolve null quando o campo está vazio. */
function centavos(v) {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const limpo = String(v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const n = Number(limpo);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Preço inválido: "${v}".`);
  return Math.round(n * 100);
}

export async function salvarComunicado({ texto: corpo, ativo }) {
  const s = await exigir();
  const corpoLimpo = texto(corpo);

  const { data: atual } = await s.sb.from('comunicados')
    .select('id').order('inicio', { ascending: false }).limit(1).maybeSingle();

  if (!corpoLimpo) {
    if (atual) await s.sb.from('comunicados').update({ ativo: false }).eq('id', atual.id);
    atualizar();
    return { ok: true, removido: true };
  }

  const linha = { texto: corpoLimpo, ativo: Boolean(ativo) };
  const { error } = atual
    ? await s.sb.from('comunicados').update(linha).eq('id', atual.id)
    : await s.sb.from('comunicados').insert({ ...linha, tenant_id: s.membro.tenant_id });

  if (error) throw new Error(error.message);
  atualizar();
  return { ok: true };
}

export async function salvarPromocao(id, campos) {
  const s = await exigir();

  const de = centavos(campos.preco_de);
  const por = centavos(campos.preco_por);
  if (de !== null && por !== null && de <= por) {
    throw new Error('O preço "de" precisa ser maior que o "por". Se não há desconto, deixe o "de" vazio.');
  }

  const linha = {
    titulo: texto(campos.titulo),
    chamada: texto(campos.chamada),
    selo: texto(campos.selo),
    tipo: ['oferta', 'novo', 'tempo'].includes(campos.tipo) ? campos.tipo : 'oferta',
    preco_de_centavos: de,
    preco_por_centavos: por,
    observacao: texto(campos.observacao),
    ativo: Boolean(campos.ativo),
    ordem: Number(campos.ordem) || 0
  };
  if (!linha.titulo) throw new Error('A promoção precisa de um título.');

  const { error } = await s.sb.from('promocoes').update(linha).eq('id', id);
  if (error) throw new Error(error.message);
  atualizar();
  return { ok: true };
}

export async function alternarPromocao(id, ativo) {
  const s = await exigir();
  const { error } = await s.sb.from('promocoes').update({ ativo }).eq('id', id);
  if (error) throw new Error(error.message);
  atualizar();
  return { ok: true };
}
