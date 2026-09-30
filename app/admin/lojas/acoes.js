'use server';

import { revalidatePath } from 'next/cache';
import { sessaoAtual, PODE_PUBLICAR } from '@/lib/auth';

const texto = v => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** "(19) 99999-1234" vira https://wa.me/5519999991234. Link pronto também é aceito. */
function linkWhatsapp(v) {
  const t = texto(v);
  if (!t) return null;
  if (/^https?:\/\//.test(t)) return t;
  let d = t.replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  if (d.length < 12 || d.length > 13) throw new Error(`WhatsApp inválido: "${t}". Use DDD + número, ex.: (19) 99999-1234.`);
  return `https://wa.me/${d}`;
}

const hora = v => {
  const t = texto(v);
  if (!t) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) throw new Error(`Horário inválido: "${t}". Use HH:MM.`);
  return t;
};

export async function salvarLoja(id, campos) {
  const s = await sessaoAtual();
  if (!s?.membro || !PODE_PUBLICAR.includes(s.membro.papel)) throw new Error('Só a agência e o administrador editam as lojas.');

  const endereco = texto(campos.endereco);
  const linha = {
    endereco,
    whatsapp: linkWhatsapp(campos.whatsapp),
    site: texto(campos.site),
    instagram: texto(campos.instagram)?.replace(/^@/, '') ?? null,
    facebook: texto(campos.facebook),
    abre: hora(campos.abre),
    fecha: hora(campos.fecha),
    // Com endereço, o "Como chegar" aponta para ele; sem, busca pelo nome.
    mapa: endereco
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`
      : texto(campos.mapa)
  };
  if (linha.abre && linha.fecha && linha.abre >= linha.fecha) {
    throw new Error('O horário de abrir precisa ser antes do de fechar.');
  }

  const { error } = await s.sb.from('lojas').update(linha).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
  return { ok: true };
}
