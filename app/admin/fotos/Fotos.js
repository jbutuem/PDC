'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { registrarImagem, descartarArquivo, moverFoco, apagarImagem } from '@/app/admin/imagens/acoes';
import { prepararImagem, formatarTamanho } from '@/lib/imagem';

const normal = t => (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const limitar = v => Math.min(1, Math.max(0, v));

/** Mensagens do Storage e do Next vêm em inglês ou genéricas; aqui viram algo acionável. */
function traduzir(msg = '') {
  if (/failed to fetch|network|load failed|networkerror/i.test(msg))
    return 'Sem conexão. Confira o Wi-Fi ou os dados móveis e toque em Enviar de novo.';
  if (/jwt|row-level security|not authorized|unauthorized|sem permiss/i.test(msg))
    return 'Sua sessão expirou ou não tem permissão. Saia e entre de novo.';
  if (/exceeded the maximum allowed size/i.test(msg))
    return 'A foto ficou grande demais mesmo depois de reduzida. Tente de novo.';
  if (/mime type/i.test(msg)) return 'Formato não aceito. Tire a foto de novo.';
  if (/server components render|unexpected response|digest/i.test(msg) || !msg)
    return 'Não consegui salvar a foto. Toque em Enviar de novo; se continuar, avise a agência.';
  return msg;
}

const Camera = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 8h3l1.6-2.4A1.5 1.5 0 0 1 9.9 5h4.2a1.5 1.5 0 0 1 1.3.6L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.6" />
  </svg>
);
const Galeria = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
    <circle cx="9" cy="10" r="1.7" />
    <path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" />
  </svg>
);

/** Botão que abre a câmera (ou a galeria). É um <label>: no iPhone é o jeito confiável de abrir o seletor. */
function BotaoArquivo({ camera, classe, ocupado, aoEscolher, children }) {
  return (
    <label className={`fc-bt ${classe}${ocupado ? ' ocupado' : ''}`} aria-disabled={ocupado || undefined}>
      <input type="file" accept="image/*" {...(camera ? { capture: 'environment' } : {})}
             disabled={ocupado} onChange={aoEscolher} />
      {children}
    </label>
  );
}

