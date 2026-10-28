// html2canvas é carregado via CDN como global (window.html2canvas)
// Arte de 1080×1350 renderizada em 1,5x = 1620×2025 (4:5): nítida no WhatsApp, que reduz fotos a ~1600 px.
// JPEG (não PNG) é o formato nativo do WhatsApp: arquivo leve (~0,5 MB) e sem reconversão que borra o texto.
const ESCALA = 1.5;
const QUALIDADE_JPEG = 0.92;
const corFundo = () => getComputedStyle(document.documentElement).getPropertyValue('--cor-fundo').trim() || null;

export async function gerarImagem(elemento) {
  elemento.classList.add('arte--renderizando');
  try {
    await document.fonts.ready;
    // escudos fora da tela não carregam com loading="lazy": força o carregamento e espera (máx. 5 s)
    const imagens = [...elemento.querySelectorAll('img')];
    imagens.forEach((img) => { img.loading = 'eager'; });
    await Promise.race([
      Promise.all(imagens.map((img) => (img.complete ? null : new Promise((ok) => { img.onload = img.onerror = ok; })))),
      new Promise((ok) => setTimeout(ok, 5000)),
    ]);
    const canvas = await window.html2canvas(elemento, {
      scale: ESCALA, useCORS: true, backgroundColor: corFundo(), width: 1080, windowWidth: 1080,
    });
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALIDADE_JPEG));
  } finally {
    elemento.classList.remove('arte--renderizando');
  }
}

export async function compartilharImagem(elemento, nomeArquivo = 'campeonato-sanroquense.jpg') {
  const blob = await gerarImagem(elemento);
  const arquivo = new File([blob], nomeArquivo, { type: 'image/jpeg' });

  if (navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: '1º Campeonato Sanroquense', text: `Acompanhe o campeonato: ${new URL('./', location.href).href}` });
    } catch (erro) {
      if (erro.name !== 'AbortError') throw erro; // usuário cancelou: ignora
    }
    return;
  }
  // Fallback (desktop): baixa a imagem e abre o WhatsApp com o link do site
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: nomeArquivo }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  window.open(`https://wa.me/?text=${encodeURIComponent(`Confira a tabela: ${location.origin}${location.pathname}`)}`, '_blank');
}
