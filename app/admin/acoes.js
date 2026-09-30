'use server';

import { revalidatePath } from 'next/cache';
import { sessaoAtual, PODE_EDITAR, PODE_PUBLICAR } from '@/lib/auth';

async function exigir(papeis) {
  const s = await sessaoAtual();
  if (!s?.membro || !papeis.includes(s.membro.papel)) {
    throw new Error('Sem permissão para esta ação.');
  }
  return s;
}

const centavos = txt => {
  const limpo = String(txt).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Math.round(parseFloat(limpo) * 100);
  return Number.isFinite(n) ? n : null;
};

/** Fecha o preço vigente (se houver) e abre um novo. Devolve o valor anterior. */
async function trocarPreco(sb, varianteId, lojaId, valor, userId) {
  let q = sb.from('precos').select('id, valor_centavos')
    .eq('variante_id', varianteId).is('vigencia_fim', null)
    .order('vigencia_inicio', { ascending: false }).limit(1);
  q = lojaId ? q.eq('loja_id', lojaId) : q.is('loja_id', null);
  const { data: vigente } = await q.maybeSingle();

  if ((vigente?.valor_centavos ?? null) === valor) return { mudou: false };

  const agora = new Date().toISOString();
  if (vigente) {
    const { error } = await sb.from('precos').update({ vigencia_fim: agora }).eq('id', vigente.id);
    if (error) throw new Error(error.message);
  }
  // valor null = a loja volta a seguir o preço base: só fecha a exceção.
  if (valor != null) {
    const { error } = await sb.from('precos').insert({
      variante_id: varianteId, valor_centavos: valor, loja_id: lojaId ?? null,
      vigencia_inicio: agora, criado_por: userId
    });
    if (error) throw new Error(error.message);
  }
  return { mudou: true, de: vigente?.valor_centavos ?? null };
}

/**
 * Salva uma seção inteira: textos, preço base, preço por loja e em quais
 * lojas cada item é vendido.
 *
 * Modelo: o catálogo é um só. Cada loja guarda apenas exceções —
 *   itens_lojas (disponivel=false)  -> a loja não vende o item
 *   precos com loja_id               -> a loja cobra diferente do base
 * Preço de loja igual ao base, ou em branco, apaga a exceção.
 *
 * Preço só vira linha nova em `precos` se o valor mudou de verdade —
 * senão o histórico enche de duplicatas iguais.
 */
