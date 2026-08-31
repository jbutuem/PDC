import './admin.css';
import Link from 'next/link';
import { sessaoAtual, ROTULO_PAPEL } from '@/lib/auth';
import Sair from './Sair';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Pão da Primavera', robots: { index: false } };

export default async function LayoutAdmin({ children }) {
  const s = await sessaoAtual();

  return (
    <div className="adm">
      {s?.user && (
        <header className="adm-barra">
          <Link href="/admin" className="logo">Pão da Primavera</Link>
          <nav>
            <Link href="/admin">Cardápio</Link>
            <Link href="/admin/imagens">Imagens</Link>
            <Link href="/admin/publicar">Publicar</Link>
            <Link href="/admin/equipe">Equipe</Link>
            <Link href="/" target="_blank">Ver o site ↗</Link>
          </nav>
          <div className="quem">
            {s.membro?.nome ?? s.user.email}
            <b>{ROTULO_PAPEL[s.membro?.papel] ?? 'SEM ACESSO'}</b>
            <Sair />
          </div>
        </header>
      )}
      {children}
    </div>
  );
}
