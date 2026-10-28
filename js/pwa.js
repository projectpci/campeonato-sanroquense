// Registra o service worker (site instalável e tabela disponível sem sinal).
// Em localhost fica desligado para o cache não mostrar código velho durante o desenvolvimento
// (para testar o PWA localmente, abra a página com ?pwa no endereço).
const emDesenvolvimento = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
  && !location.search.includes('pwa');

function registrar() {
  navigator.serviceWorker.register('sw.js').catch(() => { /* sem HTTPS: segue sem PWA */ });
}

if ('serviceWorker' in navigator && !emDesenvolvimento) {
  // módulos podem carregar depois do evento "load"
  if (document.readyState === 'complete') registrar();
  else window.addEventListener('load', registrar);
}
