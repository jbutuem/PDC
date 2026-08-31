import { sessaoAtual, supabaseAdmin, PODE_EDITAR } from '@/lib/auth';
import Gerenciador from './Gerenciador';

export const dynamic = 'force-dynamic';

export default async function PaginaImagens() {
  const s = await sessaoAtual();
  if (!s?.membro) return <div className="adm-wrap"><div className="aviso-adm mel">Sem acesso.</div></div>;

  const sb = supabaseAdmin();

  const { data: imagens } = await sb
    .from('imagens')
    .select('id, storage_path, papel, alt, largura, altura, foco_x, foco_y, itens ( nome, codigo_pdv )')
    .eq('tenant_id', s.membro.tenant_id)
    .order('criado_em', { ascending: false });

  const { data: itens } = await sb
    .from('itens').select('id, nome, codigo_pdv, secoes ( nome )')
    .eq('tenant_id', s.membro.tenant_id).order('ordem');

  const urlBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/menu`;
  const semFoto = (itens?.length ?? 0) - new Set((imagens ?? []).map(i => i.itens?.codigo_pdv).filter(Boolean)).size;

  return (
    <div className="adm-wrap">
      <div className="adm-cab">
        <h1>Imagens</h1>
        {semFoto > 0 && <span className="chip neutro">{semFoto} itens sem foto</span>}
      </div>
      <p className="adm-sub">
        A mesma imagem serve todas as proporções porque o corte sai do ponto de foco.
        Suba a foto, arraste o alvo sobre o produto e pronto.
      </p>

      <Gerenciador
        imagens={imagens ?? []}
        itens={(itens ?? []).map(i => ({ ...i, nome: `${i.nome}${i.secoes?.nome ? ` (${i.secoes.nome})` : ''}` }))}
        urlBase={urlBase}
        podeEditar={PODE_EDITAR.includes(s.membro.papel)}
      />
    </div>
  );
}
