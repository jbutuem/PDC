'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mudarPapel } from './acoes';

const PAPEIS = [
  ['viewer', 'Visitante — só olha'],
  ['operador', 'Balcão — marca esgotado'],
  ['cliente_editor', 'Cliente — edita rascunho'],
  ['agencia', 'Agência — edita e publica'],
  ['owner', 'Administrador — tudo']
];

export default function Tabela({ membros, souOwner, meuId }) {
  const router = useRouter();
  const [pendente, comecar] = useTransition();
  const [erro, setErro] = useState(null);

  function trocar(id, papel) {
    comecar(async () => {
      try { await mudarPapel(id, papel); router.refresh(); }
      catch (e) { setErro(e.message); }
    });
  }

  return (
    <>
      {erro && <div className="aviso-adm risco">{erro}</div>}
      <table className="adm-tab">
        <thead><tr><th>Pessoa</th><th>E-mail</th><th>Papel</th></tr></thead>
        <tbody>
          {membros.map(m => (
            <tr key={m.id}>
              <td><span className="nome">{m.nome ?? '—'}</span></td>
              <td style={{ fontSize: 13, color: 'var(--t70)' }}>{m.email}</td>
              <td>
                {souOwner && m.id !== meuId ? (
                  <select className="campo" style={{ width: 230 }} value={m.papel}
                          disabled={pendente} onChange={e => trocar(m.id, e.target.value)}>
                    {PAPEIS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                  </select>
                ) : (
                  <span>{PAPEIS.find(p => p[0] === m.papel)?.[1] ?? m.papel}
                    {m.id === meuId && <span style={{ color: 'var(--t40)' }}> (você)</span>}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
