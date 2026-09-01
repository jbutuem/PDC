'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { salvarTextoHero } from '@/app/admin/imagens/acoes';
import { salvarComunicado, salvarPromocao, alternarPromocao } from './acoes';

const reais = c => (c == null ? '' : (c / 100).toFixed(2).replace('.', ','));

function Aviso({ msg }) {
  if (!msg) return null;
  return <div className={`aviso-adm ${msg.tipo}`}>{msg.texto}</div>;
}

export default function Editor({ hero, comunicado, promocoes, urlBase, podeEditar }) {
  const router = useRouter();
  const [msg, setMsg] = useState(null);
  const [salvando, setSalvando] = useState(null);

  const [h, setH] = useState({
    chamada: hero?.chamada ?? '',
    titulo: hero?.titulo ?? '',
    linha_apoio: hero?.linha_apoio ?? '',
    alt: hero?.alt ?? ''
  });
  const [c, setC] = useState({
    texto: comunicado?.texto ?? '',
    ativo: comunicado?.ativo ?? false
  });
  const [ps, setPs] = useState(() =>
    promocoes.map(p => ({
      ...p,
      preco_de: reais(p.preco_de_centavos),
      preco_por: reais(p.preco_por_centavos),
      chamada: p.chamada ?? '', selo: p.selo ?? '', observacao: p.observacao ?? ''
    })));

  async function correr(chave, fn) {
    setSalvando(chave); setMsg(null);
    try {
      await fn();
      setMsg({ tipo: 'info', texto: 'Salvo. A página pública já foi atualizada.' });
      router.refresh();
    } catch (e) {
      setMsg({ tipo: 'risco', texto: e.message });
    }
    setSalvando(null);
  }

  const mudarP = (i, campo, valor) =>
    setPs(l => l.map((p, k) => (k === i ? { ...p, [campo]: valor } : p)));

  return (
    <div className="adm-wrap">
      <div className="adm-cab"><h1>Vitrine</h1></div>
      <p className="adm-sub">
        O topo do site, o recado e as ofertas da semana. Tudo aqui aparece na hora
        para quem abrir o cardápio — não precisa passar pela publicação.
      </p>

      <Aviso msg={msg} />

      {/* ===== HERO ===== */}
      <section className="vit-bloco">
        <h2>Imagem do topo</h2>
        {hero ? (
          <div className="vit-hero">
            <div className="vit-previa">
              <img src={`${urlBase}/${hero.storage_path}`} alt="" />
              <div className="vit-previa-txt">
                <b>{h.chamada || 'DESDE 1999, NO CAMBUÍ'}</b>
                <strong>{h.titulo || 'Pão da Primavera'}</strong>
                <span>{h.linha_apoio}</span>
              </div>
            </div>
            <div className="vit-campos">
              <label>Chamada <i>etiqueta curta em cima do título</i>
                <input value={h.chamada} maxLength={40} disabled={!podeEditar}
                       onChange={e => setH({ ...h, chamada: e.target.value })} />
              </label>
              <label>Título
                <input value={h.titulo} maxLength={60} disabled={!podeEditar}
                       onChange={e => setH({ ...h, titulo: e.target.value })} />
              </label>
              <label>Linha de apoio
                <textarea rows={2} value={h.linha_apoio} maxLength={160} disabled={!podeEditar}
                          onChange={e => setH({ ...h, linha_apoio: e.target.value })} />
              </label>
              <label>Descrição da imagem <i>lida por leitores de tela e pelo Google</i>
                <input value={h.alt} maxLength={120} disabled={!podeEditar}
                       onChange={e => setH({ ...h, alt: e.target.value })} />
              </label>
              <div className="adm-acoes">
                <button className="bt p" disabled={!podeEditar || salvando === 'hero'}
                        onClick={() => correr('hero', () => salvarTextoHero(hero.id, h))}>
                  {salvando === 'hero' ? 'Salvando…' : 'Salvar topo'}
                </button>
                <Link className="bt s" href="/admin/imagens">Trocar a foto</Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="aviso-adm mel">
            Nenhuma imagem de hero cadastrada. Envie uma em <Link href="/admin/imagens">Imagens</Link>,
            com papel <b>Hero</b>, em paisagem e pelo menos 2400 px de largura.
          </div>
        )}
      </section>

      {/* ===== COMUNICADO ===== */}
      <section className="vit-bloco">
        <h2>Recado da casa</h2>
        <p className="s">
          Faixa amarela no alto do site. Serve para horário de feriado, falta de um
          produto, obra na rua. Deixe o texto vazio para tirá-la do ar.
        </p>
        <textarea rows={2} value={c.texto} maxLength={220} disabled={!podeEditar}
                  placeholder="Ex.: Feriado 7/9: abrimos das 7h às 14h."
                  onChange={e => setC({ ...c, texto: e.target.value })} />
        <label className="vit-check">
          <input type="checkbox" checked={c.ativo} disabled={!podeEditar}
                 onChange={e => setC({ ...c, ativo: e.target.checked })} />
          Mostrar no site
        </label>
        <div className="adm-acoes">
          <button className="bt p" disabled={!podeEditar || salvando === 'com'}
                  onClick={() => correr('com', () => salvarComunicado(c))}>
            {salvando === 'com' ? 'Salvando…' : 'Salvar recado'}
          </button>
        </div>
      </section>

      {/* ===== PROMOÇÕES ===== */}
      <section className="vit-bloco">
        <h2>Esta semana</h2>
        <p className="s">
          Os cards logo abaixo do topo. Deixe o preço <b>de</b> vazio quando não
          houver desconto — o card se ajusta sozinho.
        </p>

        {ps.length === 0 && <div className="aviso-adm info">Nenhuma promoção cadastrada.</div>}

        {ps.map((p, i) => (
          <div className={'vit-promo' + (p.ativo ? '' : ' off')} key={p.id}>
            <div className="vit-promo-foto">
              {p.imagens?.storage_path
                ? <img src={`${urlBase}/${p.imagens.storage_path}`} alt="" />
                : <span>sem foto</span>}
            </div>
            <div className="vit-promo-campos">
              <label>Título
                <input value={p.titulo} disabled={!podeEditar}
                       onChange={e => mudarP(i, 'titulo', e.target.value)} />
              </label>
              <label>Chamada
                <input value={p.chamada} disabled={!podeEditar}
                       onChange={e => mudarP(i, 'chamada', e.target.value)} />
              </label>
              <div className="vit-linha">
                <label>Selo
                  <input value={p.selo} maxLength={24} disabled={!podeEditar}
                         onChange={e => mudarP(i, 'selo', e.target.value)} />
                </label>
                <label>Cor do selo
                  <select value={p.tipo} disabled={!podeEditar}
                          onChange={e => mudarP(i, 'tipo', e.target.value)}>
                    <option value="oferta">Oferta (rosa)</option>
                    <option value="novo">Novidade (mel)</option>
                    <option value="tempo">Horário (claro)</option>
                  </select>
                </label>
                <label>De R$
                  <input value={p.preco_de} inputMode="decimal" placeholder="—" disabled={!podeEditar}
                         onChange={e => mudarP(i, 'preco_de', e.target.value)} />
                </label>
                <label>Por R$
                  <input value={p.preco_por} inputMode="decimal" disabled={!podeEditar}
                         onChange={e => mudarP(i, 'preco_por', e.target.value)} />
                </label>
                <label>Observação
                  <input value={p.observacao} maxLength={30} disabled={!podeEditar}
                         onChange={e => mudarP(i, 'observacao', e.target.value)} />
                </label>
              </div>
              <div className="adm-acoes">
                <button className="bt p" disabled={!podeEditar || salvando === p.id}
                        onClick={() => correr(p.id, () => salvarPromocao(p.id, p))}>
                  {salvando === p.id ? 'Salvando…' : 'Salvar'}
                </button>
                <button className="bt s" disabled={!podeEditar}
                        onClick={() => correr(p.id, async () => {
                          await alternarPromocao(p.id, !p.ativo);
                          mudarP(i, 'ativo', !p.ativo);
                        })}>
                  {p.ativo ? 'Tirar do ar' : 'Colocar no ar'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
