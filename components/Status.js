'use client';

import { useEffect, useState } from 'react';

/**
 * "Aberto agora" calculado no navegador, na hora de Campinas.
 * A página é estática (ISR): se isto fosse calculado no servidor, o site
 * diria "aberto" à meia-noite só porque foi gerado às 15h.
 */
const hm = t => (t ? t.slice(0, 5).replace(':00', 'h').replace(':', 'h') : '');

export default function Status({ abre, fecha }) {
  const [txt, setTxt] = useState(null);

  useEffect(() => {
    if (!abre || !fecha) return;
    const calcular = () => {
      const agora = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false
      }).format(new Date());
      const aberto = agora >= abre.slice(0, 5) && agora < fecha.slice(0, 5);
      setTxt(aberto
        ? { aberto: true, forte: 'Aberto agora', fraco: `até ${hm(fecha)}` }
        : { aberto: false, forte: 'Fechado', fraco: `abre às ${hm(abre)}` });
    };
    calcular();
    const t = setInterval(calcular, 60_000);
    return () => clearInterval(t);
  }, [abre, fecha]);

  if (!txt) return <span className="status" aria-hidden="true" />;
  return (
    <span className={`status${txt.aberto ? ' aberto' : ''}`}>
      <b>{txt.forte}</b> {txt.fraco}
    </span>
  );
}
