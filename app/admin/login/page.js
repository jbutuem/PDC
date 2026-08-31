'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function Formulario() {
  const router = useRouter();
  const params = useSearchParams();
  const proximo = params.get('proximo') ?? '/admin';

  const [modo, setModo] = useState('senha');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [estado, setEstado] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const cliente = () => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  async function entrarComSenha(e) {
    e.preventDefault();
    setOcupado(true);
    setEstado(null);

    const { error } = await cliente().auth.signInWithPassword({
      email: email.trim(), password: senha
    });

    if (error) {
      setOcupado(false);
      setEstado({
        tipo: 'erro',
        texto: error.message.includes('Invalid login')
          ? 'E-mail ou senha incorretos.'
          : error.message
      });
      return;
    }

    router.push(proximo);
    router.refresh();
  }

  async function enviarLink(e) {
    e.preventDefault();
    setOcupado(true);
    setEstado(null);

    const { error } = await cliente().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    });

    setOcupado(false);
    setEstado(error
      ? { tipo: 'erro', texto: error.message }
      : { tipo: 'ok', texto: 'Link enviado. Se ele levar para "localhost", falta configurar o Site URL no Supabase — use a senha por enquanto.' });
  }

  return (
    <div className="login">
      <div className="caixa">
        <h1>Cardápio<br />Pão da Primavera</h1>
        <p className="sub">
          {modo === 'senha' ? 'Entre com seu e-mail e senha.' : 'Enviamos um link de acesso por e-mail.'}
        </p>

        <form onSubmit={modo === 'senha' ? entrarComSenha : enviarLink}>
          <label htmlFor="email">E-MAIL</label>
          <input
            id="email" type="email" required autoComplete="email"
            placeholder="voce@agencia.com.br"
            value={email} onChange={e => setEmail(e.target.value)}
          />

          {modo === 'senha' && (
            <>
              <label htmlFor="senha" style={{ marginTop: 14 }}>SENHA</label>
              <input
                id="senha" type="password" required autoComplete="current-password"
                value={senha} onChange={e => setSenha(e.target.value)}
              />
            </>
          )}

          <button className="bt p" type="submit" disabled={ocupado || !email.trim()}>
            {ocupado ? 'Aguarde…' : modo === 'senha' ? 'Entrar' : 'Receber link por e-mail'}
          </button>
        </form>

        {estado && <div className={`msg ${estado.tipo}`}>{estado.texto}</div>}

        <button
          type="button"
          onClick={() => { setModo(m => (m === 'senha' ? 'link' : 'senha')); setEstado(null); }}
          style={{
            marginTop: 18, background: 'none', border: 0, padding: 0, cursor: 'pointer',
            fontSize: 13, color: 'var(--forno)', fontWeight: 600, textDecoration: 'underline'
          }}
        >
          {modo === 'senha' ? 'Prefiro receber um link por e-mail' : 'Prefiro entrar com senha'}
        </button>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div className="login"><div className="caixa">Carregando…</div></div>}>
      <Formulario />
    </Suspense>
  );
}
