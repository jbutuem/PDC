'use client';

import { Fragment, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { salvarSecao, alternarEsgotado } from '@/app/admin/acoes';
import FotoItem from './FotoItem';

const brl = c => (c / 100).toFixed(2).replace('.', ',');
const centavos = txt => {
  const n = Math.round(parseFloat(String(txt ?? '').replace(/\./g, '').replace(',', '.')) * 100);
  return Number.isFinite(n) && n > 0 ? n : null;
};
/** "Pão do Cambuí" -> "Cambuí". Os chips precisam caber numa célula estreita. */
const curto = nome => nome.replace(/^P[ãa]o (d[aoe]s? )?/i, '');
/** "Pão do Cambuí" -> "no Cambuí"; "Pão da Primavera" -> "na Primavera". */
const naLoja = nome => (/^P[ãa]o da /i.test(nome) ? 'na ' : 'no ') + curto(nome);

function autoAltura(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.max(34, el.scrollHeight) + 'px';
}

function estadoInicial(itens, lojas) {
  const v = {};
  itens.forEach(i => {
    v[`nome_${i.id}`] = i.nome;
    v[`desc_${i.id}`] = i.descricao ?? '';
    lojas.forEach(l => { v[`vende_${i.id}_${l.id}`] = !i.naoVende.includes(l.id); });
    i.variantes.forEach(x => {
      v[`preco_${x.id}`] = x.preco != null ? brl(x.preco) : '';
      lojas.forEach(l => { v[`pl_${x.id}_${l.id}`] = x.porLoja[l.id] != null ? brl(x.porLoja[l.id]) : ''; });
    });
  });
  return v;
}

export default function Editor({ secao, itens, grupos, lojas, mediaSecao, podeEditar, urlBase }) {
  const router = useRouter();
  const [pendente, comecar] = useTransition();
  const [msg, setMsg] = useState(null);
  const [erroFoto, setErroFoto] = useState(null);
  const [revisoes, setRevisoes] = useState({});
  const [revisando, setRevisando] = useState(false);
  const [filtro, setFiltro] = useState('todos');
  const [original] = useState(() => estadoInicial(itens, lojas));
  const [valores, setValores] = useState(original);
  // Painel "preço por loja" nasce aberto quando o item já tem exceção.
  const [abertos, setAbertos] = useState(() => new Set(
    itens.flatMap(i => i.variantes.filter(x => Object.keys(x.porLoja).length).map(x => x.id))
  ));

  const mudou = k => valores[k] !== original[k];
  const set = (k, v) => setValores(s => ({ ...s, [k]: v }));
  const nAlterados = Object.keys(valores).filter(mudou).length;

  const suspeito = txt => {
    if (!mediaSecao) return false;
    const n = centavos(txt);
    return n != null && Math.abs(n - mediaSecao) > mediaSecao * 0.4;
  };

  /** Onde este item difere entre lojas, no estado atual da tela (já com o que foi digitado). */
  const diferencas = i => {
    const fora = lojas.filter(l => !valores[`vende_${i.id}_${l.id}`]);
    const precoProprio = lojas.filter(l => i.variantes.some(x => {
      const p = centavos(valores[`pl_${x.id}_${l.id}`]);
      return p != null && p !== centavos(valores[`preco_${x.id}`]);
    }));
    return { fora, precoProprio, tem: fora.length > 0 || precoProprio.length > 0 };
  };

  const contagem = useMemo(() => ({
    todos: itens.length,
    diferentes: itens.filter(i => diferencas(i).tem).length,
    rascunho: itens.filter(i => i.status === 'rascunho').length
  }), [itens, valores]); // eslint-disable-line react-hooks/exhaustive-deps

  const passa = i => filtro === 'todos'
    || (filtro === 'diferentes' && diferencas(i).tem)
    || (filtro === 'rascunho' && i.status === 'rascunho');

  // Grupos na ordem do cardápio; itens sem grupo vão para "Outros".
  const blocos = useMemo(() => {
    const lista = grupos.map(g => ({ ...g, itens: itens.filter(i => i.grupo_id === g.id) }));
    const soltos = itens.filter(i => !grupos.some(g => g.id === i.grupo_id));
    if (soltos.length) lista.push({ id: 'soltos', nome: 'Outros', itens: soltos });
    return lista;
  }, [grupos, itens]);

  async function revisar() {
    setRevisando(true);
    setMsg(null);
    const textos = [];
    itens.forEach(i => {
      ['nome', 'desc'].forEach(campo => {
        const k = `${campo}_${i.id}`;
        if (valores[k]?.trim()) textos.push({ chave: k, campo: campo === 'nome' ? 'nome' : 'descrição', texto: valores[k] });
      });
    });
    try {
      const r = await fetch('/api/revisar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
      setMsg({ tipo: 'risco', texto: `Revisão indisponível: ${e.message}. Você pode salvar mesmo assim.` });
    }
    setRevisando(false);
  }

  const aceitar = k => { set(k, revisoes[k].sugerido); setRevisoes(r => { const n = { ...r }; delete n[k]; return n; }); };
  const recusar = k => setRevisoes(r => { const n = { ...r }; delete n[k]; return n; });

  function salvar() {
    comecar(async () => {
      const fd = new FormData();
      itens.forEach(i => {
        fd.append('item_id', i.id);
        fd.append(`nome_${i.id}`, valores[`nome_${i.id}`]);
        fd.append(`desc_${i.id}`, valores[`desc_${i.id}`]);
        lojas.forEach(l => fd.append(`vende_${i.id}_${l.id}`, valores[`vende_${i.id}_${l.id}`] ? '1' : '0'));
        i.variantes.forEach(x => {
          fd.append(`preco_${x.id}`, valores[`preco_${x.id}`]);
          lojas.forEach(l => fd.append(`pl_${x.id}_${l.id}`, valores[`pl_${x.id}_${l.id}`] ?? ''));
        });
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
    comecar(async () => { await alternarEsgotado(id, valor); router.refresh(); });
  }

  function alternarPainel(vid) {
    setAbertos(s => { const n = new Set(s); n.has(vid) ? n.delete(vid) : n.add(vid); return n; });
  }

  const colunas = 6;

  return (
    <>
      {msg && <div className={`aviso-adm ${msg.tipo}`}>{msg.texto}</div>}

      {erroFoto && (
        <div className="aviso-adm risco" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span><b>A foto de "{erroFoto.item}" não subiu.</b><br />{erroFoto.texto}</span>
          <button className="bt g mini" style={{ marginLeft: 'auto', flex: '0 0 auto' }}
                  onClick={() => navigator.clipboard?.writeText(erroFoto.texto)}>copiar mensagem</button>
          <button className="bt g mini" style={{ flex: '0 0 auto' }} onClick={() => setErroFoto(null)}>fechar</button>
        </div>
      )}

      {lojas.length > 1 && (
        <div className="lojas-explica">
          <b>Um cardápio, {lojas.length} lojas.</b> Todo item vale {lojas.length === 2 ? 'nas duas' : 'em todas'} com o mesmo preço, a não ser que
          você marque o contrário. Clique no nome da loja para tirar o item dela; use{' '}
          <em>preço por loja</em> quando uma casa cobrar diferente. Deixe o campo da loja vazio para ela seguir o preço base.
        </div>
      )}

      <div className="filtros" role="tablist" aria-label="Filtrar itens">
        {[['todos', 'Todos'], ['diferentes', 'Diferem entre lojas'], ['rascunho', 'Em rascunho']].map(([k, rot]) => (
          <button key={k} role="tab" aria-selected={filtro === k} className={filtro === k ? 'on' : undefined}
                  onClick={() => setFiltro(k)} disabled={k !== 'todos' && contagem[k] === 0}>
            {rot} <span>{contagem[k]}</span>
          </button>
        ))}
        {mediaSecao && (
          <span className="legenda-tab">
            <span className="ex mel">amarelo</span> alterado, não salvo · <span className="ex rosa">rosa</span> preço 40% fora da média
          </span>
        )}
      </div>

      <table className="adm-tab">
        <thead>
          <tr>
            <th style={{ width: 84 }}>Foto</th>
            <th>Item</th>
            <th style={{ width: 70 }}>Código</th>
            <th style={{ width: 190, textAlign: 'right' }}>Preço</th>
            {lojas.length > 1 && <th style={{ width: 176 }}>Vende em</th>}
            <th style={{ width: 130 }}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {blocos.map(b => {
            const visiveis = b.itens.filter(passa);
            if (!visiveis.length) return null;
            return (
              <Fragment key={b.id}>
                <tr className="grupo-linha">
                  <td colSpan={colunas}>{b.nome}{b.nota ? <span> · {b.nota}</span> : null}</td>
                </tr>
                {visiveis.map(i => {
                  const dif = diferencas(i);
                  return (
                    <tr key={i.id} className={dif.tem ? 'excecao' : undefined}>
                      <td>
                        <FotoItem item={i} urlBase={urlBase} podeEditar={podeEditar}
                                  aoFalhar={m => setErroFoto({ item: i.nome, texto: m })} />
                      </td>
                      <td>
                        <input className="campo" value={valores[`nome_${i.id}`]} disabled={!podeEditar}
                               aria-label="Nome do item"
                               onChange={e => set(`nome_${i.id}`, e.target.value)}
                               style={mudou(`nome_${i.id}`) ? { borderColor: 'var(--mel)', background: '#FFF8EC' } : undefined} />
                        <textarea className="campo desc-auto" rows={1} placeholder="Ingredientes, gramatura…"
                                  aria-label="Descrição do item"
                                  value={valores[`desc_${i.id}`]} disabled={!podeEditar}
                                  onChange={e => { set(`desc_${i.id}`, e.target.value); autoAltura(e.target); }}
                                  ref={el => autoAltura(el)}
                                  style={mudou(`desc_${i.id}`) ? { borderColor: 'var(--mel)', background: '#FFF8EC' } : undefined} />
                        {dif.tem && (
                          <div className="dif-resumo">
                            {dif.fora.length > 0 && <span>não vende {dif.fora.map(l => naLoja(l.nome)).join(' nem ')}</span>}
                            {dif.precoProprio.length > 0 && <span>preço próprio {dif.precoProprio.map(l => naLoja(l.nome)).join(' e ')}</span>}
                          </div>
                        )}
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

                      <td className="celula-preco">
                        {i.variantes.map(v => {
                          const aberto = abertos.has(v.id);
                          const base = valores[`preco_${v.id}`];
                          return (
                            <div className="variante" key={v.id}>
                              {v.rotulo !== 'unica' && <div className="rot-var">{v.rotulo}</div>}
                              <input
                                className={`pin${mudou(`preco_${v.id}`) ? ' mudou' : ''}${suspeito(base) ? ' suspeito' : ''}`}
                                value={base} disabled={!podeEditar} inputMode="decimal"
                                aria-label={`Preço base${v.rotulo !== 'unica' ? ' ' + v.rotulo : ''}`}
                                onChange={e => set(`preco_${v.id}`, e.target.value)}
                              />
                              {mudou(`preco_${v.id}`) && <span className="era">{original[`preco_${v.id}`]}</span>}

                              {lojas.length > 1 && (
                                <>
                                  <button type="button" className={`por-loja${aberto ? ' on' : ''}`}
                                          onClick={() => alternarPainel(v.id)} aria-expanded={aberto}>
                                    {aberto ? 'preço por loja' : 'preço por loja'}
                                  </button>
                                  {aberto && (
                                    <div className="precos-loja">
                                      {lojas.map(l => {
                                        const k = `pl_${v.id}_${l.id}`;
                                        const proprio = centavos(valores[k]);
                                        const difere = proprio != null && proprio !== centavos(base);
                                        return (
                                          <label key={l.id} className={difere ? 'difere' : undefined}>
                                            <span>{curto(l.nome)}</span>
                                            <input className={`pin${mudou(k) ? ' mudou' : ''}`} inputMode="decimal"
                                                   value={valores[k]} disabled={!podeEditar}
                                                   placeholder={base ? `= ${base}` : 'base'}
                                                   onChange={e => set(k, e.target.value)} />
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}
                      </td>

                      {lojas.length > 1 && (
                        <td>
                          <div className="chips-loja">
                            {lojas.map(l => {
                              const k = `vende_${i.id}_${l.id}`;
                              const vende = valores[k];
                              return (
                                <button key={l.id} type="button" role="switch" aria-checked={vende}
                                        disabled={!podeEditar}
                                        className={`chip-loja${vende ? ' on' : ''}${mudou(k) ? ' mudou' : ''}`}
                                        title={vende ? `Vende no ${l.nome}. Clique para tirar desta loja.` : `Não vende no ${l.nome}. Clique para voltar a vender.`}
                                        onClick={() => set(k, !vende)}>
                                  {curto(l.nome)}
                                </button>
                              );
                            })}
                          </div>
                          {dif.fora.length === lojas.length && <div className="alerta-mini">Fora de todas as lojas: o item some do cardápio.</div>}
                        </td>
                      )}

                      <td>
                        <div className="estado">
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {i.tags?.includes('vegetariano') && <span className="tag veg">VEG</span>}
                            {i.status === 'rascunho' && <span className="tag rasc">RASCUNHO</span>}
                          </div>
                          {podeEditar && (
                            <button className={`bt mini ${i.esgotado ? 'd' : 'g'}`} type="button"
                                    onClick={() => esgotar(i.id, !i.esgotado)}>
                              {i.esgotado ? 'Esgotado' : 'Marcar esgotado'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
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
