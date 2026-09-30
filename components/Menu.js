'use client';

import { useEffect, useMemo, useState } from 'react';
import Logo from './Logo';
import Status from './Status';

const SPEC = {
  hero: { rot: 'HERO', prop: '2,6:1 no desktop · 5:4 no celular', px: 'mín. 2400 × 1600 px' },
  produto: { rot: 'PRODUTO', prop: 'quadrada 1:1', px: 'mín. 800 × 800 px' },
  promo: { rot: 'PROMOÇÃO', prop: '4:3 · texto entra por baixo', px: 'mín. 1200 × 900 px' }
};

const brl = c => 'R$ ' + (c / 100).toFixed(2).replace('.', ',');
const norm = s => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const rotulo = r => (/^gde/i.test(r ?? '') ? 'Grande' : /^peq/i.test(r ?? '') ? 'Pequena' : (r ?? ''));

function Slot({ papel, src, alt, foco, prioritaria }) {
  const s = SPEC[papel];
  return (
    <div className={'slot' + (src ? ' cheio' : '')} style={foco ? { '--foco': foco } : undefined}>
      {src && (
        <img
          src={src}
          alt={alt ?? ''}
          loading={prioritaria ? 'eager' : 'lazy'}
          fetchPriority={prioritaria ? 'high' : 'auto'}
          decoding={prioritaria ? 'sync' : 'async'}
        />
      )}
      <div className="spec"><b>{s.rot}</b>{s.prop}<i>{s.px}</i></div>
    </div>
  );
}

/** O ponto de vegetariano nunca cai sozinho na linha de baixo. */
function Nome({ it }) {
  const palavras = it.n.split(' ');
  const ultima = palavras.pop();
  return (
    <>
      {palavras.length ? palavras.join(' ') + ' ' : ''}
      <span className="nw">
        {ultima}
        {it.veg ? <span className="veg" title="Vegetariano" aria-label="vegetariano" /> : null}
      </span>
    </>
  );
}

function Item({ it, nota }) {
  const duplo = it.pg != null;
  return (
    <article className={'item' + (duplo ? ' dupla' : '') + (it.esgotado ? ' fora' : '') + (it.img ? ' comfoto' : '')}>
      {it.img && (
        <img className="mini" src={it.img} alt="" loading="lazy"
             style={it.foco ? { objectPosition: it.foco } : undefined} />
      )}
      <div className="txt">
        <h3>
          <Nome it={it} />
          {it.esgotado ? <span className="esgotado">ESGOTADO</span> : null}
        </h3>
        {/* "400 ml" em cada suco é ruído quando o subtítulo já diz "400 ml" */}
        {it.d && it.d !== nota ? <p className="desc">{it.d}</p> : null}
        {it.c ? <span className="cod">cód. {it.c}</span> : null}
      </div>
      {duplo ? (
        <div className="precos2">
          <span><small>{rotulo(it.rg)}</small>{brl(it.pg)}</span>
          <span><small>{rotulo(it.rp)}</small>{brl(it.pp)}</span>
        </div>
      ) : (
        <div className="preco">{brl(it.p)}</div>
      )}
    </article>
  );
}

function CardPromo({ p }) {
  return (
    <article className="pc">
      <Slot papel="promo" src={p.img} alt="" foco={p.foco ?? '50% 45%'} />
      <div className="veu" />
      {p.selo ? <div className={'selo ' + (p.tipo ?? '')}>{p.selo}</div> : null}
      <div className="txt">
        <h3>{p.n}</h3><p>{p.d}</p>
        {(p.por || p.obs) && (
          <div className="val">
            {p.de ? <s>{p.de}</s> : null}
            {p.por ? <b>{p.por}</b> : null}
            {p.obs ? <em>{p.obs}</em> : null}
          </div>
        )}
      </div>
    </article>
  );
}

