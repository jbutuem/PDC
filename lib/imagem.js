/**
 * Prepara a imagem no navegador antes de enviar ao Storage.
 *
 * Foto de celular tem de 3 a 25 MB. Aqui ela é reduzida e regravada em JPEG
 * antes de sair do aparelho: o envio fica rápido no 4G da loja e o bucket
 * não enche de arquivos de câmera.
 *
 * A imagem é SEMPRE regravada, mesmo quando já é pequena. Foto de celular
 * carrega a localização GPS nos metadados; regravar pelo canvas apaga isso.
 */

/** Maior lado, em px, por papel. Produto aparece no máximo a ~300 px na tela. */
const LADO_MAXIMO = { hero: 2800, destaque: 2000, promo: 1600, produto: 1200 };
/** Abaixo disso a foto funciona, mas pode ficar borrada em tela grande. */
const MINIMO = { hero: 1800, destaque: 1200, promo: 900, produto: 700 };
/** Peso que buscamos por papel. A qualidade desce até caber, com piso de 0,6. */
const ALVO_BYTES = { hero: 700_000, destaque: 500_000, promo: 400_000, produto: 350_000 };

const ehHeic = f => /image\/hei[cf]/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);

const MSG_HEIC =
  'Este navegador não abre fotos HEIC (formato padrão do iPhone). Use a opção "Tirar foto" ' +
  'aqui mesmo, ou no iPhone vá em Ajustes → Câmera → Formatos → "Mais compatível".';

/** Promessa com prazo: alguns navegadores nunca respondem a formatos que não conhecem. */
function comPrazo(promessa, ms, msg) {
  let t;
  return Promise.race([
    promessa.finally(() => clearTimeout(t)),
    new Promise((_, falha) => { t = setTimeout(() => falha(new Error(msg)), ms); })
  ]);
}

/**
 * Decodifica o arquivo. Tenta primeiro createImageBitmap (respeita a
 * orientação da câmera e usa menos memória no celular) e cai para <img>.
 */
async function decodificar(arquivo) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
      return { fonte: bmp, largura: bmp.width, altura: bmp.height, fechar: () => bmp.close?.() };
    } catch { /* segue para <img> */ }
  }
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise((ok, falha) => {
      const i = new window.Image();
      i.decoding = 'async';
      i.onload = () => ok(i);
      i.onerror = () => falha(new Error('decodificar'));
      i.src = url;
    });
    return { fonte: img, largura: img.naturalWidth, altura: img.naturalHeight, fechar: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Reduz em etapas de metade antes do tamanho final. Um salto direto de 4000
 * para 1200 px serrilha no Safari, que ignora imageSmoothingQuality.
 */
function reduzir(fonte, w, h, lw, lh) {
  let atual = fonte, cw = w, ch = h;
  while (cw / 2 >= lw * 1.2) {
    const c = document.createElement('canvas');
    c.width = Math.round(cw / 2); c.height = Math.round(ch / 2);
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(atual, 0, 0, c.width, c.height);
    atual = c; cw = c.width; ch = c.height;
  }
  const final = document.createElement('canvas');
  final.width = lw; final.height = lh;
  const ctx = final.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  // Fundo branco: PNG com transparência não vira fundo preto no JPEG.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, lw, lh);
  ctx.drawImage(atual, 0, 0, lw, lh);
  return final;
}

const paraBlob = (canvas, q) => new Promise(ok => canvas.toBlob(b => ok(b), 'image/jpeg', q));

/**
 * Devolve { blob, nome, largura, altura, antes, depois, aviso } pronto para enviar.
 * Lança Error com mensagem em português quando não dá para seguir.
 */
export async function prepararImagem(arquivo, papel = 'produto') {
  if (!arquivo) throw new Error('Nenhuma imagem escolhida.');
  const heic = ehHeic(arquivo);
  if (!heic && arquivo.type && !arquivo.type.startsWith('image/')) {
    throw new Error('Escolha um arquivo de imagem (foto, JPEG ou PNG).');
  }

  let img;
  try {
    img = await comPrazo(decodificar(arquivo), 20000,
      `O aparelho demorou demais para abrir "${arquivo.name}". Tente de novo ou use uma foto menor.`);
  } catch (e) {
    if (heic) throw new Error(MSG_HEIC);
    if (e.message !== 'decodificar') throw e;
    throw new Error('Não consegui abrir este arquivo como imagem. Tente tirar a foto de novo.');
  }

  const { largura: w, altura: h } = img;
  const maximo = LADO_MAXIMO[papel] ?? 1200;
  const escala = Math.min(1, maximo / Math.max(w, h));
  const lw = Math.round(w * escala);
  const lh = Math.round(h * escala);

  let aviso = null;
  const minimo = MINIMO[papel] ?? 700;
  if (Math.min(w, h) < minimo) {
    aviso = `A foto tem ${w}×${h} px. Para este uso o ideal é pelo menos ${minimo} px no lado menor — ` +
            'ela funciona, mas pode ficar borrada em tela grande.';
  }

  const canvas = reduzir(img.fonte, w, h, lw, lh);
  img.fechar();

  const alvo = ALVO_BYTES[papel] ?? 350_000;
  let qualidade = 0.85;
  let blob = await paraBlob(canvas, qualidade);
  while (blob && blob.size > alvo && qualidade > 0.62) {
    qualidade = Math.max(0.6, qualidade - 0.07);
    blob = await paraBlob(canvas, qualidade);
  }
  if (!blob) throw new Error('Não consegui converter a imagem. Tente tirar a foto de novo.');

  return {
    blob,
    nome: (arquivo.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg',
    largura: lw,
    altura: lh,
    antes: arquivo.size,
    depois: blob.size,
    aviso
  };
}

export const formatarTamanho = b =>
  b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
