'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const SPEC = {
  hero: { rot: 'HERO', prop: '2,6:1 no desktop · 4:5 no celular', px: 'mín. 2400 × 1000 px' },
  destaque: { rot: 'DESTAQUE', prop: '2,4:1 no desktop · 3:2 no celular', px: 'mín. 1800 × 1200 px' },
  produto: { rot: 'PRODUTO', prop: 'quadrada 1:1', px: 'mín. 800 × 800 px' },
  promo: { rot: 'PROMOÇÃO', prop: '4:3 · texto entra por baixo', px: 'mín. 1200 × 900 px' }
};

const brl = c => 'R$ ' + (c / 100).toFixed(2).replace('.', ',');
const norm = s => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function Slot({ papel, src, alt, foco }) {
  const s = SPEC[papel];
  return (
    <div className={'slot' + (src ? ' cheio' : '')} style={foco ? { '--foco': foco } : undefined}>
      {src && <img src={src} alt={alt ?? ''} loading="lazy" />}
      <div className="spec"><b>{s.rot}</b>{s.prop}<i>{s.px}</i></div>
    </div>
  );
}

function Item({ it }) {
  return (
    <article className={'item' + (it.esgotado ? ' fora' : '')} data-b={norm(`${it.n} ${it.d} ${it.c}`)}>
      <div>
        <h3>
          <span className="cod">{it.c}</span>{it.n}
          {it.veg ? <span className="veg" title="Vegetariano" /> : null}
          {it.esgotado ? <span className="esgotado">ESGOTADO</span> : null}
        </h3>
        {it.d ? <p className="desc">{it.d}</p> : null}
      </div>
      <div className="preco">{brl(it.p)}</div>
    </article>
  );
}

function Pizza({ it }) {
  return (
    <article className="pz" data-b={norm(`${it.n} ${it.d} ${it.c}`)}>
      <Slot papel="produto" src={it.img} alt={it.n} />
      <h3>{it.n}{it.veg ? <span className="veg" /> : null}</h3>
      <p className="desc">{it.d}</p>
      <div className="precos">
        <div>GDE. 35 cm<b>{brl(it.pg)}</b></div>
        <div>PEQ. 25 cm<b>{brl(it.pp)}</b></div>
      </div>
    </article>
  );
}

function CardPromo({ p }) {
  return (
    <article className="pc" data-b={norm(`${p.n} ${p.d}`)}>
      <Slot papel="promo" src={p.img} alt={p.n} foco="50% 45%" />
      <div className="veu" />
      <div className={'selo ' + (p.tipo ?? '')}>{p.selo}</div>
      <div className="txt">
        <h3>{p.n}</h3><p>{p.d}</p>
        <div className="val">{p.de ? <s>{p.de}</s> : null}<b>{p.por}</b><em>{p.obs}</em></div>
      </div>
    </article>
  );
}

