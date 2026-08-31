'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { registrarImagem, moverFoco, apagarImagem } from './acoes';
import { prepararImagem } from '@/lib/imagem';

const SPEC = {
  produto: {
    rot: 'Produto', prop: 'quadrada 1:1', min: '800 × 800 px',
    dica: 'Miniatura na linha do item e na vitrine de pizzas.'
  },
  destaque: {
    rot: 'Destaque', prop: 'envie em 3:2 (paisagem)', min: '1800 × 1200 px',
    dica: 'Bloco que rompe a margem. O desktop recorta uma faixa 2,4:1 do meio — deixe ar em cima e embaixo.'
  },
  hero: {
    rot: 'Hero', prop: 'envie em 4:5 (retrato)', min: '2400 × 3000 px',
    dica: 'O celular usa a imagem inteira em retrato; o desktop recorta uma faixa 2,6:1 do meio. Por isso ela precisa ser alta, não larga.'
  },
  promo: {
    rot: 'Promoção', prop: '4:3 (paisagem)', min: '1200 × 900 px',
    dica: 'Card da faixa "Esta semana". O texto entra sobre a metade de baixo — deixe essa área limpa.'
  }
};

export default function Gerenciador({ imagens, itens, urlBase, podeEditar }) {
  const router = useRouter();
  const [pendente, comecar] = useTransition();
  const [papel, setPapel] = useState('produto');
  const [itemId, setItemId] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState(null);
  const arquivo = useRef(null);

  const spec = SPEC[papel];

  async function enviar(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setEnviando(true);
    setMsg(null);

    try {
      const pronta = await prepararImagem(f, papel);

      const sb = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      const caminho = `${papel}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await sb.storage.from('menu')
        .upload(caminho, pronta.blob, { cacheControl: '31536000', contentType: 'image/jpeg' });
      if (error) throw new Error(error.message);

      await registrarImagem({
        storage_path: caminho, papel, item_id: itemId || null,
        largura: pronta.largura, altura: pronta.altura,
        alt: pronta.nome.replace(/\.[^.]+$/, '')
      });

      setMsg(pronta.aviso
        ? { tipo: 'mel', texto: pronta.aviso }
        : { tipo: 'info', texto: 'Imagem enviada. Clique sobre ela para marcar o ponto de foco.' });
      setItemId('');
      router.refresh();
    } catch (err) {
      setMsg({ tipo: 'risco', texto: err.message });
    }
    setEnviando(false);
    if (arquivo.current) arquivo.current.value = '';
  }

  function focar(e, id) {
    if (!podeEditar) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    comecar(async () => {
      await moverFoco(id, +x.toFixed(2), +y.toFixed(2));
      router.refresh();
    });
  }

  function remover(id, caminho) {
    comecar(async () => {
      await apagarImagem(id, caminho);
      router.refresh();
    });
  }

  const porPapel = p => imagens.filter(i => i.papel === p);

  return (
    <>
      {msg && <div className={`aviso-adm ${msg.tipo}`}>{msg.texto}</div>}

      {podeEditar && (
        <div style={{ background: 'var(--branco)', border: '1px solid var(--fio)', borderRadius: 5, padding: 16, marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--t40)', marginBottom: 6 }}>
                PAPEL DA IMAGEM
              </label>
              <select className="campo" value={papel} onChange={e => setPapel(e.target.value)} style={{ width: 190 }}>
                {Object.entries(SPEC).map(([k, v]) => <option key={k} value={k}>{v.rot}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--t40)', marginBottom: 6 }}>
                VINCULAR A UM ITEM (opcional)
              </label>
              <select className="campo" value={itemId} onChange={e => setItemId(e.target.value)}>
                <option value="">Nenhum — imagem avulsa</option>
                {itens.map(i => (
                  <option key={i.id} value={i.id}>{i.codigo_pdv} — {i.nome}</option>
                ))}
              </select>
            </div>
            <button className="bt p" onClick={() => arquivo.current?.click()} disabled={enviando}>
              {enviando ? 'Enviando…' : 'Escolher arquivo'}
            </button>
            <input ref={arquivo} type="file" accept="image/*" hidden onChange={enviar} />
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--t70)', marginTop: 11, marginBottom: 0 }}>
            <b>{spec.rot}:</b> {spec.prop} · mínimo {spec.min}. {spec.dica}{' '}
            O recorte para cada proporção sai do ponto de foco — não recorte nada à mão.
          </p>
        </div>
      )}

      {Object.entries(SPEC).map(([k, v]) => {
        const lista = porPapel(k);
        return (
          <section key={k} style={{ marginBottom: 30 }}>
            <h2 style={{ fontFamily: 'Fraunces,serif', fontSize: 19, fontWeight: 600, margin: '0 0 4px' }}>
              {v.rot} <span style={{ fontFamily: 'Archivo,sans-serif', fontSize: 12, color: 'var(--t40)', fontWeight: 600 }}>{lista.length}</span>
            </h2>
            <p style={{ fontSize: 12.5, color: 'var(--t70)', margin: '0 0 10px' }}>{v.dica}</p>
            {lista.length === 0
              ? <div className="img-vazio">Nenhuma imagem com este papel. O cardápio mostra a área reservada no lugar.</div>
              : (
                <div className="img-grade">
                  {lista.map(im => (
                    <div className="img-item" key={im.id}>
                      <div className="prev" onClick={e => focar(e, im.id)} title={podeEditar ? 'Clique para marcar o ponto de foco' : ''}>
                        <img src={`${urlBase}/${im.storage_path}`} alt={im.alt ?? ''} />
                        <div className="alvo" style={{ left: `${im.foco_x * 100}%`, top: `${im.foco_y * 100}%` }} />
                      </div>
                      <div className="info">
                        <b>{im.itens?.nome ?? 'Sem vínculo'}</b>
                        <span>
                          {im.largura}×{im.altura}
                          {im.itens?.codigo_pdv && ` · ${im.itens.codigo_pdv}`}
                          {' · foco '}{Math.round(im.foco_x * 100)}/{Math.round(im.foco_y * 100)}
                        </span>
                        {podeEditar && (
                          <button className="bt g mini" style={{ marginTop: 7 }} disabled={pendente}
                                  onClick={() => remover(im.id, im.storage_path)}>
                            Remover
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </section>
        );
      })}
    </>
  );
}
