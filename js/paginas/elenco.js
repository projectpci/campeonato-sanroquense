// Página Elenco (torcedor): escolhe o time e vê técnico e jogadores cadastrados pelo clube.
import { listarTimes, listarJogadores, buscarArtilharia } from '../api.js';
import { assinarMudancas } from '../realtime.js';
import { carregarComCache } from '../cache.js';
import { htmlElenco, htmlSeletorTimes, ligarElenco, golsPorJogador } from '../elencoTime.js';
import { montarLayout, checarConfiguracao, mostrarCarregando, mostrarAviso } from '../ui.js';

const app = document.getElementById('app');
const CHAVE = 'elenco_time'; // último time visto neste aparelho
let selecionado = Number(new URLSearchParams(location.search).get('time')) || (() => { try { return Number(localStorage.getItem(CHAVE)); } catch { return 0; } })();
let dados = null;

const buscar = async () => {
  const [times, jogadores, artilharia] = await Promise.all([listarTimes(), listarJogadores(), buscarArtilharia()]);
  return { times: times.filter((t) => t.ativo !== false), jogadores, artilharia };
};

function desenharElenco() {
  const { times, jogadores, artilharia } = dados;
  const time = times.find((t) => t.id === selecionado);
  const gols = golsPorJogador(artilharia);
  const alvo = document.getElementById('elenco-time');
  alvo.innerHTML = htmlElenco(time, jogadores, {
    gols, extraTopo: `<a class="elenco__link" href="time.html?id=${time.id}">Ver página do time →</a>`,
  });
  alvo.classList.remove('clube-conteudo--entrar');
  void alvo.offsetWidth; // reinicia a animação de entrada
  alvo.classList.add('clube-conteudo--entrar');
  ligarElenco(alvo, { time, jogadores, gols });
}

function desenhar(novos) {
  dados = novos;
  const { times, jogadores } = dados;
  if (!times.some((t) => t.id === selecionado)) selecionado = times[0]?.id;
  if (!selecionado) { app.innerHTML = '<p class="vazio">Nenhum time cadastrado.</p>'; return; }
  app.innerHTML = `${htmlSeletorTimes(times, jogadores, selecionado)}<div id="elenco-time"></div>`;
  app.querySelectorAll('[data-elenco-time]').forEach((b) => b.addEventListener('click', () => {
    selecionado = Number(b.dataset.elencoTime);
    try { localStorage.setItem(CHAVE, String(selecionado)); } catch { /* sem armazenamento */ }
    app.querySelectorAll('[data-elenco-time]').forEach((x) => {
      const ativo = Number(x.dataset.elencoTime) === selecionado;
      x.classList.toggle('seletor-times__item--ativo', ativo);
      x.setAttribute('aria-pressed', String(ativo));
    });
    b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    desenharElenco();
  }));
  app.querySelector('.seletor-times__item--ativo')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  desenharElenco();
}

async function carregar() {
  try {
    await carregarComCache('elenco', buscar, desenhar);
  } catch (erro) {
    mostrarAviso(app, `Não foi possível carregar os elencos: ${erro.message}`);
  }
}

montarLayout('elenco');
if (checarConfiguracao(app)) {
  mostrarCarregando(app);
  carregar();
  // Realtime: não redesenha com a ficha do jogador aberta
  assinarMudancas(() => { if (!document.querySelector('dialog[open]')) carregar(); });
}
