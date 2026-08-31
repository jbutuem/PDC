import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Cliente com a sessão do usuário logado. Respeita o RLS. */
export async function supabaseServidor() {
  const jar = await cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: lista => {
        try {
          lista.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          // Server Component não pode escrever cookie; o middleware cuida da renovação.
        }
      }
    }
  });
}

/**
 * Ignora o RLS. Use apenas quando a rota já verificou o papel por conta própria.
 * Nunca importe isto de um componente cliente.
 */
export function supabaseAdmin() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente.');
  return createClient(URL, chave, { auth: { persistSession: false } });
}

/**
 * Devolve { user, membro, tenant } ou null se não estiver logado.
 * É a função que todas as páginas do admin chamam primeiro.
 */
export async function sessaoAtual() {
  const sb = await supabaseServidor();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const admin = supabaseAdmin();
  const { data: membro } = await admin
    .from('membros')
    .select('papel, nome, tenant_id, tenants ( id, slug, nome )')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membro) return { user, membro: null, tenant: null };
  return { user, membro, tenant: membro.tenants };
}

export const PODE_EDITAR   = ['cliente_editor', 'agencia', 'owner'];
export const PODE_PUBLICAR = ['agencia', 'owner'];

export const ROTULO_PAPEL = {
  viewer: 'Visitante',
  operador: 'Balcão',
  cliente_editor: 'Cliente',
  agencia: 'Agência',
  owner: 'Administrador'
};
