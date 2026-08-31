/**
 * Prepara a imagem no navegador antes de enviar ao Storage.
 *
 * Motivo: foto de celular moderno tem 4 a 25 MB e frequentemente vem em HEIC.
 * Sem este passo, o upload falha no servidor com mensagem em inglês e a pessoa
 * só vê "não aconteceu nada". Aqui reduzimos e reconvertemos para JPEG, o que
 * também deixa o envio muito mais rápido no 4G da loja.
 */

const LADO_MAXIMO = { hero: 3000, destaque: 2400, promo: 1800, produto: 1400 };
const MINIMO = { hero: 2400, destaque: 1200, promo: 900, produto: 800 };
const ALVO_BYTES = 1_600_000;

const ehHeic = f =>
  /image\/hei[cf]/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);

/** Lê o arquivo como imagem. Rejeita com mensagem útil se o navegador não decodificar. */
function decodificar(arquivo) {
  return new Promise((ok, falha) => {
    const url = URL.createObjectURL(arquivo);
    const img = new window.Image();
    // Rede de segurança: alguns navegadores não disparam onload nem onerror
    // com formatos que não conhecem, e a tela ficaria carregando para sempre.
    const relogio = setTimeout(() => {
      URL.revokeObjectURL(url);
      falha(new Error('O navegador não conseguiu abrir esta imagem. Tente salvá-la como JPEG e enviar de novo.'));
    }, 20000);

    img.onload = () => { clearTimeout(relogio); URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => {
      clearTimeout(relogio); URL.revokeObjectURL(url);
      falha(new Error('Este arquivo não é uma imagem que o navegador consiga abrir.'));
    };
    img.src = url;
  });
}

const paraBlob = (canvas, q) =>
  new Promise(ok => canvas.toBlob(b => ok(b), 'image/jpeg', q));

/**
 * Devolve { blob, nome, largura, altura, aviso } pronto para enviar.
 * Lança Error com mensagem em português quando não dá para seguir.
 */
export async function prepararImagem(arquivo, papel = 'produto') {
  if (ehHeic(arquivo)) {
    throw new Error(
      'Foto em HEIC (formato padrão do iPhone). No iPhone: Ajustes → Câmera → Formatos → ' +
      '"Mais compatível" e tire a foto de novo. Para uma foto que já existe, abra em Fotos, ' +
      'toque em compartilhar e escolha "Copiar" — isso gera um JPEG.'
    );
  }

  if (!arquivo.type.startsWith('image/')) {
    throw new Error('Escolha um arquivo de imagem (JPEG ou PNG).');
  }

  const img = await decodificar(arquivo);
  const { naturalWidth: w, naturalHeight: h } = img;

  const minimo = MINIMO[papel] ?? 800;
  let aviso = null;
  if (Math.min(w, h) < minimo) {
    aviso = `Imagem de ${w}×${h}. Para "${papel}" o ideal é pelo menos ${minimo} px no lado menor — ` +
            'ela vai funcionar, mas pode ficar borrada em tela grande.';
  }

  const maximo = LADO_MAXIMO[papel] ?? 1400;
  const escala = Math.min(1, maximo / Math.max(w, h));
  const lw = Math.round(w * escala);
  const lh = Math.round(h * escala);

  // Já é JPEG pequeno e dentro do tamanho: envia como veio, sem recomprimir.
  if (escala === 1 && arquivo.size <= ALVO_BYTES && /jpe?g/i.test(arquivo.type)) {
    return { blob: arquivo, nome: arquivo.name, largura: w, altura: h, aviso };
  }

  const canvas = document.createElement('canvas');
  canvas.width = lw;
  canvas.height = lh;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, lw, lh);

  let qualidade = 0.86;
  let blob = await paraBlob(canvas, qualidade);
  while (blob && blob.size > ALVO_BYTES && qualidade > 0.6) {
    qualidade -= 0.08;
    blob = await paraBlob(canvas, qualidade);
  }
  if (!blob) throw new Error('Não consegui converter a imagem. Tente salvá-la como JPEG.');

  return {
    blob,
    nome: arquivo.name.replace(/\.[^.]+$/, '') + '.jpg',
    largura: lw,
    altura: lh,
    aviso
  };
}

export const formatarTamanho = b =>
  b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;
