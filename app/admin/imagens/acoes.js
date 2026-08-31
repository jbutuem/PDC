'use server';

import { revalidatePath } from 'next/cache';
import { sessaoAtual, PODE_EDITAR, PODE_PUBLICAR } from '@/lib/auth';

async function exigir(papeis) {
  const s = await sessaoAtual();
  if (!s?.membro || !papeis.includes(s.membro.papel)) throw new Error('Sem permissão.');
  return s;
}

export async function registrarImagem(dados) {
  const s = await exigir(PODE_EDITAR);
  const sb = s.sb;

  // Hero e destaque são exclusivos por item: substitui em vez de acumular.
  if (['hero', 'destaque'].includes(dados.papel) && dados.item_id) {
    await sb.from('imagens').delete().eq('item_id', dados.item_id).eq('papel', dados.papel);
  }

  const { error } = await sb.from('imagens').insert({ ...dados, tenant_id: s.membro.tenant_id });
  if (error) throw new Error(error.message);

  revalidatePath('/admin/imagens');
  revalidatePath('/');
  return { ok: true };
}

export async function moverFoco(id, x, y) {
  const s = await exigir(PODE_EDITAR);
  const sb = s.sb;
  await sb.from('imagens').update({ foco_x: x, foco_y: y }).eq('id', id);
  revalidatePath('/admin/imagens');
  revalidatePath('/');
  return { ok: true };
}

export async function apagarImagem(id, caminho) {
  const s = await exigir(PODE_PUBLICAR);
  const sb = s.sb;
  await sb.storage.from('menu').remove([caminho]);
  await sb.from('imagens').delete().eq('id', id);
  revalidatePath('/admin/imagens');
  revalidatePath('/');
  return { ok: true };
}
