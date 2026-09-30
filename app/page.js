import Logo from '@/components/Logo';
import { carregarLojas, carregarVitrine } from '@/lib/menu';

export const revalidate = 3600;

export const metadata = {
  title: 'Cardápio — Pão do Cambuí e Pão da Primavera',
  description: 'Escolha a padaria para ver o cardápio do salão: Pão do Cambuí (desde 1994) ou Pão da Primavera (desde 1999), em Campinas.'
};

/**
 * Porta de entrada. O QR code da mesa deve apontar direto para /cambui ou
 * /primavera — esta página existe para quem chega pelo link geral.
 */
export default async function Escolha() {
  const lojas = await carregarLojas();
  const { hero } = await carregarVitrine(lojas[0]);

  return (
    <main className="escolha">
      <section className="escolha-foto rasgado" aria-hidden="true">
        {hero?.img && <img src={hero.img} alt="" fetchPriority="high" style={{ objectPosition: hero.foco }} />}
      </section>

      <div className="escolha-corpo">
        <p className="kick">CARDÁPIO DO SALÃO</p>
        <h1>Em qual padaria você está?</h1>

        <div className="casas">
          {lojas.map(l => (
            <a key={l.slug} href={`/${l.slug}`} className="casa">
              <Logo loja={l} />
              <span className="casa-ir">Ver o cardápio <span aria-hidden="true">→</span></span>
            </a>
          ))}
        </div>

        <p className="escolha-nota">
          As duas casas têm quase o mesmo cardápio, mas alguns preços e itens variam.
          Escolha a padaria onde você está para ver os valores certos.
        </p>
      </div>
    </main>
  );
}
