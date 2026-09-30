import { sessaoAtual, PODE_EDITAR, PODE_PUBLICAR } from '@/lib/auth';
import Fotos from './Fotos';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Fotos — Admin' };

/**
 * Fotos pelo celular: escolher o item, tirar a foto, enviar.
 * Feita para o celular da loja — uma coisa por tela, botões grandes.
 */
export default async function PaginaFotos() {
  const s = await sessaoAtual();
  if (!s?.membro) {
    return <div className="adm-wrap"><div className="aviso-adm mel">Sem acesso.</div></div>;
  }

  const { data: secoes } = await s.sb
    .from('secoes')
    .select('slug, nome, ordem, itens ( id, codigo_pdv, nome, ordem, imagens ( id, storage_path, papel, foco_x, foco_y ) )')
    .eq('tenant_id', s.membro.tenant_id)
    .order('ordem');

  const lista = (secoes ?? []).map(sec => ({
    slug: sec.slug,
    nome: sec.nome,
    itens: (sec.itens ?? [])
      .sort((a, b) => a.ordem - b.ordem)
      .map(i => {
        const foto = (i.imagens ?? []).find(m => m.papel === 'produto')
                  ?? (i.imagens ?? []).find(m => m.papel === 'regular');
        return {
          id: i.id,
          codigo: i.codigo_pdv ?? '',
          nome: i.nome,
          foto: foto ? { id: foto.id, caminho: foto.storage_path, x: +foto.foco_x, y: +foto.foco_y } : null
        };
      })
  })).filter(sec => sec.itens.length);

  return (
    <Fotos
      secoes={lista}
      urlBase={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/menu`}
      podeEditar={PODE_EDITAR.includes(s.membro.papel)}
      podeRemover={PODE_PUBLICAR.includes(s.membro.papel)}
    />
  );
}
