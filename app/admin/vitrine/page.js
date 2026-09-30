import { sessaoAtual, PODE_EDITAR } from '@/lib/auth';
import Editor from './Editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vitrine — Pão da Primavera' };

export default async function Vitrine() {
  const s = await sessaoAtual();
  if (!s?.membro) {
    return (
      <div className="adm-wrap">
        <div className="aviso-adm mel">Sua conta ainda não tem acesso a este cardápio.</div>
      </div>
    );
  }

  const sb = s.sb;
  const [{ data: hero }, { data: comunicado }, { data: promocoes }, { data: lojas }] = await Promise.all([
    sb.from('imagens')
      .select('id, storage_path, chamada, titulo, linha_apoio, alt, largura, altura, loja_id')
      .eq('papel', 'hero').order('criado_em', { ascending: false }).limit(1).maybeSingle(),
    sb.from('comunicados').select('id, texto, ativo, loja_id')
      .order('inicio', { ascending: false }).limit(1).maybeSingle(),
    sb.from('promocoes')
      .select('id, titulo, chamada, selo, tipo, preco_de_centavos, preco_por_centavos, observacao, ativo, ordem, loja_id, imagens ( storage_path )')
      .order('ordem'),
    sb.from('lojas').select('id, nome').eq('ativo', true).order('ordem')
  ]);

  return (
    <Editor
      hero={hero ?? null}
      comunicado={comunicado ?? null}
      promocoes={promocoes ?? []}
      lojas={lojas ?? []}
      urlBase={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/menu`}
      podeEditar={PODE_EDITAR.includes(s.membro.papel)}
    />
  );
}
