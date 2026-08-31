import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

/**
 * Renova a sessão a cada request e barra /admin para quem não está logado.
 * Sem isto, o cookie de sessão expira e o usuário é deslogado no meio do trabalho.
 */
export async function middleware(request) {
  let resposta = NextResponse.next({ request });

  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: lista => {
          lista.forEach(({ name, value }) => request.cookies.set(name, value));
          resposta = NextResponse.next({ request });
          lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
        }
      }
    }
  );

  const { data: { user } } = await sb.auth.getUser();
  const caminho = request.nextUrl.pathname;

  if (caminho.startsWith('/admin') && !caminho.startsWith('/admin/login') && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.searchParams.set('proximo', caminho);
    return NextResponse.redirect(url);
  }

  if (caminho === '/admin/login' && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return resposta;
}

export const config = {
  matcher: ['/admin/:path*']
};
