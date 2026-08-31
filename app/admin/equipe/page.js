import { sessaoAtual, supabaseAdmin } from '@/lib/auth';
import Tabela from './Tabela';

export const dynamic = 'force-dynamic';

export default async function PaginaEquipe() {
  const s = await sessaoAtual();
  if (!s?.membro) return <div className="adm-wrap"><div className="aviso-adm mel">Sem acesso.</div></div>;

  const { data: membros } = await s.sb
    .from('membros').select('id, user_id, nome, papel')
    .eq('tenant_id', s.membro.tenant_id).order('criado_em');

  // auth.users não é acessível por RLS: é o único lugar onde a service_role
  // é realmente necessária, e só para mostrar o e-mail de cada membro.
  let email = {};
  try {
    const { data: { users } = { users: [] } } = await supabaseAdmin().auth.admin.listUsers();
    email = Object.fromEntries((users ?? []).map(u => [u.id, u.email]));
  } catch {
    email = {};
  }

  const lista = (membros ?? []).map(m => ({ ...m, email: email[m.user_id] ?? '—' }));
  const meu = lista.find(m => m.user_id === s.user.id);

  return (
    <div className="adm-wrap">
      <div className="adm-cab"><h1>Equipe</h1></div>
      <p className="adm-sub">
        Quem se cadastra entra como <b>Visitante</b> e precisa ser promovido aqui.
        Comece restritivo: é fácil promover, é constrangedor rebaixar.
      </p>

      <div className="aviso-adm info">
        <b>Para adicionar alguém:</b> peça que a pessoa entre em{' '}
        <code>/admin/login</code> com o e-mail dela. A conta aparece nesta lista
        e você define o papel.
      </div>

      <Tabela membros={lista} souOwner={s.membro.papel === 'owner'} meuId={meu?.id} />
    </div>
  );
}