function Grupo({ g }) {
  return (
    <div className="grupo">
      {g.nome && (
        <div className="grupo-cab">
          <h3>{g.nome}</h3>
          {g.nota ? <p>{g.nota}</p> : null}
        </div>
      )}
      <div className="lista">{g.itens.map(i => <Item key={i.id ?? i.c} it={i} nota={g.nota} />)}</div>
    </div>
  );
}

export default function Menu({ loja, outras = [], secoes, promos = [], comunicado, hero = null }) {
  const [q, setQ] = useState('');
  const [ativa, setAtiva] = useState(secoes[0]?.slug);
  const [avisoAberto, setAvisoAberto] = useState(true);
  const [slots, setSlots] = useState(false);
  const [modoDev, setModoDev] = useState(false);
  const [grudou, setGrudou] = useState(false);

  const termo = norm(q.trim());

  const visiveis = useMemo(() => {
    if (!termo) return secoes;
    return secoes.map(s => {
      const grupos = s.grupos
        .map(g => ({ ...g, itens: g.itens.filter(i => norm(`${i.n} ${i.d} ${i.c} ${g.nome ?? ''}`).includes(termo)) }))
        .filter(g => g.itens.length);
      return { ...s, grupos, total: grupos.reduce((n, g) => n + g.itens.length, 0) };
    }).filter(s => s.total);
  }, [secoes, termo]);

  const nada = termo && visiveis.length === 0;
  const achados = termo ? visiveis.reduce((n, s) => n + s.total, 0) : 0;

  useEffect(() => { document.body.classList.toggle('slots', slots); }, [slots]);

  // A régua de slots é ferramenta de produção; só aparece com ?slots=1.
  useEffect(() => { setModoDev(new URLSearchParams(window.location.search).has('slots')); }, []);

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

  // Mantém o chip da seção ativa visível no trilho horizontal do celular.
  useEffect(() => {
    const el = document.querySelector(`.trilho a[href="#${ativa}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [ativa]);

  const ig = loja.instagram ? `https://instagram.com/${loja.instagram}` : null;
  const fb = loja.facebook ? `https://facebook.com/${loja.facebook}` : null;
  const siteCurto = loja.site?.replace(/^https?:\/\/(www\.)?/, '');

  return (
    <>
      {comunicado && avisoAberto && (
        <div className="aviso" role="status">
          <div className="in">
            <span className="marca-a">RECADO DA CASA</span>
            <span dangerouslySetInnerHTML={{ __html: comunicado.texto }} />
            <button onClick={() => setAvisoAberto(false)} aria-label="Fechar aviso">×</button>
          </div>
        </div>
      )}

      <header className="topo">
        <div className="in">
          <a href={`/${loja.slug}`} className="topo-logo" aria-label={`${loja.nome} — início do cardápio`}>
            <Logo loja={loja} />
          </a>
          <nav className="siteNav" aria-label="Site">
            <a href="#cardapio" className="on">Cardápio</a>
            {loja.site && <a href={loja.site} target="_blank" rel="noreferrer">A casa</a>}
            {loja.mapa && <a href={loja.mapa} target="_blank" rel="noreferrer">Como chegar</a>}
            {ig && <a href={ig} target="_blank" rel="noreferrer">Instagram</a>}
          </nav>
          <div className="topo-dir">
            <Status abre={loja.abre} fecha={loja.fecha} />
            {outras.length > 0 && <a href="/" className="trocar">Trocar de padaria</a>}
          </div>
        </div>
      </header>

      <section className="hero rasgado">
        <Slot papel="hero" src={hero?.img} alt={hero?.alt ?? ''} foco={hero?.foco ?? '50% 50%'} prioritaria />
        <div className="veu" />
        <div className="txt">
          <div className="kick">{hero?.kick ?? `DESDE ${loja.desde ?? ''}`}</div>
          <h1>{hero?.n ?? loja.nome}</h1>
          {hero?.d ? <p>{hero.d}</p> : null}
          <a className="hero-bt" href="#cardapio">Ver o cardápio</a>
        </div>
      </section>

      {promos.length > 0 && !termo && (
        <section className="faixa" aria-label="Ofertas desta semana">
          <div className="in">
            <div className="tit">
              <h2>Esta semana</h2>
              <span>{promos.length} {promos.length === 1 ? 'oferta' : 'ofertas'}</span>
            </div>
            <div className="cards">{promos.map((p, i) => <CardPromo key={i} p={p} />)}</div>
          </div>
        </section>
      )}

      <span id="cardapio" className="ancora" aria-hidden="true" />

      <nav className={'nav' + (grudou ? ' grudou' : '')} aria-label="Seções do cardápio">
        <div className="in">
          <div className={'busca' + (q ? ' tem' : '')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" />
            </svg>
            <input value={q} onChange={e => setQ(e.target.value)} type="search" aria-label="Buscar no cardápio"
                   placeholder="Buscar prato, bebida ou código" autoComplete="off" />
            <button className="limpar" onClick={() => setQ('')}>limpar</button>
          </div>
          {!termo && (
            <div className="trilho">
              {secoes.map(s => (
                <a key={s.slug} href={'#' + s.slug} className={ativa === s.slug ? 'on' : undefined}>{s.nome}</a>
              ))}
            </div>
          )}
          {termo && !nada && (
            <p className="achados">{achados} {achados === 1 ? 'item encontrado' : 'itens encontrados'}</p>
          )}
        </div>
      </nav>

      <div className="palco">
        <aside className="lateral">
          <div className="buscaD">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" />
            </svg>
            <input value={q} onChange={e => setQ(e.target.value)} type="search" aria-label="Buscar no cardápio"
                   placeholder="Buscar no cardápio" autoComplete="off" />
          </div>
          <nav className="indice" aria-label="Seções">
            {secoes.map(s => (
              <a key={s.slug} href={'#' + s.slug} className={ativa === s.slug ? 'on' : undefined}>
                {s.nome}<span>{s.total}</span>
              </a>
            ))}
          </nav>
          <p className="rodapinho">
            <span className="veg" /> vegetariano<br />
            Preços válidos no salão do {loja.nome}.
          </p>
        </aside>

        <div className="conteudo">
          <p className="legenda"><span className="veg" /> vegetariano · preços do salão do {loja.nome}</p>
          <main>
            {visiveis.map(s => (
              <section className="secao" id={s.slug} key={s.slug}>
                <div className="cab">
                  <h2>{s.nome}<i>{s.total}</i></h2>
                  {s.sub ? <p>{s.sub}</p> : null}
                </div>
                {s.grupos.map(g => <Grupo key={g.id} g={g} />)}
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
          <Logo loja={loja} className="pe-logo" />
          <div className="links">
            {loja.site && <a href={loja.site} target="_blank" rel="noreferrer">{siteCurto}</a>}
            {ig && <a href={ig} target="_blank" rel="noreferrer">@{loja.instagram}</a>}
            {fb && <a href={fb} target="_blank" rel="noreferrer">facebook.com/{loja.facebook}</a>}
            {loja.endereco && <span>{loja.endereco}</span>}
          </div>
          <div className="acoes">
            {loja.mapa && <a href={loja.mapa} target="_blank" rel="noreferrer">Como chegar</a>}
            {loja.site && <a href={loja.site} target="_blank" rel="noreferrer">Fazer uma encomenda</a>}
            {loja.whatsapp && <a href={loja.whatsapp} target="_blank" rel="noreferrer">Falar no WhatsApp</a>}
          </div>
          {outras.length > 0 && (
            <div className="outras">
              {outras.map(o => (
                <a key={o.slug} href={`/${o.slug}`}>Ver o cardápio do {o.nome} →</a>
              ))}
            </div>
          )}
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

      {modoDev && (
        <button className="dev" onClick={() => setSlots(v => !v)}>
          <i /> Ver slots de imagem
        </button>
      )}
    </>
  );
}
