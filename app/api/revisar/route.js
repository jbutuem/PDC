import { NextResponse } from 'next/server';
import { sessaoAtual, PODE_EDITAR } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * O glossário é o que impede a IA de "corrigir" o que não deve.
 * Ele sai do cardápio impresso e é parte do prompt, não do modelo.
 */
const GLOSSARIO = `
GRAFIAS TRAVADAS — nunca altere para outra forma:
muçarela (nunca mozarela/mussarela), catupiry, rosbife, roast beef, crepioca,
beirute, paçoca, brioche, ciabatta, baguete, requeijão casquinha, chapa,
parmegiana, strogonoff, milk-shake, açaí, tapioca, pão de queijo.

ATENÇÃO: "rosbife" e "roast beef" convivem no cardápio em contextos diferentes.
NÃO unifique. Mantenha exatamente como veio.

MARCAS — sempre com o símbolo:
Sadia®, Nutella®, Ceratti, Heineken, Parma Speciale, Catupiry.

PADRÕES DE FORMATO:
- Gramatura: "– 250 g" (travessão curto, espaço, número, espaço, unidade minúscula)
- Volume: "(400 ml)" ou "— 400 ml"
- Preço: "R$ 45,90" (vírgula decimal, duas casas)
- Descrição: ingredientes separados por vírgula, "e" antes do último, SEM ponto final
- Nome do item: sem ponto final, primeira letra maiúscula

REGRAS ABSOLUTAS:
- NÃO traduza nada.
- NÃO "melhore" o texto. NÃO adicione adjetivo, elogio ou apelo comercial.
- NÃO invente ingrediente que não estava escrito.
- NÃO renomeie itens. Se o item se chama "Da Casa", continua "Da Casa".
- NÃO altere números, gramaturas ou volumes.
- Corrija APENAS: erro de digitação, erro de ortografia, acento faltando,
  símbolo de marca faltando, e desvio dos padrões de formato acima.
- Se o texto já está correto, devolva-o idêntico.
`.trim();

export async function POST(request) {
  const s = await sessaoAtual();
  if (!s?.membro || !PODE_EDITAR.includes(s.membro.papel)) {
    return NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 });
  }

  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) {
    return NextResponse.json(
      { erro: 'ANTHROPIC_API_KEY não configurada. Adicione nas variáveis de ambiente da Vercel.' },
      { status: 503 }
    );
  }

  const { secao, textos } = await request.json();
  if (!Array.isArray(textos) || !textos.length) {
    return NextResponse.json({ revisoes: [] });
  }

  const lista = textos
    .map((t, i) => `${i}. [${t.campo}] ${t.texto}`)
    .join('\n');

  const prompt = `Você revisa textos de um cardápio de padaria brasileira.

${GLOSSARIO}

Seção: ${secao}

Textos a revisar (índice. [campo] texto):
${lista}

Devolva SOMENTE um array JSON, sem markdown, sem explicação, sem cercas de código.
Um objeto por texto que precise de correção. Textos corretos: NÃO inclua no array.

Formato de cada objeto:
{"i": <índice do texto>, "sugerido": "<texto corrigido>", "tipo": "<ortografia|marca registrada|padronização>", "motivo": "<uma frase curta explicando>"}

Se nenhum texto precisar de correção, devolva exatamente: []`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': chave,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!r.ok) {
      const detalhe = await r.text();
      console.error('Claude API:', r.status, detalhe.slice(0, 300));
      return NextResponse.json({ erro: `API respondeu ${r.status}` }, { status: 502 });
    }

    const dados = await r.json();
    const bruto = (dados.content ?? [])
      .filter(b => b.type === 'text').map(b => b.text).join('')
      .replace(/```json|```/g, '').trim();

    let sugestoes;
    try {
      sugestoes = JSON.parse(bruto);
    } catch {
      const m = bruto.match(/\[[\s\S]*\]/);
      sugestoes = m ? JSON.parse(m[0]) : [];
    }

    const sb = s.sb;
    const revisoes = [];

    for (const sug of Array.isArray(sugestoes) ? sugestoes : []) {
      const alvo = textos[sug.i];
      if (!alvo || typeof sug.sugerido !== 'string') continue;
      const mudou = sug.sugerido.trim() !== alvo.texto.trim();
      if (!mudou) continue;

      revisoes.push({
        chave: alvo.chave,
        original: alvo.texto,
        sugerido: sug.sugerido.trim(),
        tipo: sug.tipo ?? 'correção',
        motivo: sug.motivo ?? '',
        mudou: true
      });

      // O log é o que permite auditar se a IA está ajudando ou atrapalhando.
      await sb.from('revisoes_ia').insert({
        tenant_id: s.membro.tenant_id,
        entidade: 'itens',
        campo: alvo.campo,
        texto_original: alvo.texto,
        texto_sugerido: sug.sugerido.trim(),
        alteracoes: [{ tipo: sug.tipo, motivo: sug.motivo }],
        decisao: 'pendente'
      });
    }

    return NextResponse.json({ revisoes });
  } catch (e) {
    console.error('Revisão falhou:', e);
    return NextResponse.json({ erro: e.message }, { status: 500 });
  }
}
