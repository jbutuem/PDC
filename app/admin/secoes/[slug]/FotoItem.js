'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { registrarImagem, apagarImagem, moverFoco } from '@/app/admin/imagens/acoes';

/**
 * Foto do item, editável na própria linha da tabela.
 * Antes isto só existia na tela de Imagens, o que obrigava a pessoa a sair
 * do lugar onde estava trabalhando para subir uma foto.
 */
export default function FotoItem({ item, urlBase, podeEditar }) {
  const router = useRouter();
  const arquivo = useRef(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);

  const foto = item.imagem;

  async function enviar(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setOcupado(true);
    setErro(null);

    try {
      const img = await new Promise((ok, falha) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = () => falha(new Error('Arquivo não é uma imagem válida.'));
        i.src = URL.createObjectURL(f);
      });

      const sb = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      const ext = (f.name.split('.').pop() ?? 'jpg').toLowerCase();
      const caminho = `produto/${item.codigo_pdv}-${Date.now()}.${ext}`;

      const { error } = await sb.storage.from('menu')
        .upload(caminho, f, { cacheControl: '31536000', upsert: false });
      if (error) throw error;

      if (foto) await apagarImagem(foto.id, foto.storage_path);

      await registrarImagem({
        storage_path: caminho, papel: 'produto', item_id: item.id,
        largura: img.width, altura: img.height, alt: item.nome
      });

      if (Math.min(img.width, img.height) < 800) {
        setErro(`Enviada com ${img.width}×${img.height}. O ideal é pelo menos 800×800 — pode ficar borrada.`);
      }
      router.refresh();
    } catch (err) {
      setErro(err.message);
    }
    setOcupado(false);
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
        <button type="button" className="foto-vazia" disabled={!podeEditar || ocupado}
                onClick={() => arquivo.current?.click()}>
          {ocupado ? '…' : '+ foto'}
        </button>
      )}
      <input ref={arquivo} type="file" accept="image/*" hidden onChange={enviar} />
      {erro && <span className="foto-erro">{erro}</span>}
    </div>
  );
}
