# 07 — Compartilhar Imagem (WhatsApp)

## Estratégia
1. Cada página tem um **template oculto** de arte (`<div class="arte" id="arte-...">`) com largura fixa **1080px** (formato quadrado 1080×1080 ou vertical 1080×1350) — independente da tela do celular.
2. O template é preenchido com os mesmos dados da página.
3. `html2canvas` renderiza o template em PNG.
4. Envio:
   - **Celular**: Web Share API com arquivo (`navigator.share({ files })`) → usuário escolhe WhatsApp.
   - **Fallback (desktop / navegador sem suporte)**: baixa o PNG e abre `https://wa.me/?text=` com o link do site.

## Artes disponíveis
| Página | Arte | Tamanho |
|---|---|---|
| Classificação | Igual ao banner: título, local/organização, tabela completa, legenda | 1080×1350 |
| Confrontos | "RODADA X" + cards de jogos com placar/autores (ou agenda) | 1080×1350 |
| Artilharia | Top 10 artilheiros | 1080×1350 |
| Início | (opcional) Resumo: líder + artilheiro + próxima rodada | 1080×1080 |

## `js/compartilhar.js`
```js
// html2canvas carregado via CDN como global: window.html2canvas
export async function gerarImagem(elemento) {
  elemento.classList.add('arte--renderizando');      // tira do display:none e posiciona fora da tela
  await document.fonts.ready;                         // garante fontes carregadas
  const canvas = await window.html2canvas(elemento, {
    scale: 1, useCORS: true, backgroundColor: null, width: 1080, windowWidth: 1080
  });
  elemento.classList.remove('arte--renderizando');
  return new Promise(res => canvas.toBlob(res, 'image/png', 0.95));
}

export async function compartilharImagem(elemento, nomeArquivo = 'campeonato-sanroquense.png') {
  const blob = await gerarImagem(elemento);
  const arquivo = new File([blob], nomeArquivo, { type: 'image/png' });

  if (navigator.canShare?.({ files: [arquivo] })) {
    await navigator.share({ files: [arquivo], title: '1º Campeonato Sanroquense' });
    return;
  }
  // Fallback: baixa e abre WhatsApp com o link
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: nomeArquivo });
  a.click();
  URL.revokeObjectURL(url);
  window.open(`https://wa.me/?text=${encodeURIComponent('Confira a tabela: ' + location.href)}`, '_blank');
}
```

## CSS (`css/compartilhar.css`)
```css
.arte { display: none; width: 1080px; }
.arte--renderizando { display: block; position: fixed; left: -9999px; top: 0; }
```

## Cuidados
- **Escudos do Storage**: bucket público + `useCORS: true`. Se algum escudo falhar, usar o fallback SVG.
- **Imagem de fundo**: servir do próprio domínio (`assets/`) para evitar erro de CORS no canvas.
- `navigator.share` só funciona em **HTTPS** (GitHub Pages ok) e a partir de clique do usuário.
- Mostrar "Gerando imagem..." enquanto processa (pode levar 1–2 s no celular).
- Rodapé da arte: "Atualizado em dd/mm/aaaa" + URL curta do site.
