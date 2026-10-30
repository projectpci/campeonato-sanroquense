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

// Formato da imagem: post (4:5, feed e conversa do WhatsApp) ou story (9:16, status e Instagram)
function escolherFormato() {
  return new Promise((resolver) => {
    document.querySelector('dialog.dialogo')?.remove();
    const d = Object.assign(document.createElement('dialog'), {
      className: 'dialogo formato',
      innerHTML: `
        <div class="form">
          <h2>Compartilhar como</h2>
          <div class="formato__opcoes">
            <button class="formato__opcao" data-formato="post"><span class="formato__forma formato__forma--post"></span><strong>Post</strong><small>Conversa e feed</small></button>
            <button class="formato__opcao" data-formato="story"><span class="formato__forma formato__forma--story"></span><strong>Story</strong><small>Status e Instagram</small></button>
          </div>
          <button class="botao botao--secundario" data-cancelar>Cancelar</button>
        </div>`,
    });
    let escolha = null;
    d.addEventListener('click', (e) => {
      const b = e.target.closest('[data-formato]');
      if (b) escolha = b.dataset.formato;
      if (b || e.target === d || e.target.closest('[data-cancelar]')) d.close();
    });
    d.addEventListener('close', () => { d.remove(); resolver(escolha); });
    document.body.append(d);
    d.showModal();
  });
}

export async function compartilharImagem(elemento, nomeArquivo = 'campeonato-sanroquense.jpg') {
  const formato = await escolherFormato();
  if (!formato) return; // cancelou
  elemento.classList.toggle('arte--story', formato === 'story');
  if (formato === 'story') nomeArquivo = nomeArquivo.replace(/.jpg$/, '-story.jpg');
  const blob = await gerarImagem(elemento);
  const arquivo = new File([blob], nomeArquivo, { type: 'image/jpeg' });

  if (navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: 'Campeonato SRP', text: `Acompanhe o campeonato: ${new URL('./', location.href).href}` });
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
