'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { publicarTudo } from '@/app/admin/acoes';

export default function Publicador({ quantidade, alertas }) {
  const router = useRouter();
  const [pendente, comecar] = useTransition();
  const [nota, setNota] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [msg, setMsg] = useState(null);

  function publicar() {
    comecar(async () => {
      const r = await publicarTudo(nota);
      if (!r.ok) { setMsg({ tipo: 'risco', texto: r.erro }); return; }
      setMsg({
        tipo: r.falhas?.length ? 'mel' : 'info',
        texto: r.falhas?.length
          ? `Versão ${r.versao} publicada com ${r.publicados} itens. ${r.falhas.length} falharam: ${r.falhas.join('; ')}`
          : `Versão ${r.versao} publicada. ${r.publicados} itens no ar. O site já mostra os preços novos.`
      });
      setConfirmando(false);
      setNota('');
      router.refresh();
    });
  }

  return (
    <>
      {msg && <div className={`aviso-adm ${msg.tipo}`} style={{ marginTop: 18 }}>{msg.texto}</div>}

      {!confirmando ? (
        <div className="adm-acoes">
          <button className="bt p" onClick={() => setConfirmando(true)} disabled={pendente}>
            Publicar {quantidade} {quantidade === 1 ? 'item' : 'itens'}
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 20, padding: 18, background: 'var(--branco)', border: '1px solid var(--fio)', borderRadius: 5 }}>
          {alertas > 0 && (
            <div className="aviso-adm risco" style={{ marginBottom: 14 }}>
              <b>{alertas} {alertas === 1 ? 'preço tem' : 'preços têm'} variação acima de 30%.</b> Confira
              a lista acima antes de confirmar. Preço errado no ar é problema legal, não só comercial.
            </div>
          )}
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: 'var(--t40)', marginBottom: 6 }}>
            NOTA DESTA PUBLICAÇÃO (opcional)
          </label>
          <input
            className="campo" value={nota} onChange={e => setNota(e.target.value)}
            placeholder="Ex.: reajuste de setembro"
          />
          <div className="adm-acoes">
            <button className="bt p" onClick={publicar} disabled={pendente}>
              {pendente ? 'Publicando…' : 'Confirmar e colocar no ar'}
            </button>
            <button className="bt g" onClick={() => setConfirmando(false)} disabled={pendente}>
              Voltar e conferir
            </button>
          </div>
        </div>
      )}
    </>
  );
}
