// Registra o service worker (site instalável e tabela disponível sem sinal).
// Em localhost fica desligado para o cache não mostrar código velho durante o desenvolvimento
// (para testar o PWA localmente, abra a página com ?pwa no endereço).
const emDesenvolvimento = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
  && !location.search.includes('pwa');

function registrar() {
  navigator.serviceWorker.register('sw.js').catch(() => { /* sem HTTPS: segue sem PWA */ });
}

// Versão nova publicada: quando o service worker novo assume, recarrega a página uma vez para
// não ficar com partes da versão antiga na tela (ex.: painel sem a engrenagem). Se houver uma
// janela aberta (alguém digitando um resultado), não recarrega: só avisa.
function recarregarNaVersaoNova() {
  const jaTinhaVersao = Boolean(navigator.serviceWorker.controller);
  let recarregou = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!jaTinhaVersao || recarregou) return;
    if (document.querySelector('dialog[open]')) {
      import('./ui.js').then(({ toast }) => toast('Nova versão do app disponível: feche e abra de novo.')).catch(() => {});
      return;
    }
    recarregou = true;
    location.reload();
  });
}

if ('serviceWorker' in navigator && !emDesenvolvimento) {
  recarregarNaVersaoNova();
  // módulos podem carregar depois do evento "load"
  if (document.readyState === 'complete') registrar();
  else window.addEventListener('load', registrar);
}
