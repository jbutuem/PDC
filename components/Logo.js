/**
 * Logo da loja desenhado por máscara CSS: o SVG é baixado uma vez, fica em
 * cache, e a cor vem de `color` — marrom no creme, creme no marrom.
 *
 * Os arquivos vivem no bucket público `marca` do Supabase (só o papel de
 * serviço grava nele). Para trocar um logo, suba `slug-N.svg` com N novo e
 * aumente VERSAO — o cache é de um ano.
 */
const VERSAO = 1;
const PROPORCAO = { cambui: 297.4 / 126.4, primavera: 305.5 / 126.1 };
const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/marca`;

export default function Logo({ loja, className = '' }) {
  const slug = loja?.slug ?? loja;
  const nome = loja?.nome ?? '';
  const desde = loja?.desde ? ` — Boulangerie, desde ${loja.desde}` : '';
  if (!PROPORCAO[slug] || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return <span className={`logo-texto ${className}`}>{nome}</span>;
  }
  return (
    <span
      role="img"
      aria-label={`${nome}${desde}`}
      className={`logo ${className}`}
      style={{ '--logo': `url(${BASE}/${slug}-${VERSAO}.svg)`, aspectRatio: PROPORCAO[slug] }}
    />
  );
}
