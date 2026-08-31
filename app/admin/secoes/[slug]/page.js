import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sessaoAtual, PODE_EDITAR } from '@/lib/auth';
import Editor from './Editor';

export const dynamic = 'force-dynamic';

export default async function PaginaSecao({ params }) {
  const { slug } = await params;
  const s = await sessaoAtual();
  if (!s?.membro) return <div className="adm-wrap"><div className="aviso-adm mel">Sem acesso.</div></div>;

  const sb = s.sb;
  const { data: secao } = await sb
    .from('secoes').select('id, slug, nome, subtitulo')
    .eq('tenant_id', s.membro.tenant_id).eq('slug', slug).maybeSingle();
  if (!secao) notFound();

  const { data: brutos } = await sb
    .from('itens')
    .select('id, codigo_pdv, nome, descricao, tags, status, esgotado, ordem, variantes ( id, rotulo, ordem, precos ( valor_centavos, vigencia_fim, vigencia_inicio ) ), imagens ( id, storage_path, papel, foco_x, foco_y )')
    .eq('secao_id', secao.id)
    .order('ordem');

  const itens = (brutos ?? []).map(i => ({
    ...i,
    imagem: (i.imagens ?? []).find(x => x.papel === 'produto') ?? null,
    variantes: (i.variantes ?? []).sort((a, b) => a.ordem - b.ordem).map(v => {
      const vig = (v.precos ?? [])
        .filter(p => !p.vigencia_fim)
        .sort((a, b) => new Date(b.vigencia_inicio) - new Date(a.vigencia_inicio))[0];
      return { id: v.id, rotulo: v.rotulo, preco: vig?.valor_centavos ?? null };
    })
  }));

  const todos = itens.flatMap(i => i.variantes.map(v => v.preco)).filter(Boolean);
  const media = todos.length > 3 ? todos.reduce((a, b) => a + b, 0) / todos.length : null;
  const rascunhos = itens.filter(i => i.status === 'rascunho').length;
  const semFoto = itens.filter(i => !i.imagem).length;
  const urlBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/menu`;

  return (
    <div className="adm-wrap">
      <p className="adm-sub" style={{ marginBottom: 8 }}>
        <Link href="/admin" style={{ color: 'var(--forno)', fontWeight: 600 }}>← Cardápio</Link>
      </p>
      <div className="adm-cab">
        <h1>{secao.nome}</h1>
        {rascunhos > 0 && <span className="chip alerta">{rascunhos} em rascunho</span>}
      </div>
      <p className="adm-sub">
        {secao.subtitulo ? secao.subtitulo + ' · ' : ''}{itens.length} itens
        {media && ` · média da seção R$ ${(media / 100).toFixed(2).replace('.', ',')}`}
      </p>

      <div className="atalhos">
        <span>
          <b>{semFoto === 0 ? 'Todos os itens têm foto.' : `${semFoto} de ${itens.length} itens sem foto.`}</b>{' '}
          Clique em <b>+ foto</b> na linha do item para subir. Depois clique sobre a
          miniatura para marcar o ponto de foco — é ele que decide o corte em cada tela.
        </span>
        <Link href="/admin/imagens" className="bt g mini" style={{ marginLeft: 'auto' }}>
          Hero e banners →
        </Link>
      </div>

      <Editor
        secao={secao} itens={itens} mediaSecao={media} urlBase={urlBase}
        podeEditar={PODE_EDITAR.includes(s.membro.papel)}
      />
    </div>
  );
}
