'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { salvarLoja } from './acoes';

const hm = t => (t ? t.slice(0, 5) : '');
const telefone = url => {
  const d = (url ?? '').replace(/\D/g, '').replace(/^55/, '');
  if (d.length < 10) return url ?? '';
  return `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}`;
};

export default function Formulario({ loja, podeEditar }) {
  const router = useRouter();
  const [pendente, comecar] = useTransition();
  const [msg, setMsg] = useState(null);
  const [c, setC] = useState({
    endereco: loja.endereco ?? '', whatsapp: telefone(loja.whatsapp), site: loja.site ?? '',
    instagram: loja.instagram ?? '', facebook: loja.facebook ?? '', abre: hm(loja.abre), fecha: hm(loja.fecha)
  });
  const campo = (k, rot, extra = {}) => (
    <label>{rot}
      <input value={c[k]} disabled={!podeEditar} onChange={e => setC({ ...c, [k]: e.target.value })} {...extra} />
    </label>
  );

  return (
    <section className="vit-bloco">
      <h2>{loja.nome} <span className="loja-slug">/{loja.slug}</span></h2>
      <p className="s">
        Endereço do cardápio: <a href={`/${loja.slug}`} target="_blank" rel="noreferrer">/{loja.slug} ↗</a>
        {' '}— é para este endereço que o QR code das mesas deve apontar.
      </p>
      {msg && <div className={`aviso-adm ${msg.tipo}`}>{msg.texto}</div>}
      <div className="vit-linha">
        {campo('abre', 'Abre às', { type: 'time' })}
        {campo('fecha', 'Fecha às', { type: 'time' })}
        {campo('whatsapp', 'WhatsApp', { placeholder: '(19) 99999-1234', inputMode: 'tel' })}
      </div>
      {campo('endereco', 'Endereço', { placeholder: 'Rua, número — bairro, Campinas/SP' })}
      <div className="vit-linha">
        {campo('site', 'Site')}
        {campo('instagram', 'Instagram', { placeholder: 'sem @' })}
        {campo('facebook', 'Facebook')}
      </div>
      {podeEditar ? (
        <div className="adm-acoes">
          <button className="bt p" disabled={pendente} onClick={() => comecar(async () => {
            setMsg(null);
            try { await salvarLoja(loja.id, c); setMsg({ tipo: 'info', texto: 'Salvo. O cardápio da loja já foi atualizado.' }); router.refresh(); }
            catch (e) { setMsg({ tipo: 'risco', texto: e.message }); }
          })}>{pendente ? 'Salvando…' : 'Salvar loja'}</button>
        </div>
      ) : <p className="s">Só a agência e o administrador editam estes dados.</p>}
    </section>
  );
}
