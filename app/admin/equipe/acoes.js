'use server';

import { revalidatePath } from 'next/cache';
import { sessaoAtual, supabaseAdmin } from '@/lib/auth';

export async function mudarPapel(membroId, papel) {
  const s = await sessaoAtual();
  if (s?.membro?.papel !== 'owner') throw new Error('Só um administrador pode mudar papéis.');
  if (membroId === s.membro.id) throw new Error('Você não pode rebaixar a si mesmo.');

  const sb = supabaseAdmin();
  await sb.from('membros').update({ papel }).eq('id', membroId);
  revalidatePath('/admin/equipe');
  return { ok: true };
}
