'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useState } from 'react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setEstado(null);

    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    });

    setEnviando(false);
    setEstado(error
      ? { tipo: 'erro', texto: error.message }
      : { tipo: 'ok', texto: 'Link enviado. Abra seu e-mail e clique para entrar. O link vale por uma hora.' });
  }

  return (
    <div className="login">
      <div className="caixa">
        <h1>Cardápio<br />Pão da Primavera</h1>
        <p className="sub">Entre com seu e-mail. Enviamos um link — não existe senha para esquecer.</p>

        <form onSubmit={enviar}>
          <label htmlFor="email">SEU E-MAIL</label>
          <input
            id="email" type="email" required autoComplete="email"
            placeholder="voce@agencia.com.br"
            value={email} onChange={e => setEmail(e.target.value)}
          />
          <button className="bt p" type="submit" disabled={enviando || !email.trim()}>
            {enviando ? 'Enviando…' : 'Receber link de acesso'}
          </button>
        </form>

        {estado && <div className={`msg ${estado.tipo}`}>{estado.texto}</div>}
      </div>
    </div>
  );
}
