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

const brlCentavos = c => 'R$ ' + (c / 100).toFixed(2).replace('.', ',');
const foco = img => `${img.foco_x * 100}% ${img.foco_y * 100}%`;

/**
 * Lojas usadas quando o banco não está configurado (primeiro deploy, ambiente
 * local sem .env). Mesmos dados da migração 0010.
 */
const LOJAS_SEED = [
  { id: 'seed-cambui', slug: 'cambui', nome: 'Pão do Cambuí', desde: 1994, assinatura: 'Boulangerie',
    site: 'https://www.paodocambui.com.br', instagram: 'paodocambuioficial', facebook: 'panificadora.paodocambui',
    abre: '07:00:00', fecha: '21:45:00' },
  { id: 'seed-primavera', slug: 'primavera', nome: 'Pão da Primavera', desde: 1999, assinatura: 'Boulangerie',
    site: 'https://www.paodaprimavera.com.br', instagram: 'paodaprimaveracampinas', facebook: 'paodaprimavera',
    abre: '07:00:00', fecha: '21:45:00' }
];

export async function carregarLojas() {
  if (!temBanco) return LOJAS_SEED;
  const { data, error } = await clientePublico()
    .from('lojas')
    .select('id, slug, nome, assinatura, desde, site, instagram, facebook, whatsapp, endereco, mapa, abre, fecha, ordem')
    .eq('ativo', true)
    .order('ordem');
  if (error || !data?.length) return LOJAS_SEED;
  return data;
}

export async function carregarLoja(slug) {
  const lojas = await carregarLojas();
  return lojas.find(l => l.slug === slug) ?? null;
}

/**
 * Preço vigente de uma variante para uma loja.
 * A loja herda o preço base (loja_id nulo) a menos que tenha o próprio.
 */
function precoNaLoja(precos = [], lojaId) {
  const agora = Date.now();
  const vigentes = precos
    .filter(p => new Date(p.vigencia_inicio) <= agora && (!p.vigencia_fim || new Date(p.vigencia_fim) > agora))
    .sort((a, b) => new Date(b.vigencia_inicio) - new Date(a.vigencia_inicio));
  const proprio = vigentes.find(p => p.loja_id === lojaId);
  const base = vigentes.find(p => !p.loja_id);
  return (proprio ?? base)?.valor_centavos ?? null;
}

/**
 * Cardápio publicado de uma loja, no formato que os componentes esperam:
 * seções → grupos → itens. Itens que a loja não vende não aparecem.
 * Sem banco configurado, cai no seed local.
 */
export async function carregarMenu(loja) {
  if (!temBanco) {
    return {
      origem: 'seed',
      secoes: seed.map(s => ({ ...s, total: s.itens.length, grupos: [{ id: s.slug, nome: null, nota: s.nota, itens: s.itens }] }))
    };
  }

  const { data, error } = await clientePublico()
    .from('secoes')
    .select(`
      slug, nome, subtitulo, ordem,
      grupos ( id, nome, nota, ordem ),
      itens (
        id, grupo_id, codigo_pdv, nome, descricao, tags, ordem, esgotado,
        variantes ( rotulo, ordem, precos ( valor_centavos, vigencia_inicio, vigencia_fim, loja_id ) ),
        imagens ( storage_path, papel, foco_x, foco_y ),
        itens_lojas ( loja_id, disponivel )
      )
    `)
    .eq('visivel', true)
    .order('ordem');

  if (error || !data?.length) {
    console.error('Menu vindo do seed local:', error?.message ?? 'banco vazio');
    return { origem: 'seed', secoes: seed.map(s => ({ ...s, total: s.itens.length, grupos: [{ id: s.slug, nome: null, itens: s.itens }] })) };
  }

  const vende = i => !(i.itens_lojas ?? []).some(x => x.loja_id === loja.id && x.disponivel === false);

  const secoes = data.map(s => {
    const itens = (s.itens ?? [])
      .filter(vende)
      .sort((a, b) => a.ordem - b.ordem)
      .map(i => {
        const vars = (i.variantes ?? []).sort((a, b) => a.ordem - b.ordem);
        const foto = (i.imagens ?? []).find(x => x.papel === 'produto')
                  ?? (i.imagens ?? []).find(x => x.papel === 'regular');
        const base = {
          id: i.id,
          g: i.grupo_id,
          c: i.codigo_pdv ?? '',
          n: i.nome,
          d: i.descricao ?? '',
          veg: (i.tags ?? []).includes('vegetariano') ? 1 : 0,
          esgotado: i.esgotado ? 1 : 0,
          img: foto ? urlImagem(foto.storage_path) : null,
          foco: foto ? foco(foto) : null
        };
        if (vars.length > 1) {
          return { ...base, pg: precoNaLoja(vars[0].precos, loja.id), pp: precoNaLoja(vars[1].precos, loja.id),
                   rg: vars[0].rotulo, rp: vars[1].rotulo };
        }
        return { ...base, p: precoNaLoja(vars[0]?.precos, loja.id) };
      })
      // Lei 10.962/04: item sem preço vigente não vai ao ar.
      .filter(i => i.p != null || (i.pg != null && i.pp != null));

    const grupos = (s.grupos ?? [])
      .sort((a, b) => a.ordem - b.ordem)
      .map(g => ({ id: g.id, nome: g.nome, nota: g.nota, itens: itens.filter(i => i.g === g.id) }));
    const soltos = itens.filter(i => !i.g || !grupos.some(g => g.id === i.g));
    if (soltos.length) grupos.unshift({ id: `${s.slug}-geral`, nome: null, nota: null, itens: soltos });

    return {
      slug: s.slug,
      nome: s.nome,
      sub: s.subtitulo ?? undefined,
      total: itens.length,
      grupos: grupos.filter(g => g.itens.length)
    };
  }).filter(s => s.total);

  return { origem: 'supabase', secoes };
}

