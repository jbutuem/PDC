import { sessaoAtual, PODE_PUBLICAR } from '@/lib/auth';
import Formulario from './Formulario';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Lojas — Admin' };

export default async function Lojas() {
  const s = await sessaoAtual();
  if (!s?.membro) return <div className="adm-wrap"><div className="aviso-adm mel">Sem acesso.</div></div>;

  const { data: lojas } = await s.sb.from('lojas')
    .select('id, slug, nome, desde, site, instagram, facebook, whatsapp, endereco, mapa, abre, fecha')
    .eq('tenant_id', s.membro.tenant_id).order('ordem');

  return (
    <div className="adm-wrap">
      <div className="adm-cab"><h1>Lojas</h1></div>
      <p className="adm-sub">
        Contato e horário de cada casa. Aparecem no topo e no rodapé do cardápio de cada loja.
        O horário decide o aviso &quot;Aberto agora&quot; — confira antes de publicar.
      </p>
      {(lojas ?? []).map(l => (
        <Formulario key={l.id} loja={l} podeEditar={PODE_PUBLICAR.includes(s.membro.papel)} />
      ))}
    </div>
  );
}
