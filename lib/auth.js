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
 * Devolve { user, membro, tenant, sb } ou null se não estiver logado.
 *
 * `sb` é o cliente com a SESSÃO do usuário — sujeito ao RLS. É ele que as
 * páginas devem usar. A service_role fica reservada para o que o RLS não
 * consegue fazer (listar e-mails em auth.users), e nada mais.
 *
 * O motivo é defesa em profundidade: se eu esquecer um `.eq('tenant_id', …)`
 * numa consulta, o RLS ainda barra. Com service_role em toda página, um
 * esquecimento vira vazamento.
 */
export async function sessaoAtual() {
  const sb = await supabaseServidor();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: membro } = await sb
    .from('membros')
    .select('id, papel, nome, tenant_id, tenants ( id, slug, nome )')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membro) return { user, membro: null, tenant: null, sb };
  return { user, membro, tenant: membro.tenants, sb };
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
