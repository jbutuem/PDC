import { createClient } from '@supabase/supabase-js';
import seed from '@/data/seed-menu.json';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const temBanco = Boolean(URL && ANON);

/** URL pública de um arquivo no bucket `menu`. */
export function urlImagem(caminho) {
  if (!caminho) return null;
  if (caminho.startsWith('http')) return caminho;
  return `${URL}/storage/v1/object/public/menu/${caminho}`;
}

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
        codigo_pdv, nome, descricao, tags, ordem, esgotado, status,
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
        const foto = (i.imagens ?? []).find(x => x.papel === 'produto')
                  ?? (i.imagens ?? []).find(x => x.papel === 'regular');
        const base = {
          c: i.codigo_pdv ?? '—',
          n: i.nome,
          d: i.descricao ?? '',
          veg: (i.tags ?? []).includes('vegetariano') ? 1 : 0,
          esgotado: i.esgotado ? 1 : 0,
          img: foto ? urlImagem(foto.storage_path) : null,
          foco: foto ? `${foto.foco_x * 100}% ${foto.foco_y * 100}%` : null
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

/**
 * Hero e cards de promoção publicados.
 *
 * A hero deixou de emprestar o texto de um item do cardápio. Ela é uma peça de
 * comunicação e agora tem chamada, título e linha de apoio próprios, editáveis
 * em /admin/vitrine. Se estiverem vazios, cai no item vinculado e, por último,
 * num texto institucional — o topo do site nunca fica sem palavra.
 */
export async function carregarVitrine() {
  if (!temBanco) return { hero: null, promos: [] };
  const sb = clientePublico();

  const [{ data: heros }, { data: promocoes }] = await Promise.all([
    sb.from('imagens')
      .select('storage_path, foco_x, foco_y, alt, chamada, titulo, linha_apoio, largura, altura, itens ( nome, descricao )')
      .eq('papel', 'hero').order('criado_em', { ascending: false }).limit(1),
    sb.from('promocoes')
      .select('id, titulo, chamada, selo, tipo, preco_de_centavos, preco_por_centavos, observacao, dias_semana, imagens ( storage_path, foco_x, foco_y )')
      .eq('ativo', true)
      .lte('inicio', new Date().toISOString())
      .gt('fim', new Date().toISOString())
      .order('ordem')
  ]);

  const h = heros?.[0];
  const hero = h ? {
    img: urlImagem(h.storage_path),
    foco: `${h.foco_x * 100}% ${h.foco_y * 100}%`,
    alt: h.alt ?? '',
    largura: h.largura ?? null,
    altura: h.altura ?? null,
    kick: h.chamada ?? 'DESDE 1999, NO CAMBUÍ',
    n: h.titulo ?? h.itens?.nome ?? 'Pão da Primavera',
    d: h.linha_apoio ?? h.itens?.descricao ?? null
  } : null;

  // Uma promoção pode valer só em certos dias. Filtrar aqui evita mostrar
  // "segunda a quinta" num sábado, que é o tipo de erro que gera reclamação
  // no balcão.
  const diaHoje = new Date().getDay();
  const promos = (promocoes ?? [])
    .filter(p => !p.dias_semana?.length || p.dias_semana.includes(diaHoje))
    .map(p => ({
      selo: p.selo ?? undefined,
      tipo: p.tipo === 'oferta' ? undefined : p.tipo,
      n: p.titulo,
      d: p.chamada ?? '',
      de: p.preco_de_centavos ? brlCentavos(p.preco_de_centavos) : null,
      por: p.preco_por_centavos ? brlCentavos(p.preco_por_centavos) : null,
      obs: p.observacao ?? '',
      img: p.imagens ? urlImagem(p.imagens.storage_path) : null,
      foco: p.imagens ? `${p.imagens.foco_x * 100}% ${p.imagens.foco_y * 100}%` : null
    }));

  return { hero, promos };
}

const brlCentavos = c => 'R$ ' + (c / 100).toFixed(2).replace('.', ',');

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
