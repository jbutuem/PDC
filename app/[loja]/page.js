import { notFound } from 'next/navigation';
import Menu from '@/components/Menu';
import { carregarLojas, carregarMenu, carregarComunicado, carregarVitrine } from '@/lib/menu';

// ISR: cada loja é uma página estática no CDN, regenerada quando o admin
// publica (revalidatePath do layout raiz). A 1 h é só rede de segurança.
export const revalidate = 3600;

export async function generateStaticParams() {
  const lojas = await carregarLojas();
  return lojas.map(l => ({ loja: l.slug }));
}

export async function generateMetadata({ params }) {
  const { loja: slug } = await params;
  const lojas = await carregarLojas();
  const loja = lojas.find(l => l.slug === slug);
  if (!loja) return {};
  const { hero } = await carregarVitrine(loja);
  const titulo = `Cardápio — ${loja.nome}`;
  const descricao = `Cardápio do salão do ${loja.nome} Boulangerie, em Campinas: ` +
    'padaria, cafés, sanduíches, refeições, pizzas e sucos.';
  return {
    title: titulo,
    description: descricao,
    openGraph: {
      title: titulo, description: descricao, type: 'website', locale: 'pt_BR',
      images: hero?.img ? [{ url: hero.img, width: hero.largura ?? undefined, height: hero.altura ?? undefined, alt: hero.alt }] : []
    }
  };
}

export default async function PaginaLoja({ params }) {
  const { loja: slug } = await params;
  const lojas = await carregarLojas();
  const loja = lojas.find(l => l.slug === slug);
  if (!loja) notFound();

  const [{ secoes, origem }, comunicado, { hero, promos }] = await Promise.all([
    carregarMenu(loja),
    carregarComunicado(loja),
    carregarVitrine(loja)
  ]);

  return (
    <>
      {origem === 'seed' && (
        <div className="tarja-seed">
          Dados do seed local — o Supabase ainda não está conectado a este deploy.
        </div>
      )}
      <Menu
        loja={loja}
        outras={lojas.filter(l => l.slug !== loja.slug)}
        secoes={secoes}
        promos={promos}
        comunicado={comunicado}
        hero={hero}
      />
    </>
  );
}
