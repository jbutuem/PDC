'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { salvarSecao, alternarEsgotado } from '@/app/admin/acoes';
import FotoItem from './FotoItem';

const brl = c => (c / 100).toFixed(2).replace('.', ',');

/** Textarea que cresce com o conteúdo: quase toda descrição cabe em uma linha. */
function autoAltura(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.max(34, el.scrollHeight) + 'px';
}

export default function Editor({ secao, itens, mediaSecao, podeEditar, urlBase }) {
  const router = useRouter();
  const [pendente, comecar] = useTransition();
  const [msg, setMsg] = useState(null);
  const [revisoes, setRevisoes] = useState({});
  const [revisando, setRevisando] = useState(false);
  const [valores, setValores] = useState(() => {
    const v = {};
    itens.forEach(i => {
      v[`nome_${i.id}`] = i.nome;
      v[`desc_${i.id}`] = i.descricao ?? '';
      i.variantes.forEach(x => { v[`preco_${x.id}`] = x.preco != null ? brl(x.preco) : ''; });
    });
    return v;
  });

  const original = useState(() => {
    const v = {};
    itens.forEach(i => {
      v[`nome_${i.id}`] = i.nome;
      v[`desc_${i.id}`] = i.descricao ?? '';
      i.variantes.forEach(x => { v[`preco_${x.id}`] = x.preco != null ? brl(x.preco) : ''; });
    });
    return v;
  })[0];

  const mudou = k => valores[k] !== original[k];
  const set = (k, v) => setValores(s => ({ ...s, [k]: v }));

  const suspeito = txt => {
    if (!mediaSecao) return false;
    const n = Math.round(parseFloat(String(txt).replace(/\./g, '').replace(',', '.')) * 100);
    if (!Number.isFinite(n) || n <= 0) return false;
    return Math.abs(n - mediaSecao) > mediaSecao * 0.4;
  };

  const nAlterados = Object.keys(valores).filter(mudou).length;

  async function revisar() {
    setRevisando(true);
    setMsg(null);
    const textos = [];
    itens.forEach(i => {
      ['nome', 'desc'].forEach(campo => {
        const k = `${campo}_${i.id}`;
        if (valores[k]?.trim()) {
          textos.push({ chave: k, campo: campo === 'nome' ? 'nome' : 'descrição', texto: valores[k] });
        }
      });
    });

    try {
      const r = await fetch('/api/revisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secao: secao.nome, textos })
      });
      const dados = await r.json();
      if (!r.ok) throw new Error(dados.erro ?? 'Falha na revisão.');

      const mapa = {};
      (dados.revisoes ?? []).forEach(rv => { if (rv.mudou) mapa[rv.chave] = rv; });
      setRevisoes(mapa);
      const n = Object.keys(mapa).length;
      setMsg({ tipo: n ? 'mel' : 'info',
        texto: n ? `${n} ${n === 1 ? 'sugestão' : 'sugestões'} de correção abaixo. Nada foi aplicado ainda.`
                 : 'Nenhuma correção sugerida. Os textos estão dentro do padrão da marca.' });
    } catch (e) {
      setMsg({ tipo: 'risco', texto: `Revisão indisponível: ${e.message}. Você pode salvar mesmo assim — o texto ficará marcado como não revisado.` });
    }
    setRevisando(false);
  }

  function aceitar(chave) {
    set(chave, revisoes[chave].sugerido);
    setRevisoes(r => { const n = { ...r }; delete n[chave]; return n; });
  }
  function recusar(chave) {
    setRevisoes(r => { const n = { ...r }; delete n[chave]; return n; });
  }

  function salvar() {
    comecar(async () => {
      const fd = new FormData();
      itens.forEach(i => {
        fd.append('item_id', i.id);
        fd.append(`nome_${i.id}`, valores[`nome_${i.id}`]);
        fd.append(`desc_${i.id}`, valores[`desc_${i.id}`]);
        i.variantes.forEach(x => fd.append(`preco_${x.id}`, valores[`preco_${x.id}`]));
      });
      try {
        const r = await salvarSecao(fd);
        setMsg({ tipo: 'info', texto: `Salvo. ${r.alteracoes} ${r.alteracoes === 1 ? 'alteração gravada' : 'alterações gravadas'} como rascunho. Vá em Publicar para colocar no ar.` });
        router.refresh();
      } catch (e) {
        setMsg({ tipo: 'risco', texto: e.message });
      }
    });
  }

  function esgotar(id, valor) {
    comecar(async () => {
      await alternarEsgotado(id, valor);
      router.refresh();
    });
  }

  return (
    <>
      {msg && <div className={`aviso-adm ${msg.tipo}`}>{msg.texto}</div>}

      {mediaSecao && (
        <p className="legenda-tab">
          Campo <span className="ex mel">amarelo</span> = alterado, ainda não salvo ·{' '}
          <span className="ex rosa">rosa</span> = preço mais de 40% fora da média desta seção,
          confira se não é dígito trocado
        </p>
      )}

      <table className="adm-tab">
        <thead>
          <tr>
            <th style={{ width: 84 }}>Foto</th>
            <th style={{ width: '44%' }}>Item</th>
            <th>Código</th>
            {itens[0]?.variantes.map(v => (
              <th key={v.id} style={{ textAlign: 'right' }}>{v.rotulo === 'unica' ? 'Preço' : v.rotulo}</th>
            ))}
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {itens.map(i => (
            <tr key={i.id}>
              <td>
                <FotoItem item={i} urlBase={urlBase} podeEditar={podeEditar} />
              </td>
              <td>
                <input
                  className="campo" value={valores[`nome_${i.id}`]} disabled={!podeEditar}
                  onChange={e => set(`nome_${i.id}`, e.target.value)}
                  style={mudou(`nome_${i.id}`) ? { borderColor: 'var(--mel)', background: '#FFF8EC' } : undefined}
                />
                <textarea
                  className="campo desc-auto" rows={1} placeholder="Ingredientes, gramatura…"
                  value={valores[`desc_${i.id}`]} disabled={!podeEditar}
                  onChange={e => { set(`desc_${i.id}`, e.target.value); autoAltura(e.target); }}
                  ref={el => autoAltura(el)}
                  style={mudou(`desc_${i.id}`) ? { borderColor: 'var(--mel)', background: '#FFF8EC' } : undefined}
                />
                {['nome', 'desc'].map(c => {
                  const k = `${c}_${i.id}`;
                  const rv = revisoes[k];
                  if (!rv) return null;
                  return (
                    <div className="rev" key={k}>
                      <div className="kick">{rv.tipo?.toUpperCase() ?? 'CORREÇÃO'}</div>
                      <div className="de">{rv.original}</div>
                      <div className="para">{rv.sugerido}</div>
                      {rv.motivo && <div className="msg">{rv.motivo}</div>}
                      <div className="bts">
                        <button className="bt p mini" type="button" onClick={() => aceitar(k)}>Aceitar</button>
                        <button className="bt g mini" type="button" onClick={() => recusar(k)}>Manter como está</button>
                      </div>
                    </div>
                  );
                })}
              </td>
              <td className="cod">{i.codigo_pdv}</td>
              {i.variantes.map(v => (
                <td key={v.id} style={{ textAlign: 'right' }}>
                  <input
                    className={`pin${mudou(`preco_${v.id}`) ? ' mudou' : ''}${suspeito(valores[`preco_${v.id}`]) ? ' suspeito' : ''}`}
                    value={valores[`preco_${v.id}`]} disabled={!podeEditar}
                    onChange={e => set(`preco_${v.id}`, e.target.value)}
                    inputMode="decimal"
                  />
                  {mudou(`preco_${v.id}`) && (
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--t40)', marginTop: 3, textDecoration: 'line-through' }}>
                      {original[`preco_${v.id}`]}
                    </span>
                  )}
                </td>
              ))}
              <td>
                <div className="estado">
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {i.tags?.includes('vegetariano') && <span className="tag veg">VEG</span>}
                    {i.status === 'rascunho' && <span className="tag rasc">RASCUNHO</span>}
                  </div>
                  {podeEditar && (
                    <button
                      className={`bt mini ${i.esgotado ? 'd' : 'g'}`} type="button"
                      onClick={() => esgotar(i.id, !i.esgotado)}
                    >
                      {i.esgotado ? 'Esgotado' : 'Marcar esgotado'}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {podeEditar && (
        <div className={`barra-salvar${nAlterados ? ' ativa' : ''}`}>
          <div className="in">
            <span className="estado-salvar">
              {nAlterados
                ? <><b>{nAlterados}</b> {nAlterados === 1 ? 'alteração não salva' : 'alterações não salvas'}</>
                : 'Nada alterado nesta seção'}
            </span>
            <button className="bt s" onClick={revisar} disabled={revisando}>
              {revisando ? 'Revisando…' : 'Revisar textos com IA'}
            </button>
            <button className="bt p" onClick={salvar} disabled={pendente || !nAlterados}>
              {pendente ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
