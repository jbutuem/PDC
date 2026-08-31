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

/**
 * Salva uma seção inteira: nome, descrição e preços de cada item.
 * Preço só vira linha nova em `precos` se o valor mudou de verdade —
 * senão o histórico enche de duplicatas iguais.
 */
export async function salvarSecao(formData) {
  const s = await exigir(PODE_EDITAR);
  const sb = s.sb;

  const ids = formData.getAll('item_id');
  const alteracoes = [];

  for (const id of ids) {
    const nome = (formData.get(`nome_${id}`) ?? '').toString().trim();
    const descricao = (formData.get(`desc_${id}`) ?? '').toString().trim();
    if (!nome) continue;

    const { data: atual } = await sb
      .from('itens').select('nome, descricao, tenant_id').eq('id', id).single();
    if (!atual || atual.tenant_id !== s.membro.tenant_id) continue;

    if (atual.nome !== nome || (atual.descricao ?? '') !== descricao) {
      await sb.from('itens')
        .update({ nome, descricao: descricao || null, status: 'rascunho' })
        .eq('id', id);
      alteracoes.push({ tipo: 'texto', id });
    }

    const { data: variantes } = await sb
      .from('variantes').select('id, rotulo').eq('item_id', id).order('ordem');

    for (const v of variantes ?? []) {
      const bruto = formData.get(`preco_${v.id}`);
      if (bruto == null) continue;
      const valor = centavos(bruto);
      if (!valor || valor <= 0) continue;

      const { data: vigente } = await sb
        .from('precos')
        .select('id, valor_centavos')
        .eq('variante_id', v.id)
        .is('vigencia_fim', null)
        .order('vigencia_inicio', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (vigente?.valor_centavos === valor) continue;

      const agora = new Date().toISOString();
      if (vigente) {
        await sb.from('precos').update({ vigencia_fim: agora }).eq('id', vigente.id);
      }
      await sb.from('precos').insert({
        variante_id: v.id, valor_centavos: valor,
        vigencia_inicio: agora, criado_por: s.user.id
      });
      await sb.from('itens').update({ status: 'rascunho' }).eq('id', id);
      alteracoes.push({ tipo: 'preco', id, de: vigente?.valor_centavos ?? null, para: valor });
    }
  }

  revalidatePath('/admin');
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
    .select('slug, nome, itens ( codigo_pdv, nome, descricao, tags, variantes ( rotulo, precos ( valor_centavos, vigencia_fim ) ) )')
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
  revalidatePath('/admin');
  revalidatePath('/');

  return { ok: true, publicados: pendentes.length - falhas.length, falhas, versao: versao?.numero };
}

/** Regenera o HTML estático do menu público. */
async function avisarSite() {
  revalidatePath('/');
}
