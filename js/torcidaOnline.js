// Nos cards de jogo (ao vivo e próximos): "● 34 acompanhando agora" e a torcida online de cada time
// (torcedores com o app aberto que escolheram aquele time do coração). Preenche os espaços
// [data-torcida] que o cartaoJogo deixa, sempre que alguém entra ou sai e quando a página redesenha.
import { aoMudarOnline } from './presenca.js';

let ultimo = null;

function pintar(el) {
  if (!ultimo) return;
  const m = ultimo.torcida[el.dataset.m] ?? 0;
  const v = ultimo.torcida[el.dataset.v] ?? 0;
  const vivo = el.dataset.vivo === '1';
  const placar = el.querySelector('.jogo__torcida-placar');
  const acompanhando = el.querySelector('.jogo__acompanhando');
  placar.classList.toggle('oculto', !m && !v);
  placar.querySelector('[data-tm]').textContent = m;
  placar.querySelector('[data-tv]').textContent = v;
  if (acompanhando) acompanhando.querySelector('[data-total]').textContent = ultimo.total;
  el.classList.toggle('oculto', !vivo && !m && !v);
}

const pintarTodos = (raiz = document) => raiz.querySelectorAll('[data-torcida]').forEach(pintar);

let ligado = false;
export function ligarTorcidaOnline() {
  if (ligado) return;
  ligado = true;
  aoMudarOnline((r) => { ultimo = r; pintarTodos(); });
  // as páginas redesenham os cards (tempo real, troca de rodada): pinta os novos na hora
  new MutationObserver((mudancas) => {
    if (!ultimo) return;
    for (const m of mudancas) m.addedNodes.forEach((n) => { if (n.nodeType === 1) pintarTodos(n.matches?.('[data-torcida]') ? n.parentNode : n); });
  }).observe(document.body, { childList: true, subtree: true });
}
