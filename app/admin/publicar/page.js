import Link from 'next/link';
import { sessaoAtual, supabaseAdmin, PODE_PUBLICAR } from '@/lib/auth';
import Publicador from './Publicador';

export const dynamic = 'force-dynamic';
const brl = c => 'R$ ' + (c / 100).toFixed(2).replace('.', ',');

export default async function PaginaPublicar() {
  const s = await sessaoAtual();
  if (!s?.membro) return <div className="adm-wrap"><div className="aviso-adm mel">Sem acesso.</div></div>;

  const podePublicar = PODE_PUBLICAR.includes(s.membro.papel);
  const sb = supabaseAdmin();
  const tenant = s.membro.tenant_id;

  const { data: rascunhos } = await sb
    .from('itens')
    .select('id, codigo_pdv, nome, secoes ( nome ), variantes ( rotulo, ordem, precos ( valor_centavos, vigencia_inicio, vigencia_fim ) )')
    .eq('tenant_id', tenant).eq('status', 'rascunho').order('ordem');

  const linhas = [];
  let alertas = 0;

  for (const it of rascunhos ?? []) {
    for (const v of (it.variantes ?? []).sort((a, b) => a.ordem - b.ordem)) {
      const ordenados = (v.precos ?? [])
        .sort((a, b) => new Date(b.vigencia_inicio) - new Date(a.vigencia_inicio));
      const atual = ordenados.find(p => !p.vigencia_fim);
      const anterior = ordenados.find(p => p.vigencia_fim);
      if (!atual || !anterior || atual.valor_centavos === anterior.valor_centavos) continue;

      const variacao = Math.abs(atual.valor_centavos - anterior.valor_centavos) / anterior.valor_centavos;
      const risco = variacao > 0.3;
      if (risco) alertas++;

      linhas.push({
        item: it.nome, cod: it.codigo_pdv, secao: it.secoes?.nome,
        rotulo: v.rotulo === 'unica' ? '' : v.rotulo,
        de: brl(anterior.valor_centavos), para: brl(atual.valor_centavos),
        pct: Math.round(variacao * 100),
        subiu: atual.valor_centavos > anterior.valor_centavos,
        risco
      });
    }
  }

  const semPreco = [];
  for (const it of rascunhos ?? []) {
    const tem = (it.variantes ?? []).some(v => (v.precos ?? []).some(p => !p.vigencia_fim));
    if (!tem) semPreco.push(`${it.nome} (${it.codigo_pdv})`);
  }

  const { data: versoes } = await sb
    .from('versoes').select('numero, nota, publicada_em')
    .eq('tenant_id', tenant).eq('status', 'publicada')
    .order('publicada_em', { ascending: false }).limit(5);

  return (
    <div className="adm-wrap">
      <div className="adm-cab"><h1>Publicar</h1></div>
      <p className="adm-sub">
        O que está em rascunho não aparece no cardápio público. Publicar coloca tudo no ar de uma vez
        e grava uma versão para permitir voltar atrás.
      </p>

      {!podePublicar && (
        <div className="aviso-adm info">
          Seu papel pode editar, mas não publicar. Avise alguém da agência quando terminar.
        </div>
      )}

      {semPreco.length > 0 && (
        <div className="aviso-adm risco">
          <b>{semPreco.length} {semPreco.length === 1 ? 'item sem preço vigente' : 'itens sem preço vigente'}.</b> A
          publicação vai falhar para {semPreco.length === 1 ? 'ele' : 'eles'}: {semPreco.join(', ')}
        </div>
      )}

      <div className="resumo">
        <div>ITENS EM RASCUNHO<b>{rascunhos?.length ?? 0}</b></div>
        <div>PREÇOS ALTERADOS<b>{linhas.length}</b></div>
        <div>ALERTAS<b style={alertas ? { color: 'var(--geleia)' } : undefined}>{alertas}</b></div>
      </div>

      {linhas.length > 0 && (
        <>
          <h2 style={{ fontFamily: 'Fraunces,serif', fontSize: 19, margin: '22px 0 10px', fontWeight: 600 }}>
            Preços que mudaram
          </h2>
          <div className="dl">
            {linhas.map((l, i) => (
              <div className={`l${l.risco ? ' risco' : ''}`} key={i}>
                <b>
                  {l.item}{' '}
                  <span style={{ color: 'var(--t40)', fontWeight: 400 }}>
                    · {l.cod}{l.rotulo && ` · ${l.rotulo}`} · {l.secao}
                  </span>
                </b>
                <span className="v">
                  <s>{l.de}</s><strong>{l.para}</strong>
                  <span style={{ color: 'var(--t40)', marginLeft: 8, fontSize: 12 }}>
                    {l.subiu ? '+' : '−'}{l.pct}%
                  </span>
                  {l.risco && <small>variação acima de 30% — confira</small>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {(rascunhos?.length ?? 0) === 0 && (
        <div className="aviso-adm info">
          Nada em rascunho. O cardápio no ar está igual ao que está no banco.{' '}
          <Link href="/admin"><b>Voltar ao cardápio</b></Link>
        </div>
      )}

      {podePublicar && (rascunhos?.length ?? 0) > 0 && (
        <Publicador quantidade={rascunhos.length} alertas={alertas} />
      )}

      {versoes?.length > 0 && (
        <>
          <h2 style={{ fontFamily: 'Fraunces,serif', fontSize: 19, margin: '30px 0 10px', fontWeight: 600 }}>
            Publicações recentes
          </h2>
          <div className="dl">
            {versoes.map(v => (
              <div className="l" key={v.numero}>
                <b>Versão {v.numero} <span style={{ color: 'var(--t40)', fontWeight: 400 }}>· {v.nota}</span></b>
                <span className="v" style={{ color: 'var(--t40)', fontSize: 12.5 }}>
                  {new Date(v.publicada_em).toLocaleString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
