// Prepara fotos no próprio aparelho: corrige a rotação, reduz e comprime em JPEG.
const QUALIDADE = 0.85;

// `lado`: maior lado em px · `quadrada`: recorta o centro (fotos de jogador e técnico)
export async function prepararFoto(arquivo, { lado = 1280, quadrada = false } = {}) {
  if (!arquivo?.type?.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
  // createImageBitmap aplica a orientação EXIF (fotos de celular não saem deitadas)
  const imagem = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  const corte = quadrada ? Math.min(imagem.width, imagem.height) : null;
  const origem = quadrada
    ? { x: (imagem.width - corte) / 2, y: Math.max(0, (imagem.height - corte) / 3), l: corte, a: corte } // um pouco acima do centro: rosto
    : { x: 0, y: 0, l: imagem.width, a: imagem.height };
  const escala = Math.min(1, lado / Math.max(origem.l, origem.a));
  const canvas = Object.assign(document.createElement('canvas'), {
    width: Math.round(origem.l * escala), height: Math.round(origem.a * escala),
  });
  canvas.getContext('2d').drawImage(imagem, origem.x, origem.y, origem.l, origem.a, 0, 0, canvas.width, canvas.height);
  imagem.close?.();
  const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', QUALIDADE));
  if (!blob) throw new Error('Não foi possível processar a foto.');
  return blob;
}
