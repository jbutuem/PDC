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

  const [{ data: lojas }, { data: grupos }, { data: brutos }] = await Promise.all([
    sb.from('lojas').select('id, slug, nome').eq('tenant_id', s.membro.tenant_id).eq('ativo', true).order('ordem'),
    sb.from('grupos').select('id, nome, nota, ordem').eq('secao_id', secao.id).order('ordem'),
    sb.from('itens')
      .select(`id, grupo_id, codigo_pdv, nome, descricao, tags, status, esgotado, ordem,
               variantes ( id, rotulo, ordem, precos ( valor_centavos, vigencia_fim, vigencia_inicio, loja_id ) ),
               imagens ( id, storage_path, papel, foco_x, foco_y ),
               itens_lojas ( loja_id, disponivel )`)
      .eq('secao_id', secao.id)
      .order('ordem')
  ]);

  const vigente = (precos, lojaId) => (precos ?? [])
    .filter(p => !p.vigencia_fim && (p.loja_id ?? null) === lojaId)
    .sort((a, b) => new Date(b.vigencia_inicio) - new Date(a.vigencia_inicio))[0]?.valor_centavos ?? null;

  const itens = (brutos ?? []).map(i => ({
    id: i.id, grupo_id: i.grupo_id, codigo_pdv: i.codigo_pdv, nome: i.nome, descricao: i.descricao,
    tags: i.tags, status: i.status, esgotado: i.esgotado,
    imagem: (i.imagens ?? []).find(x => x.papel === 'produto') ?? null,
    // Sem linha em itens_lojas = a loja vende. Só as exceções são gravadas.
    naoVende: (i.itens_lojas ?? []).filter(x => !x.disponivel).map(x => x.loja_id),
    variantes: (i.variantes ?? []).sort((a, b) => a.ordem - b.ordem).map(v => ({
      id: v.id,
      rotulo: v.rotulo,
      preco: vigente(v.precos, null),
      porLoja: Object.fromEntries((lojas ?? []).map(l => [l.id, vigente(v.precos, l.id)]).filter(([, x]) => x != null))
    }))
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
        {semFoto > 0 ? ` · ${semFoto} sem foto` : ' · todos com foto'}
      </p>

      <Editor
        secao={secao} itens={itens} grupos={grupos ?? []} lojas={lojas ?? []}
        mediaSecao={media} urlBase={urlBase}
        podeEditar={PODE_EDITAR.includes(s.membro.papel)}
      />
    </div>
  );
}
