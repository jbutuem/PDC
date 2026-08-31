import { NextResponse } from 'next/server';
import { supabaseServidor } from '@/lib/auth';

/** Destino do magic link. Troca o código pela sessão e manda para o admin. */
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const proximo = url.searchParams.get('proximo') ?? '/admin';

  if (code) {
    const sb = await supabaseServidor();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(proximo, url.origin));
  }

  return NextResponse.redirect(new URL('/admin/login?erro=link', url.origin));
}
