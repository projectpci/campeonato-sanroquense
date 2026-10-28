// Prepara a foto do mural no próprio aparelho: corrige a rotação, reduz e comprime em JPEG.
const LADO_MAX = 1280;
const QUALIDADE = 0.85;

export async function prepararFoto(arquivo) {
  if (!arquivo?.type?.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
  // createImageBitmap aplica a orientação EXIF (fotos de celular não saem deitadas)
  const imagem = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  const escala = Math.min(1, LADO_MAX / Math.max(imagem.width, imagem.height));
  const canvas = Object.assign(document.createElement('canvas'), {
    width: Math.round(imagem.width * escala), height: Math.round(imagem.height * escala),
  });
  canvas.getContext('2d').drawImage(imagem, 0, 0, canvas.width, canvas.height);
  imagem.close?.();
  const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', QUALIDADE));
  if (!blob) throw new Error('Não foi possível processar a foto.');
  return blob;
}