/** Escolhe o registro da própria loja; na falta, o que vale para as duas. */
const daLoja = (lista, lojaId) =>
  lista.find(x => x.loja_id === lojaId) ?? lista.find(x => !x.loja_id) ?? null;

/**
 * Hero e cards de promoção publicados para a loja.
 * Registros com loja_id nulo aparecem nas duas.
 */
export async function carregarVitrine(loja) {
  if (!temBanco || !loja) return { hero: null, promos: [] };
  const sb = clientePublico();
  const agora = new Date().toISOString();
  const daquiOuDasDuas = `loja_id.eq.${loja.id},loja_id.is.null`;

  const [{ data: heros }, { data: promocoes }] = await Promise.all([
    sb.from('imagens')
      .select('storage_path, foco_x, foco_y, alt, chamada, titulo, linha_apoio, largura, altura, loja_id, itens ( nome, descricao )')
      .eq('papel', 'hero').or(daquiOuDasDuas)
      .order('criado_em', { ascending: false }).limit(6),
    sb.from('promocoes')
      .select('id, titulo, chamada, selo, tipo, preco_de_centavos, preco_por_centavos, observacao, dias_semana, loja_id, imagens ( storage_path, foco_x, foco_y )')
      .eq('ativo', true).lte('inicio', agora).gt('fim', agora).or(daquiOuDasDuas)
      .order('ordem')
  ]);

  const h = daLoja(heros ?? [], loja.id);
  const hero = h ? {
    img: urlImagem(h.storage_path),
    foco: foco(h),
    alt: h.alt ?? '',
    largura: h.largura ?? null,
    altura: h.altura ?? null,
    kick: h.chamada ?? `DESDE ${loja.desde ?? ''}`.trim(),
    n: h.titulo ?? h.itens?.nome ?? loja.nome,
    d: h.linha_apoio ?? h.itens?.descricao ?? null
  } : null;

  // Promoção de "segunda a quinta" não aparece num sábado.
  // O servidor roda em UTC; o dia que importa é o de Campinas.
  const diaHoje = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getDay();

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
      foco: p.imagens ? foco(p.imagens) : null
    }));

  return { hero, promos };
}

export async function carregarComunicado(loja) {
  // Sem banco não há recado: um texto fixo aqui envelhece e vai ao ar errado.
  if (!temBanco) return null;
  const { data } = await clientePublico()
    .from('comunicados')
    .select('texto, nivel, loja_id')
    .eq('ativo', true)
    .or(`loja_id.eq.${loja.id},loja_id.is.null`)
    .order('inicio', { ascending: false })
    .limit(4);
  return daLoja(data ?? [], loja.id);
}
