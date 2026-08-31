import Link from 'next/link';
import { sessaoAtual, PODE_EDITAR } from '@/lib/auth';

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
  const sb = s.sb;

  const { data: secoes } = await sb
    .from('secoes')
    .select('slug, nome, subtitulo, itens ( id, status, esgotado, descricao, imagens ( papel ) )')
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

  const { data: todasImagens } = await sb
    .from('imagens').select('papel').eq('tenant_id', s.membro.tenant_id);

  const itensTodos = (secoes ?? []).flatMap(x => x.itens ?? []);
  const totalItens = itensTodos.length;
  const nRascunho = rascunhos?.length ?? 0;
  const esgotados = itensTodos.filter(i => i.esgotado).length;
  const comFoto = itensTodos.filter(i => (i.imagens ?? []).some(m => ['produto', 'regular'].includes(m.papel))).length;
  const semFoto = totalItens - comFoto;
  const semDescricao = itensTodos.filter(i => !i.descricao?.trim()).length;
  const temHero = (todasImagens ?? []).some(i => i.papel === 'hero');
  const nPromo = (todasImagens ?? []).filter(i => i.papel === 'promo').length;

  const pendencias = [
    { n: semFoto, ok: semFoto === 0,
      txt: semFoto ? <>itens ainda <b>sem foto de produto</b> — a maior lacuna visual do cardápio</>
                   : <>todos os itens têm foto</> },
    { n: temHero ? 1 : 0, ok: temHero,
      txt: temHero ? <>hero definido no topo do site</>
                   : <><b>nenhuma imagem de hero.</b> O topo do site mostra a área reservada</> },
    { n: nPromo, ok: nPromo > 0,
      txt: nPromo ? <>imagens de promoção cadastradas</>
                  : <>nenhuma imagem de promoção — os cards de "Esta semana" ficam sem foto</> },
    { n: semDescricao, ok: semDescricao === 0,
      txt: semDescricao ? <>itens sem descrição de ingredientes</> : <>todos os itens descritos</> }
  ];

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


      <div className="adm-grade">
        {(secoes ?? []).map(sec => {
          const total = sec.itens?.length ?? 0;
          const pub = (sec.itens ?? []).filter(i => i.status === 'publicado').length;
          const fotos = (sec.itens ?? []).filter(i => (i.imagens ?? []).some(m => ['produto', 'regular'].includes(m.papel))).length;
          const pctFoto = total ? Math.round((fotos / total) * 100) : 0;
          return (
            <Link key={sec.slug} href={`/admin/secoes/${sec.slug}`} className="adm-card">
              <h3>{sec.nome}</h3>
              <div className="n">{total} {total === 1 ? 'item' : 'itens'}</div>
              <div className="meta">
                <span>{fotos}/{total} com foto</span>
                {pub < total && <b>{total - pub} em rascunho</b>}
              </div>
              <div className="barra">
                <i className="foto" style={{ width: `${pctFoto}%` }} />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="falta">
        <h2>O que falta</h2>
        <p className="s">O cardápio já está no ar. Isto é o que ainda o deixa incompleto.</p>
        <ul>
          {pendencias.map((p, i) => (
            <li key={i} className={p.ok ? 'ok' : undefined}>
              <span className="n">{p.ok ? '✓' : p.n}</span>
              <span>{p.txt}</span>
            </li>
          ))}
        </ul>
        <div className="adm-acoes" style={{ marginTop: 14 }}>
          <Link href="/admin/imagens" className="bt s">Hero, destaques e promoções</Link>
          <Link href="/" target="_blank" className="bt g">Ver o cardápio no ar ↗</Link>
        </div>
      </div>
    </div>
  );
}
