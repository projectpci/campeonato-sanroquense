// Resgate da abertura (script comum, não módulo: roda mesmo se os módulos falharem).
// Logo depois de uma atualização, o celular pode juntar arquivos novos com antigos guardados e a página
// travar só com o título. Se o app não iniciar em alguns segundos (ou um módulo falhar), limpa o cache
// do código e recarrega uma vez; se ainda assim não abrir, mostra um botão "Tentar de novo".
(function () {
  var CHAVE = 'resgate_em';
  var ESPERA_MS = 10000;
  var iniciou = function () { return window.__appIniciou === true; };

  function limparCodigo() {
    var limpar = window.caches
      ? caches.keys().then(function (chaves) {
        return Promise.all(chaves.filter(function (c) { return c.indexOf('imagens') < 0; }).map(function (c) { return caches.delete(c); }));
      })
      : Promise.resolve();
    return limpar.then(function () {
      return navigator.serviceWorker ? navigator.serviceWorker.getRegistration().then(function (r) { return r && r.update(); }) : null;
    }).catch(function () {});
  }

  function mostrarBotao() {
    if (document.getElementById('resgate')) return;
    var caixa = document.createElement('div');
    caixa.id = 'resgate';
    caixa.className = 'resgate';
    caixa.innerHTML = '<p>Não foi possível abrir o app agora.</p><button class="botao" type="button">Tentar de novo</button>';
    caixa.querySelector('button').addEventListener('click', function () {
      try { sessionStorage.removeItem(CHAVE); } catch (e) { /* sem armazenamento */ }
      limparCodigo().then(function () { location.reload(); });
    });
    (document.body || document.documentElement).appendChild(caixa);
  }

  function resgatar() {
    if (iniciou()) return;
    var antes = 0;
    try { antes = Number(sessionStorage.getItem(CHAVE)) || 0; } catch (e) { /* sem armazenamento */ }
    if (Date.now() - antes < 60000) { mostrarBotao(); return; } // já tentou agora há pouco: não fica em loop
    try { sessionStorage.setItem(CHAVE, String(Date.now())); } catch (e) { /* sem armazenamento */ }
    limparCodigo().then(function () { location.reload(); });
  }

  // módulo que não carrega ("does not provide an export", "Failed to fetch dynamically imported module"...)
  window.addEventListener('error', function (e) {
    if (!iniciou() && /module|import|export|Unexpected/i.test(String(e.message || ''))) setTimeout(resgatar, 300);
  }, true);
  setTimeout(resgatar, ESPERA_MS);
})();