export default function Fotos({ secoes, urlBase, podeEditar, podeRemover }) {
  // Fotos trocadas nesta visita: a lista reage na hora, sem esperar o servidor.
  const [trocas, setTrocas] = useState({});
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState(() =>
    secoes.some(s => s.itens.some(i => !i.foto)) ? 'sem' : 'todos');
  const [selId, setSelId] = useState(null);
  const [pronta, setPronta] = useState(null);
  const [foco, setFoco] = useState({ x: 0.5, y: 0.5 });
  const [fase, setFase] = useState('');
  const [erro, setErro] = useState(null);
  const camada = useRef(null);

  const todas = useMemo(() => secoes.map(sec => ({
    ...sec,
    itens: sec.itens.map(i => (i.id in trocas ? { ...i, foto: trocas[i.id] } : i))
  })), [secoes, trocas]);
  const itens = useMemo(() => todas.flatMap(sec => sec.itens.map(i => ({ ...i, secao: sec.nome }))), [todas]);
  const nCom = itens.filter(i => i.foto).length;
  const nSem = itens.length - nCom;
  const sel = itens.find(i => i.id === selId) ?? null;
  const ocupado = ['preparando', 'enviando', 'salvando'].includes(fase);

  const termo = normal(busca.trim());
  const visiveis = todas.map(sec => ({
    ...sec,
    itens: sec.itens.filter(i => termo
      ? normal(i.nome).includes(termo) || i.codigo.includes(termo)
      : filtro === 'todos' || (filtro === 'sem' ? !i.foto : Boolean(i.foto)))
  })).filter(sec => sec.itens.length);

  // Botão "voltar" do celular: sai do item e volta para a lista, sem sair da página.
  useEffect(() => {
    const aoVoltar = e => {
      const id = e.state?.fotoItem;
      setSelId(id ?? null);
      limpar();
    };
    window.addEventListener('popstate', aoVoltar);
    return () => window.removeEventListener('popstate', aoVoltar);
  }, []);

  // Com a camada aberta, a lista por baixo não rola junto (e guarda a posição).
  useEffect(() => {
    if (!selId) return;
    camada.current?.scrollTo(0, 0);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = antes; };
  }, [selId]);

  // Libera a memória da prévia quando ela sai de cena.
  useEffect(() => () => { if (pronta?.url) URL.revokeObjectURL(pronta.url); }, [pronta]);

  function limpar() {
    setPronta(null);
    setFase('');
    setErro(null);
    setFoco({ x: 0.5, y: 0.5 });
  }

  function abrir(id, { substituir = false } = {}) {
    limpar();
    setSelId(id);
    if (substituir) window.history.replaceState({ fotoItem: id }, '');
    else window.history.pushState({ fotoItem: id }, '');
  }

  function voltar() {
    if (window.history.state?.fotoItem) window.history.back();
    else { setSelId(null); limpar(); }
  }

  async function escolher(e) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setErro(null);
    setFase('preparando');
    try {
      const p = await prepararImagem(arquivo, 'produto');
      setPronta({ ...p, url: URL.createObjectURL(p.blob) });
      setFoco({ x: 0.5, y: 0.5 });
      setFase('');
    } catch (err) {
      setErro(err.message);
      setFase('');
    }
  }

  async function enviar() {
    if (!pronta || !sel || ocupado) return;
    setErro(null);
    setFase('enviando');
    const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const nomeArquivo = String(sel.codigo || sel.id).replace(/[^\w-]/g, '');
    const caminho = `produto/${nomeArquivo}-${Date.now()}.jpg`;
    try {
      const { error } = await sb.storage.from('menu')
        .upload(caminho, pronta.blob, { cacheControl: '31536000', contentType: 'image/jpeg' });
      if (error) throw new Error(error.message);

      // Daqui em diante o arquivo existe. Se o registro falhar, ele sai do bucket.
      setFase('salvando');
      let r;
      try {
        r = await registrarImagem({
          storage_path: caminho, papel: 'produto', item_id: sel.id,
          largura: pronta.largura, altura: pronta.altura, alt: sel.nome,
          foco_x: foco.x, foco_y: foco.y
        });
      } catch (falha) {
        await descartarArquivo(caminho).catch(() => {});
        throw falha;
      }
      setTrocas(t => ({ ...t, [sel.id]: { id: r.id, caminho, x: foco.x, y: foco.y } }));
      setFase('feito');
    } catch (err) {
      setErro(traduzir(err.message));
      setFase('');
    }
  }

  function tocarNaFoto(e) {
    if (!podeEditar || ocupado) return;
    const r = e.currentTarget.getBoundingClientRect();
    const novo = {
      x: +limitar((e.clientX - r.left) / r.width).toFixed(2),
      y: +limitar((e.clientY - r.top) / r.height).toFixed(2)
    };
    if (pronta && fase !== 'feito') { setFoco(novo); return; }
    // Foto já no ar: o ajuste do recorte vale na hora.
    const foto = sel?.foto;
    if (!foto) return;
    setTrocas(t => ({ ...t, [sel.id]: { ...foto, ...novo } }));
    if (fase === 'feito') setFoco(novo);
    moverFoco(foto.id, novo.x, novo.y).catch(() => setErro('Não consegui salvar o ajuste do recorte. Tente de novo.'));
  }

  async function remover() {
    const foto = sel?.foto;
    if (!foto || !window.confirm(`Remover a foto de "${sel.nome}"? O item fica sem foto no cardápio.`)) return;
    setFase('salvando');
    try {
      await apagarImagem(foto.id, foto.caminho);
      setTrocas(t => ({ ...t, [sel.id]: null }));
      limpar();
    } catch (err) {
      setErro(traduzir(err.message));
      setFase('');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Tela do item — camada por cima da lista, como um app                */
  /* ------------------------------------------------------------------ */
  let telaItem = null;
  if (sel) {
    const usandoNova = Boolean(pronta);
    const src = usandoNova ? pronta.url : sel.foto ? `${urlBase}/${sel.foto.caminho}` : null;
    const alvo = usandoNova ? foco : sel.foto ? { x: sel.foto.x, y: sel.foto.y } : null;
    const pos = itens.findIndex(i => i.id === sel.id);
    const proximo = [...itens.slice(pos + 1), ...itens.slice(0, pos)].find(i => !i.foto) ?? null;
    const reducao = pronta && pronta.antes > pronta.depois
      ? Math.round((1 - pronta.depois / pronta.antes) * 100) : 0;

    // Uma linha de estado sempre visível, colada aos botões.
    let estado = null;
    if (erro) estado = <p className="fc-estado erro" role="alert">{erro}</p>;
    else if (fase === 'feito') estado = <p className="fc-estado ok" role="status"><b>Foto enviada.</b> O cardápio das lojas já foi atualizado.</p>;
    else if (fase === 'preparando') estado = <p className="fc-estado"><span className="girando" /> Reduzindo a foto…</p>;
    else if (pronta) estado = (
      <p className="fc-estado">
        {reducao > 0
          ? <>Reduzida: <s>{formatarTamanho(pronta.antes)}</s> → <b>{formatarTamanho(pronta.depois)}</b> <em>{reducao}% menor</em></>
          : <>Pronta para enviar: <b>{formatarTamanho(pronta.depois)}</b></>}
      </p>
    );

    telaItem = (
      <div className="fc-camada" ref={camada} role="dialog" aria-modal="true" aria-label={`Foto de ${sel.nome}`}>
        <div className="fc-topo">
          <div className="fc-topo-in">
            <button type="button" className="fc-voltar" onClick={voltar} disabled={ocupado}>
              <span aria-hidden="true">←</span> Itens
            </button>
            <span className="fc-secao">{sel.secao}</span>
          </div>
        </div>

        <div className="fc fc-item">
          <h1 className="fc-nome">{sel.nome}</h1>
          {sel.codigo && <p className="fc-cod">Código {sel.codigo}</p>}

          {src ? (
            <div className="fc-palco">
              <div className="fc-quadro" onClick={tocarNaFoto}
                   role={podeEditar ? 'button' : undefined}
                   aria-label={podeEditar ? 'Toque no produto para centralizar o recorte' : undefined}>
                <img src={src} alt={sel.nome} draggable={false} />
                {alvo && <span className="fc-alvo" style={{ left: `${alvo.x * 100}%`, top: `${alvo.y * 100}%` }} />}
                {fase === 'preparando' && <div className="fc-veu"><span className="girando claro" /> Reduzindo…</div>}
              </div>
            </div>
          ) : (
            <div className="fc-vazio">
              {fase === 'preparando'
                ? <><span className="girando" /><b>Reduzindo a foto…</b></>
                : <><Camera /><b>Este item ainda não tem foto</b><span>Produto bem iluminado, de preferência com luz natural e fundo limpo.</span></>}
            </div>
          )}

          {src && (
            <div className="fc-assim">
              <div className="fc-mini">
                <img src={src} alt="" draggable={false}
                     style={alvo ? { objectPosition: `${alvo.x * 100}% ${alvo.y * 100}%` } : undefined} />
              </div>
              <div>
                <b>Assim aparece no cardápio</b>
                <span>{podeEditar ? 'Toque no produto, na foto acima, para centralizar o recorte.' : 'Recorte quadrado, no centro marcado.'}</span>
                {pronta && fase !== 'feito' && (
                  <small>{pronta.largura}×{pronta.altura} px · localização do celular removida</small>
                )}
              </div>
            </div>
          )}

          {pronta?.aviso && fase !== 'feito' && <div className="aviso-adm mel fc-aviso">{pronta.aviso}</div>}

          {sel.foto && !pronta && podeRemover && (
            <button type="button" className="fc-remover" onClick={remover} disabled={ocupado}>Remover foto</button>
          )}

          {!podeEditar && (
            <div className="aviso-adm info fc-aviso">Seu papel é <b>somente leitura</b>: dá para ver, mas não enviar fotos.</div>
          )}
        </div>

        {podeEditar && (
          <div className="fc-acoes">
            <div className="fc-acoes-in">
              {estado}
              <div className="fc-bts">
                {fase === 'feito' ? (
                  <>
                    <button type="button" className="fc-bt s" onClick={voltar}>Lista</button>
                    {proximo
                      ? <button type="button" className="fc-bt p" onClick={() => abrir(proximo.id, { substituir: true })}>
                          Próximo sem foto <span aria-hidden="true">→</span>
                        </button>
                      : <button type="button" className="fc-bt p" onClick={voltar}>Concluir</button>}
                  </>
                ) : pronta ? (
                  <>
                    <BotaoArquivo camera classe="s" ocupado={ocupado} aoEscolher={escolher}>Tirar outra</BotaoArquivo>
                    <button type="button" className={'fc-bt p' + (ocupado ? ' ocupado' : '')} onClick={enviar} disabled={ocupado}>
                      {fase === 'enviando' ? <><span className="girando claro" /> Enviando…</>
                        : fase === 'salvando' ? <><span className="girando claro" /> Salvando…</>
                        : sel.foto ? 'Trocar a foto' : 'Enviar foto'}
                    </button>
                  </>
                ) : (
                  <>
                    <BotaoArquivo classe="s" ocupado={ocupado} aoEscolher={escolher}>
                      <Galeria /> Galeria
                    </BotaoArquivo>
                    <BotaoArquivo camera classe="p" ocupado={ocupado} aoEscolher={escolher}>
                      <Camera /> {sel.foto ? 'Nova foto' : 'Tirar foto'}
                    </BotaoArquivo>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Lista                                                               */
  /* ------------------------------------------------------------------ */
  const pct = itens.length ? Math.round((nCom / itens.length) * 100) : 0;
  return (
    <>
    <div className="fc fc-lista" aria-hidden={sel ? true : undefined}>
      <h1 className="fc-titulo">Fotos</h1>
      <p className="fc-sub">Escolha o item, tire a foto e envie. O próprio celular reduz a foto antes de subir — de uns 5 MB para uns 300 KB.</p>

      <div className="fc-progresso" aria-label={`${nCom} de ${itens.length} itens com foto`}>
        <div><b>{nCom}</b> de {itens.length} itens com foto</div>
        <div className="fc-barra"><i style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="fc-busca">
        <input type="search" value={busca} onChange={e => setBusca(e.target.value)}
               placeholder="Buscar item ou código" aria-label="Buscar item ou código"
               enterKeyHint="search" autoComplete="off" />
        {!termo && (
          <div className="fc-filtros" role="tablist">
            {[['sem', 'Sem foto', nSem], ['com', 'Com foto', nCom], ['todos', 'Todos', itens.length]].map(([k, rot, n]) => (
              <button key={k} type="button" role="tab" aria-selected={filtro === k}
                      className={filtro === k ? 'on' : undefined} onClick={() => setFiltro(k)}>
                {rot} <span>{n}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {visiveis.length === 0 ? (
        <p className="fc-nada">
          {termo ? <>Nenhum item encontrado para “{busca.trim()}”.</>
            : filtro === 'sem' ? 'Todos os itens já têm foto.' : 'Nenhum item aqui.'}
        </p>
      ) : visiveis.map(sec => (
        <section key={sec.slug} className="fc-sec">
          <h2>{sec.nome}</h2>
          <ul>
            {sec.itens.map(i => (
              <li key={i.id}>
                <button type="button" className="fc-linha" onClick={() => abrir(i.id)}>
                  <span className={'fc-thumb' + (i.foto ? '' : ' vazio')}>
                    {i.foto
                      ? <img src={`${urlBase}/${i.foto.caminho}`} alt="" loading="lazy"
                             style={{ objectPosition: `${i.foto.x * 100}% ${i.foto.y * 100}%` }} />
                      : <Camera />}
                  </span>
                  <span className="fc-txt">
                    <b>{i.nome}</b>
                    <small>{i.codigo ? `${i.codigo} · ` : ''}{i.foto ? 'com foto' : 'sem foto'}</small>
                  </span>
                  <span className="fc-seta" aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
    {telaItem}
    </>
  );
}