export default function Menu({ secoes, promos = [], comunicado, banners = {} }) {
  const [q, setQ] = useState('');
  const [ativa, setAtiva] = useState(secoes[0]?.slug);
  const [avisoAberto, setAvisoAberto] = useState(true);
  const [slots, setSlots] = useState(false);
  const [grudou, setGrudou] = useState(false);
  const trilhoRef = useRef(null);

  const termo = norm(q.trim());
  const casa = txt => !termo || norm(txt).includes(termo);

  const visiveis = useMemo(() => secoes.map(s => ({
    ...s,
    itens: s.itens.filter(i => casa(`${i.n} ${i.d} ${i.c}`))
  })).filter(s => !termo || s.itens.length), [secoes, termo]);

  const nada = termo && visiveis.length === 0;

  useEffect(() => {
    document.body.classList.toggle('slots', slots);
  }, [slots]);

  useEffect(() => {
    const aoRolar = () => setGrudou(window.scrollY > 40);
    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => window.removeEventListener('scroll', aoRolar);
  }, []);

  useEffect(() => {
    if (termo) return;
    const obs = new IntersectionObserver(
      es => es.forEach(e => { if (e.isIntersecting) setAtiva(e.target.id); }),
      { rootMargin: '-130px 0px -70% 0px' }
    );
    document.querySelectorAll('.secao').forEach(s => obs.observe(s));
    return () => obs.disconnect();
  }, [termo, visiveis.length]);

  return (
    <>
      {comunicado && avisoAberto && (
        <div className="aviso">
          <div className="in">
            <span className="marca-a">RECADO DA CASA</span>
            <span dangerouslySetInnerHTML={{ __html: comunicado.texto }} />
            <button onClick={() => setAvisoAberto(false)} aria-label="Fechar aviso">×</button>
          </div>
        </div>
      )}

      <header className="topo">
        <div className="in">
          <div className="marca">Pão da Primavera<span>BOULANGERIE</span></div>
          <nav className="siteNav">
            <a href="#" className="on">Cardápio</a>
            <a href="#">A casa</a>
            <a href="#">Encomendas</a>
            <a href="#">Onde estamos</a>
          </nav>
          <div className="horario"><b>Aberto agora</b>até 21h45</div>
        </div>
      </header>

      <section className="hero">
        <Slot papel="hero" src={banners.hero?.img} alt={banners.hero?.n} foco="50% 42%" />
        <div className="veu" />
        <div className="txt">
          <div className="kick">{banners.hero?.kick ?? 'DA CHAPA, AGORA'}</div>
          <h1>{banners.hero?.n ?? 'Roast beef na ciabatta'}</h1>
          <p>{banners.hero?.d ?? 'Roast beef caseiro 100 g, patê de gorgonzola e rúcula'}</p>
          <div className="val">
            <strong>{banners.hero?.p ?? 'R$ 45,90'}</strong>
            <em>cód. {banners.hero?.c ?? '6596'}</em>
          </div>
        </div>
      </section>

      {promos.length > 0 && !termo && (
        <section className="faixa">
          <div className="in">
            <div className="tit">
              <h2>Esta semana</h2>
              <span>{promos.length} {promos.length === 1 ? 'oferta' : 'ofertas'}</span>
            </div>
            <div className="cards">{promos.map((p, i) => <CardPromo key={i} p={p} />)}</div>
          </div>
        </section>
      )}

      <nav className={'nav' + (grudou ? ' grudou' : '')}>
        <div className="in">
          <div className={'busca' + (q ? ' tem' : '')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" />
            </svg>
            <input value={q} onChange={e => setQ(e.target.value)} type="search"
                   placeholder="Buscar prato, bebida ou código" autoComplete="off" />
            <button className="limpar" onClick={() => setQ('')}>limpar</button>
          </div>
          {!termo && (
            <div className="trilho" ref={trilhoRef}>
              {secoes.map(s => (
                <a key={s.slug} href={'#' + s.slug} className={ativa === s.slug ? 'on' : undefined}>
                  {s.nome}
                </a>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="palco">
        <aside className="lateral">
          <div className="buscaD">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" />
            </svg>
            <input value={q} onChange={e => setQ(e.target.value)} type="search"
                   placeholder="Buscar no cardápio" autoComplete="off" />
          </div>
          <nav className="indice">
            {secoes.map(s => (
              <a key={s.slug} href={'#' + s.slug} className={ativa === s.slug ? 'on' : undefined}>
                {s.nome}<span>{s.itens.length}</span>
              </a>
            ))}
          </nav>
          <p className="rodapinho">
            Preços vigentes desde a última publicação.<br />Cardápio impresso disponível no balcão.
          </p>
        </aside>

        <div className="conteudo">
          <main>
            {visiveis.map(s => (
              <section className="secao" id={s.slug} key={s.slug}>
                <div className="cab">
                  <h2>{s.nome}<i>{s.itens.length}</i></h2>
                  {s.sub ? <p>{s.sub}</p> : null}
                </div>
                {s.grade
                  ? <div className="grade">{s.itens.map(i => <Pizza key={i.c} it={i} />)}</div>
                  : <div className="lista">{s.itens.map(i => <Item key={i.c} it={i} />)}</div>}
                {s.nota ? <p className="nota">{s.nota}</p> : null}
              </section>
            ))}
          </main>

          <div className={'vazio' + (nada ? ' on' : '')}>
            <h3>Nada com esse nome</h3>
            <p>Tente outra palavra, ou o código do produto.</p>
          </div>
        </div>
      </div>

      <footer className="pe">
        <div className="in">
          <div className="marca">Pão da Primavera<span>DESDE 1999</span></div>
          <div className="links">
            <a href="https://www.paodaprimavera.com.br">paodaprimavera.com.br</a>
            <a href="https://instagram.com/paodaprimaveracampinas">@paodaprimaveracampinas</a>
            <a href="https://facebook.com/paodaprimavera">facebook.com/paodaprimavera</a>
          </div>
          <div className="acoes">
            <button>Como chegar</button>
            <button>Fazer uma encomenda</button>
            <button>Falar no WhatsApp</button>
          </div>
          <p className="legal">
            O acesso às dependências onde são preparados e armazenados nossos alimentos é garantido
            pela lei nº 8431, de 17 de julho de 1995. Proibida a venda de bebidas alcoólicas para
            menores de 18 anos. Procon Campinas – R. Maria Monteiro, 1028 – Cambuí, Campinas/SP –
            CEP 13.025-151. Disque 151. Art. 5 – No caso de divergência de preço para o mesmo produto
            entre sistemas de informação de preços utilizados pelo estabelecimento, o consumidor
            pagará o menor dentre eles – Lei Federal nº 10.962/04.
          </p>
        </div>
      </footer>

      <button className="dev" onClick={() => setSlots(v => !v)}>
        <i /> Ver slots de imagem
      </button>
    </>
  );
}
