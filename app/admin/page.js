import Link from 'next/link';
import { sessaoAtual, supabaseAdmin, PODE_EDITAR } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Painel() {
  const s = await sessaoAtual();

  if (!s?.membro) {
    return (
      <div className="adm-wrap">
        <div className="aviso-adm mel">
          <b>Sua conta existe, mas ainda não tem acesso a este cardápio.</b><br />
          Peça a um administrador para liberar em <b>Equipe</b>. Seu e-mail: <code>{s?.user?.email}</code>
        </div>
      </div>
    );
  }

  const podeEditar = PODE_EDITAR.includes(s.membro.papel);
  const sb = supabaseAdmin();

  const { data: secoes } = await sb
    .from('secoes')
    .select('slug, nome, subtitulo, itens ( id, status, esgotado )')
    .eq('tenant_id', s.membro.tenant_id)
    .order('ordem');

  const { data: rascunhos } = await sb
    .from('itens')
    .select('id', { count: 'exact', head: false })
    .eq('tenant_id', s.membro.tenant_id)
    .eq('status', 'rascunho');

  const { data: ultima } = await sb
    .from('versoes')
    .select('numero, publicada_em')
    .eq('tenant_id', s.membro.tenant_id)
    .eq('status', 'publicada')
    .order('publicada_em', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: semImagem } = await sb
    .from('itens')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', s.membro.tenant_id)
    .eq('status', 'publicado');

  const { count: comImagem } = await sb
    .from('imagens')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', s.membro.tenant_id);

  const totalItens = (secoes ?? []).reduce((n, x) => n + (x.itens?.length ?? 0), 0);
  const nRascunho = rascunhos?.length ?? 0;
  const esgotados = (secoes ?? []).flatMap(x => x.itens ?? []).filter(i => i.esgotado).length;

  return (
    <div className="adm-wrap">
      <div className="adm-cab">
        <h1>Cardápio</h1>
        {nRascunho > 0
          ? <span className="chip alerta">{nRascunho} {nRascunho === 1 ? 'alteração não publicada' : 'alterações não publicadas'}</span>
          : <span className="chip ok">Tudo publicado</span>}
        {esgotados > 0 && <span className="chip risco">{esgotados} esgotado{esgotados > 1 ? 's' : ''}</span>}
      </div>
      <p className="adm-sub">
        {totalItens} itens em {secoes?.length ?? 0} seções ·{' '}
        {ultima
          ? `última publicação: versão ${ultima.numero}, ${new Date(ultima.publicada_em).toLocaleString('pt-BR')}`
          : 'nenhuma publicação registrada ainda'}
      </p>

      {!podeEditar && (
        <div className="aviso-adm info">
          Seu papel é <b>somente leitura</b>. Você pode navegar, mas não salvar alterações.
        </div>
      )}

      {comImagem === 0 && (
        <div className="aviso-adm mel">
          <b>Nenhuma imagem cadastrada.</b> O cardápio está no ar mostrando as áreas
          reservadas em vez das fotos. Comece por <Link href="/admin/imagens"><b>Imagens</b></Link>.
        </div>
      )}

      <div className="adm-grade">
        {(secoes ?? []).map(sec => {
          const total = sec.itens?.length ?? 0;
          const pub = (sec.itens ?? []).filter(i => i.status === 'publicado').length;
          const pct = total ? Math.round((pub / total) * 100) : 0;
          return (
            <Link key={sec.slug} href={`/admin/secoes/${sec.slug}`} className="adm-card">
              <h3>{sec.nome}</h3>
              <div className="n">
                {total} {total === 1 ? 'item' : 'itens'}
                {pub < total && ` · ${total - pub} em rascunho`}
              </div>
              <div className="barra"><i style={{ width: `${pct}%` }} /></div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
