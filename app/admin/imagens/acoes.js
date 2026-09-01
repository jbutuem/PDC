'use server';

import { revalidatePath } from 'next/cache';
import { sessaoAtual, supabaseAdmin, PODE_EDITAR, PODE_PUBLICAR } from '@/lib/auth';

async function exigir(papeis) {
  const s = await sessaoAtual();
  if (!s?.membro || !papeis.includes(s.membro.papel)) throw new Error('Sem permissão.');
  return s;
}

function atualizarPaginas() {
  revalidatePath('/admin/imagens');
  revalidatePath('/admin/vitrine');
  revalidatePath('/');
}

/**
 * Registra a imagem e, quando for substituição, remove a anterior — banco e
 * arquivo — na mesma operação.
 *
 * Antes a troca era feita em duas chamadas a partir do navegador: primeiro
 * `apagarImagem`, depois `registrarImagem`. Isso tinha dois defeitos sérios.
 *
 * 1. `apagarImagem` exige papel de publicação. Um `cliente_editor` — que é
 *    justamente quem o projeto quer que mexa no cardápio — recebia "Sem
 *    permissão" no meio do caminho: o arquivo já tinha subido, o registro
 *    nunca acontecia, e sobrava lixo no Storage. Foi o que produziu os
 *    arquivos órfãos encontrados nesta rodada.
 * 2. Se a aba fosse fechada entre as duas chamadas, o mesmo acontecia.
 *
 * Agora o navegador faz uma chamada só e a decisão de substituir é do servidor.
 */
export async function registrarImagem(dados) {
  const s = await exigir(PODE_EDITAR);
  const sb = s.sb;

  // Hero e destaque são exclusivos; produto é único por item. Nos três casos,
  // registrar uma nova significa aposentar a anterior.
  const exclusivo = ['hero', 'destaque'].includes(dados.papel);
  const porItem = dados.papel === 'produto' && dados.item_id;

  let anteriores = [];
  if (exclusivo || porItem) {
    let q = sb.from('imagens').select('id, storage_path').eq('papel', dados.papel);
    if (dados.item_id) q = q.eq('item_id', dados.item_id);
    else if (exclusivo) q = q.is('item_id', null);
    anteriores = (await q).data ?? [];
  }

  const { data: nova, error } = await sb
    .from('imagens')
    .insert({ ...dados, tenant_id: s.membro.tenant_id })
    .select('id')
    .single();

  // Falhou o registro: o arquivo já está no Storage e não pertence a ninguém.
  // Removê-lo aqui é o que impede o bucket de virar depósito de lixo.
  if (error) {
    await sb.storage.from('menu').remove([dados.storage_path]).catch(() => {});
    throw new Error(error.message);
  }

  // Só depois de a nova existir é que a antiga sai. Se algo falhar acima,
  // o cardápio continua mostrando a foto velha em vez de um buraco.
  if (anteriores.length) {
    const ids = anteriores.map(a => a.id);
    const caminhos = anteriores.map(a => a.storage_path).filter(Boolean);
    await sb.from('imagens').delete().in('id', ids);
    if (caminhos.length) await sb.storage.from('menu').remove(caminhos);
  }

  atualizarPaginas();
  return { ok: true, id: nova.id, substituidas: anteriores.length };
}

/** Chamada pelo navegador quando o upload subiu mas o passo seguinte falhou. */
export async function descartarArquivo(caminho) {
  const s = await exigir(PODE_EDITAR);
  if (!caminho) return { ok: true };
  await s.sb.storage.from('menu').remove([caminho]);
  return { ok: true };
}

export async function moverFoco(id, x, y) {
  const s = await exigir(PODE_EDITAR);
  const { error } = await s.sb.from('imagens')
    .update({ foco_x: x, foco_y: y }).eq('id', id);
  if (error) throw new Error(error.message);
  atualizarPaginas();
  return { ok: true };
}

export async function apagarImagem(id, caminho) {
  const s = await exigir(PODE_PUBLICAR);
  await s.sb.from('imagens').delete().eq('id', id);
  if (caminho) await s.sb.storage.from('menu').remove([caminho]);
  atualizarPaginas();
  return { ok: true };
}

/** Texto da hero: chamada, título e linha de apoio. */
export async function salvarTextoHero(id, campos) {
  await exigir(PODE_EDITAR);
  const s = await sessaoAtual();
  const limpar = v => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const { error } = await s.sb.from('imagens').update({
    chamada: limpar(campos.chamada),
    titulo: limpar(campos.titulo),
    linha_apoio: limpar(campos.linha_apoio),
    alt: limpar(campos.alt)
  }).eq('id', id);
  if (error) throw new Error(error.message);
  atualizarPaginas();
  return { ok: true };
}

/**
 * Compara o bucket com a tabela e apaga o que não é referenciado por ninguém.
 * Rede de segurança para uploads interrompidos — deve encontrar zero agora que
 * o registro é atômico, mas conexão de loja cai e aba fecha.
 */
export async function limparOrfaos({ simular = true } = {}) {
  await exigir(PODE_PUBLICAR);
  const adm = supabaseAdmin();

  const arquivos = [];
  for (const pasta of ['hero', 'destaque', 'promo', 'produto']) {
    const { data } = await adm.storage.from('menu')
      .list(pasta, { limit: 1000, sortBy: { column: 'created_at', order: 'asc' } });
    (data ?? []).forEach(f => { if (f.id) arquivos.push(`${pasta}/${f.name}`); });
  }

  const { data: usados } = await adm.from('imagens').select('storage_path');
  const registrados = new Set((usados ?? []).map(i => i.storage_path));
  const orfaos = arquivos.filter(a => !registrados.has(a));

  if (!simular && orfaos.length) await adm.storage.from('menu').remove(orfaos);
  return { total: arquivos.length, orfaos, removidos: simular ? 0 : orfaos.length };
}
