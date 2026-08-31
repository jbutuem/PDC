import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

/**
 * Chamado quando uma versão é publicada no admin.
 * Regenera o HTML estático do menu público.
 *
 *   curl -X POST "https://SEU-DOMINIO/api/revalidate?secret=..."
 */
export async function POST(request) {
  const segredo = new URL(request.url).searchParams.get('secret');

  if (!process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ erro: 'REVALIDATE_SECRET não configurado.' }, { status: 500 });
  }
  if (segredo !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ erro: 'Segredo inválido.' }, { status: 401 });
  }

  revalidatePath('/');
  return NextResponse.json({ ok: true, revalidado: '/', em: new Date().toISOString() });
}
