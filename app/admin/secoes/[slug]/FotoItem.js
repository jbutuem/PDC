'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { registrarImagem, apagarImagem, moverFoco } from '@/app/admin/imagens/acoes';
import { prepararImagem, formatarTamanho } from '@/lib/imagem';

/**
 * Foto do item, editável na própria linha da tabela.
 * Antes isto só existia na tela de Imagens, o que obrigava a pessoa a sair
 * do lugar onde estava trabalhando para subir uma foto.
 */
const ROTULO = {
  preparando: 'Preparando…',
  enviando: 'Enviando…',
  salvando: 'Salvando…'
};

/** Mensagens do Storage vêm em inglês; aqui viram algo acionável. */
function traduzir(msg = '') {
  if (/exceeded the maximum allowed size/i.test(msg))
    return 'A imagem ficou grande demais mesmo depois de reduzida. Tente uma foto menor.';
  if (/mime type/i.test(msg))
    return 'Formato não aceito. Envie JPEG ou PNG.';
  if (/already exists/i.test(msg))
    return 'Já existe um arquivo com esse nome. Tente de novo.';
  return msg;
}

export default function FotoItem({ item, urlBase, podeEditar, aoFalhar }) {
  const router = useRouter();
  const arquivo = useRef(null);
  const [ocupado, setOcupado] = useState(false);
  const [passo, setPasso] = useState('');
  const [erro, setErro] = useState(null);

  const foto = item.imagem;

  async function enviar(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setOcupado(true);
    setErro(null);

    try {
      setPasso('preparando');
      const pronta = await prepararImagem(f, 'produto');

      setPasso('enviando');
      const sb = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      const caminho = `produto/${item.codigo_pdv}-${Date.now()}.jpg`;
      const { error } = await sb.storage.from('menu')
        .upload(caminho, pronta.blob, { cacheControl: '31536000', contentType: 'image/jpeg' });
      if (error) throw new Error(traduzir(error.message));

      if (foto) await apagarImagem(foto.id, foto.storage_path);

      setPasso('salvando');
      await registrarImagem({
        storage_path: caminho, papel: 'produto', item_id: item.id,
        largura: pronta.largura, altura: pronta.altura, alt: item.nome
      });

      if (pronta.aviso) setErro(pronta.aviso);
      router.refresh();
    } catch (err) {
      setErro(err.message);
      aoFalhar?.(err.message);
    }
    setOcupado(false);
    setPasso('');
    if (arquivo.current) arquivo.current.value = '';
  }

  function focar(e) {
    if (!podeEditar || !foto) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    moverFoco(foto.id, +x.toFixed(2), +y.toFixed(2)).then(() => router.refresh());
  }

  function remover() {
    if (!foto) return;
    setOcupado(true);
    apagarImagem(foto.id, foto.storage_path)
      .then(() => router.refresh())
      .finally(() => setOcupado(false));
  }

  return (
    <div className="foto-cel">
      {foto ? (
        <>
          <div className="foto-mini" onClick={focar}
               title={podeEditar ? 'Clique sobre o produto para ajustar o corte' : ''}>
            <img src={`${urlBase}/${foto.storage_path}`} alt="" />
            <span className="alvo" style={{ left: `${foto.foco_x * 100}%`, top: `${foto.foco_y * 100}%` }} />
          </div>
          {podeEditar && (
            <div className="foto-bts">
              <button type="button" onClick={() => arquivo.current?.click()} disabled={ocupado}>trocar</button>
              <button type="button" onClick={remover} disabled={ocupado}>remover</button>
            </div>
          )}
        </>
      ) : (
        <button type="button" className={'foto-vazia' + (ocupado ? ' ocupada' : '')}
                disabled={!podeEditar || ocupado}
                onClick={() => arquivo.current?.click()}>
          {ocupado ? <span className="girando" /> : '+ foto'}
        </button>
      )}
      <input ref={arquivo} type="file" accept="image/*" hidden onChange={enviar} />
      {ocupado && <span className="foto-passo">{ROTULO[passo] ?? 'Enviando…'}</span>}
      {erro && !ocupado && <span className="foto-erro">{erro}</span>}
    </div>
  );
}
