// Mural (feed): times publicam texto e/ou foto com o código do clube; torcedores comentam.
// A moderação (aprovar, recusar, apagar) fica no painel do organizador (aba Mural).
import { assinarMudancas } from '../realtime.js';
import { criarFeed } from '../feed.js';
import { montarLayout, checarConfiguracao, mostrarCarregando } from '../ui.js';

const app = document.getElementById('app');

montarLayout('mural');
if (checarConfiguracao(app)) {
  mostrarCarregando(app);
  const feed = criarFeed(app);
  feed.carregar().then(() => {
    // link compartilhado de uma publicação (mural.html#post-12): rola até ela
    if (location.hash.startsWith('#post-')) document.querySelector(location.hash)?.scrollIntoView({ block: 'center' });
  });
  assinarMudancas(feed.carregar, ['posts', 'comentarios']);
}
