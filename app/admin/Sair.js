'use client';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export default function Sair() {
  const router = useRouter();
  async function sair() {
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    await sb.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  }
  return <button className="sair" onClick={sair}>Sair</button>;
}