export async function salvarSecao(formData) {
  const s = await exigir(PODE_EDITAR);
  const sb = s.sb;

  const { data: lojas } = await sb.from('lojas').select('id, nome')
    .eq('tenant_id', s.membro.tenant_id).eq('ativo', true);

  const ids = formData.getAll('item_id');
  const alteracoes = [];

  for (const id of ids) {
    const nome = (formData.get(`nome_${id}`) ?? '').toString().trim();
    const descricao = (formData.get(`desc_${id}`) ?? '').toString().trim();
    if (!nome) continue;

    const { data: atual } = await sb
      .from('itens').select('nome, descricao, tenant_id, itens_lojas ( loja_id, disponivel )').eq('id', id).single();
    if (!atual || atual.tenant_id !== s.membro.tenant_id) continue;

    let tocou = false;

    if (atual.nome !== nome || (atual.descricao ?? '') !== descricao) {
      await sb.from('itens').update({ nome, descricao: descricao || null }).eq('id', id);
      alteracoes.push({ tipo: 'texto', id });
      tocou = true;
    }

    // Em quais lojas o item é vendido
    for (const l of lojas ?? []) {
      const campo = formData.get(`vende_${id}_${l.id}`);
      if (campo == null) continue;
      const querVender = campo === '1';
      const vendeHoje = !(atual.itens_lojas ?? []).some(x => x.loja_id === l.id && !x.disponivel);
      if (querVender === vendeHoje) continue;
      const { error } = querVender
        ? await sb.from('itens_lojas').delete().eq('item_id', id).eq('loja_id', l.id)
        : await sb.from('itens_lojas').upsert({ item_id: id, loja_id: l.id, disponivel: false });
      if (error) throw new Error(error.message);
      alteracoes.push({ tipo: 'loja', id, loja: l.nome, vende: querVender });
      tocou = true;
    }

    const { data: variantes } = await sb
      .from('variantes').select('id, rotulo').eq('item_id', id).order('ordem');

    for (const v of variantes ?? []) {
      // Preço base (vale para toda loja sem preço próprio)
      const bruto = formData.get(`preco_${v.id}`);
      let base = null;
      if (bruto != null) {
        base = centavos(bruto);
        if (base && base > 0) {
          const r = await trocarPreco(sb, v.id, null, base, s.user.id);
          if (r.mudou) { alteracoes.push({ tipo: 'preco', id, de: r.de, para: base }); tocou = true; }
        }
      }

      // Preço próprio de cada loja
      for (const l of lojas ?? []) {
        const campo = formData.get(`pl_${v.id}_${l.id}`);
        if (campo == null) continue;
        let valor = String(campo).trim() ? centavos(campo) : null;
        if (valor != null && valor <= 0) continue;
        if (valor != null && base != null && valor === base) valor = null; // igual ao base = sem exceção
        const r = await trocarPreco(sb, v.id, l.id, valor, s.user.id);
        if (r.mudou) { alteracoes.push({ tipo: 'preco_loja', id, loja: l.nome, de: r.de, para: valor }); tocou = true; }
      }
    }

    if (tocou) await sb.from('itens').update({ status: 'rascunho' }).eq('id', id);
  }

  revalidatePath('/admin', 'layout');
  return { ok: true, alteracoes: alteracoes.length };
}

/** Marca ou desmarca esgotado. Vai ao ar na hora — é a exceção deliberada. */
export async function alternarEsgotado(itemId, esgotado) {
  const s = await exigir(['operador', ...PODE_EDITAR]);
  const sb = s.sb;
  await sb.from('itens').update({ esgotado, atualizado_em: new Date().toISOString() }).eq('id', itemId);
  await avisarSite();
  revalidatePath('/admin');
  return { ok: true };
}

/** Publica tudo que está em rascunho e grava um snapshot para rollback. */
export async function publicarTudo(nota) {
  const s = await exigir(PODE_PUBLICAR);
  const sb = s.sb;
  const tenant = s.membro.tenant_id;

  const { data: pendentes } = await sb
    .from('itens').select('id, nome').eq('tenant_id', tenant).eq('status', 'rascunho');

  if (!pendentes?.length) return { ok: false, erro: 'Nada em rascunho para publicar.' };

  const falhas = [];
  for (const it of pendentes) {
    const { error } = await sb.from('itens').update({ status: 'publicado' }).eq('id', it.id);
    if (error) falhas.push(`${it.nome}: ${error.message}`);
  }

  const { data: snapshot } = await sb
    .from('secoes')
    .select('slug, nome, itens ( codigo_pdv, nome, descricao, tags, itens_lojas ( loja_id, disponivel ), variantes ( rotulo, precos ( valor_centavos, vigencia_fim, loja_id ) ) )')
    .eq('tenant_id', tenant);

  const { data: versao } = await sb.from('versoes').insert({
    tenant_id: tenant,
    status: 'publicada',
    snapshot,
    nota: nota || `Publicação de ${pendentes.length} ${pendentes.length === 1 ? 'item' : 'itens'}`,
    publicada_por: s.user.id,
    publicada_em: new Date().toISOString()
  }).select('numero').single();

  await avisarSite();
  revalidatePath('/admin', 'layout');

  return { ok: true, publicados: pendentes.length - falhas.length, falhas, versao: versao?.numero };
}

/**
 * Regenera o HTML estático do site inteiro: a escolha de loja e a página de
 * cada loja. Revalidar só '/' deixaria /cambui e /primavera velhos.
 */
async function avisarSite() {
  revalidatePath('/', 'layout');
}
