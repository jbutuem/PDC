import { createClient } from '@supabase/supabase-js';
import seed from '@/data/seed-menu.json';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const temBanco = Boolean(URL && ANON);

export function clientePublico() {
  if (!temBanco) return null;
  return createClient(URL, ANON, { auth: { persistSession: false } });
}

/** Só no servidor. Ignora RLS — nunca importe isto de um componente cliente. */
export function clienteServico() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !chave) throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente.');
  return createClient(URL, chave, { auth: { persistSession: false } });
}

/**
 * Devolve o menu publicado no formato que os componentes esperam.
 * Sem banco configurado, cai no seed local — assim o primeiro deploy
 * funciona antes de o Supabase existir.
 */
export async function carregarMenu() {
  if (!temBanco) return { origem: 'seed', secoes: seed };

  const sb = clientePublico();
  const { data, error } = await sb
    .from('secoes')
    .select(`
      slug, nome, subtitulo, ordem,
      itens (
        codigo_pdv, nome, descricao, tags, ordem, esgotado,
        variantes ( rotulo, gramatura, ordem, precos ( valor_centavos, vigencia_inicio, vigencia_fim ) ),
        imagens ( storage_path, papel, foco_x, foco_y )
      )
    `)
    .eq('visivel', true)
    .order('ordem');

  if (error || !data?.length) {
    console.error('Menu vindo do seed local:', error?.message ?? 'banco vazio');
    return { origem: 'seed', secoes: seed };
  }

  const agora = Date.now();
  const vigente = (precos = []) => {
    const validos = precos
      .filter(p => new Date(p.vigencia_inicio) <= agora &&
                   (!p.vigencia_fim || new Date(p.vigencia_fim) > agora))
      .sort((a, b) => new Date(b.vigencia_inicio) - new Date(a.vigencia_inicio));
    return validos[0]?.valor_centavos ?? null;
  };

  const secoes = data.map(s => {
    const itens = (s.itens ?? [])
      .sort((a, b) => a.ordem - b.ordem)
      .map(i => {
        const vars = (i.variantes ?? []).sort((a, b) => a.ordem - b.ordem);
        const base = {
          c: i.codigo_pdv ?? '—',
          n: i.nome,
          d: i.descricao ?? '',
          veg: (i.tags ?? []).includes('vegetariano') ? 1 : 0,
          esgotado: i.esgotado ? 1 : 0,
          img: (i.imagens ?? []).find(x => x.papel === 'regular')?.storage_path ?? null
        };
        if (vars.length > 1) {
          return { ...base, pg: vigente(vars[0].precos), pp: vigente(vars[1].precos) };
        }
        return { ...base, p: vigente(vars[0]?.precos) };
      })
      .filter(i => i.p != null || (i.pg != null && i.pp != null));

    return {
      slug: s.slug,
      nome: s.nome,
      sub: s.subtitulo ?? undefined,
      grade: itens.length > 0 && itens[0].pg != null ? 1 : undefined,
      itens
    };
  }).filter(s => s.itens.length);

  return { origem: 'supabase', secoes };
}

export async function carregarComunicado() {
  if (!temBanco) {
    return { texto: '<b>Feriado 7/9:</b> abrimos das 7h às 14h. Almoço por quilo até 13h30.' };
  }
  const sb = clientePublico();
  const { data } = await sb
    .from('comunicados')
    .select('texto, nivel')
    .eq('ativo', true)
    .order('inicio', { ascending: false })
    .limit(1);
  return data?.[0] ?? null;
}
