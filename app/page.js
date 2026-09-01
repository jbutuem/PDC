import Menu from '@/components/Menu';
import { carregarMenu, carregarComunicado, carregarVitrine } from '@/lib/menu';

// ISR: a página é estática no CDN e só é regerada quando a publicação
// chama /api/revalidate. O revalidate de 1h é apenas uma rede de segurança.
export const revalidate = 3600;

export async function generateMetadata() {
  const { hero } = await carregarVitrine();
  const descricao =
    'Cardápio completo do salão da Pão da Primavera Boulangerie, no Cambuí, ' +
    'em Campinas. Padaria, cafeteria, almoço, pizzas e sanduíches.';

  return {
    title: 'Cardápio — Pão da Primavera Boulangerie',
    description: descricao,
    openGraph: {
      title: 'Cardápio — Pão da Primavera',
      description: descricao,
      type: 'website',
      locale: 'pt_BR',
      images: hero?.img
        ? [{ url: hero.img, width: hero.largura ?? undefined,
             height: hero.altura ?? undefined, alt: hero.alt }]
        : []
    }
  };
}

export default async function Pagina() {
  // Uma volta só ao banco por render. Antes eram três chamadas em série.
  const [{ secoes, origem }, comunicado, { hero, promos }] = await Promise.all([
    carregarMenu(),
    carregarComunicado(),
    carregarVitrine()
  ]);

  return (
    <>
      {origem === 'seed' && (
        <div className="tarja-seed">
          Dados do seed local — o Supabase ainda não está conectado a este deploy.
        </div>
      )}
      <Menu secoes={secoes} promos={promos} comunicado={comunicado} hero={hero} />
    </>
  );
}
