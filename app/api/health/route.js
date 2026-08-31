import { NextResponse } from 'next/server';
import { temBanco, clientePublico } from '@/lib/menu';

export const dynamic = 'force-dynamic';

/** Diagnóstico rápido do deploy. Abra /api/health depois de subir. */
export async function GET() {
  const estado = {
    app: 'ok',
    env: {
      NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      REVALIDATE_SECRET: Boolean(process.env.REVALIDATE_SECRET)
    },
    banco: 'não configurado',
    itensPublicados: null
  };

  if (temBanco) {
    try {
      const { count, error } = await clientePublico()
        .from('itens').select('*', { count: 'exact', head: true })
        .eq('status', 'publicado');
      estado.banco = error ? 'erro: ' + error.message : 'ok';
      estado.itensPublicados = count ?? null;
    } catch (e) {
      estado.banco = 'erro: ' + e.message;
    }
  }

  return NextResponse.json(estado);
}
