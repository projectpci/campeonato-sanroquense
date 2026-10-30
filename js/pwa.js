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

// App instalado: "abrir o app" sempre leva à tela inicial, mesmo que ele estivesse aberto em segundo plano.
// Voltar em menos de 3 min (ex.: compartilhou no WhatsApp e voltou) continua onde estava.
// Não sai da página com uma janela aberta (alguém digitando um resultado ou editando o elenco).
const VOLTA_INICIO_MS = 3 * 60 * 1000;
const instalado = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
const naTelaInicial = () => /\/(index\.html)?$/.test(location.pathname);
let escondidoEm = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { escondidoEm = Date.now(); return; }
  if (!escondidoEm || !instalado() || naTelaInicial() || document.querySelector('dialog[open]')) return;
  if (Date.now() - escondidoEm >= VOLTA_INICIO_MS) location.replace('index.html');
});
