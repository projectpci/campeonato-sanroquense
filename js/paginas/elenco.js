// Página Elenco (torcedor): escolhe o time e vê técnico e jogadores cadastrados pelo clube.
import { listarTimes, listarJogadores } from '../api.js';
import { assinarMudancas } from '../realtime.js';
import { carregarComCache } from '../cache.js';
import { htmlElenco, htmlEscolhaTime, elencoAtivo } from '../elencoTime.js';
import { montarLayout, checarConfiguracao, mostrarCarregando, mostrarAviso, escapar } from '../ui.js';

const app = document.getElementById('app');
const CHAVE = 'elenco_time'; // último time visto neste aparelho
let selecionado = Number(new URLSearchParams(location.search).get('time')) || (() => { try { return Number(localStorage.getItem(CHAVE)); } catch { return 0; } })();
let dados = null;

const buscar = async () => {
  const [times, jogadores] = await Promise.all([listarTimes(), listarJogadores()]);
  return { times: times.filter((t) => t.ativo !== false), jogadores };
};

function desenhar(novos) {
  dados = novos;
  const { times, jogadores } = dados;
  if (!times.some((t) => t.id === selecionado)) selecionado = times[0]?.id;
  const time = times.find((t) => t.id === selecionado);
  if (!time) { app.innerHTML = '<p class="vazio">Nenhum time cadastrado.</p>'; return; }
  const qtd = elencoAtivo(jogadores, time.id).length;
  app.innerHTML = `
    ${htmlEscolhaTime(times, jogadores, selecionado)}
    <div class="admin__topo"><h3>${escapar(time.nome)} · ${qtd} jogador${qtd === 1 ? '' : 'es'}</h3>
      <a class="texto-2 texto-pequeno" href="time.html?id=${time.id}">Ver página do time →</a></div>
    ${htmlElenco(time, jogadores)}`;
  app.querySelectorAll('[data-elenco-time]').forEach((b) => b.addEventListener('click', () => {
    selecionado = Number(b.dataset.elencoTime);
    try { localStorage.setItem(CHAVE, String(selecionado)); } catch { /* sem armazenamento */ }
    desenhar(dados);
  }));
  app.querySelector('.chip--ativo')?.scrollIntoView({ inline: 'center', block: 'nearest' });
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
  assinarMudancas(carregar);
}
