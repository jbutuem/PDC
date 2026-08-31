import Menu from '@/components/Menu';
import { carregarMenu, carregarComunicado } from '@/lib/menu';

// ISR: a página é estática no CDN e só é regerada quando a publicação
// chama /api/revalidate. O revalidate de 1h é apenas uma rede de segurança.
export const revalidate = 3600;

const PROMOS = [
  { selo: 'NOVO', tipo: 'novo', n: 'Cappuccino de pistache',
    d: 'Creme de pistache, raspas de chocolate e crocante por cima',
    por: 'R$ 29,90', obs: '250 ml' },
  { selo: 'ATÉ DOMINGO', n: 'Combo hambúrguer e fritas',
    d: 'Hambúrguer com queijo prato, alface e tomate mais porção individual',
    de: 'R$ 57,80', por: 'R$ 46,90', obs: 'após as 17h' },
  { selo: 'SEGUNDA A QUINTA', tipo: 'tempo', n: 'Açaí com 3 acompanhamentos',
    d: 'Tigela ou copo de 400 ml, você escolhe os três',
    de: 'R$ 31,90', por: 'R$ 26,90', obs: 'até as 18h' },
  { selo: 'TODO DIA ATÉ 10H', tipo: 'tempo', n: 'Pão na chapa e cappuccino',
    d: 'O par que abre o dia desde 1999',
    de: 'R$ 28,40', por: 'R$ 22,90', obs: 'no salão' }
];

export default async function Pagina() {
  const { secoes, origem } = await carregarMenu();
  const comunicado = await carregarComunicado();

  return (
    <>
      {origem === 'seed' && (
        <div style={{
          background: '#93431F', color: '#F8F2EA', padding: '7px 20px',
          fontSize: 12, fontWeight: 600, textAlign: 'center', letterSpacing: '.04em'
        }}>
          Dados do seed local — o Supabase ainda não está conectado a este deploy.
        </div>
      )}
      <Menu secoes={secoes} promos={PROMOS} comunicado={comunicado} />
    </>
  );
}
