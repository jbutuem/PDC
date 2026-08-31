import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sessaoAtual, supabaseAdmin, PODE_EDITAR } from '@/lib/auth';
import Editor from './Editor';

export const dynamic = 'force-dynamic';

export default async function PaginaSecao({ params }) {
  const { slug } = await params;
  const s = await sessaoAtual();
  if (!s?.membro) return <div className="adm-wrap"><div className="aviso-adm mel">Sem acesso.</div></div>;

  const sb = supabaseAdmin();
  const { data: secao } = await sb
    .from('secoes').select('id, slug, nome, subtitulo')
    .eq('tenant_id', s.membro.tenant_id).eq('slug', slug).maybeSingle();
  if (!secao) notFound();

  const { data: brutos } = await sb
    .from('itens')
    .select('id, codigo_pdv, nome, descricao, tags, status, esgotado, ordem, variantes ( id, rotulo, ordem, precos ( valor_centavos, vigencia_fim, vigencia_inicio ) )')
    .eq('secao_id', secao.id)
    .order('ordem');

  const itens = (brutos ?? []).map(i => ({
    ...i,
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

      <Editor
        secao={secao} itens={itens} mediaSecao={media}
        podeEditar={PODE_EDITAR.includes(s.membro.papel)}
      />
    </div>
  );
}
