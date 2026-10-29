import { buscarCampeonato, listarRodadas, listarJogos } from '../api.js';
import { assinarMudancas } from '../realtime.js';
import { cartaoJogo } from '../cartaoJogo.js';
import { carregarComCache } from '../cache.js';
import { compartilharImagem } from '../compartilhar.js';
import { arteRodada, inserirArte } from '../artes.js';
import { rodadaAtual } from '../rodadas.js';
import { botaoCompartilhar, montarLayout, checarConfiguracao, mostrarCarregando, mostrarAviso, formatarData } from '../ui.js';

const app = document.getElementById('app');
let rodadaSelecionada = null;
let dados = null;

function renderizar(rodadas, jogos) {
  if (!rodadas.length) {
    app.innerHTML = '<p class="carregando">Nenhuma rodada cadastrada ainda.</p>';
    return;
  }
  if (!rodadas.some((r) => r.id === rodadaSelecionada)) rodadaSelecionada = rodadaAtual(rodadas, jogos);
  const rodada = rodadas.find((r) => r.id === rodadaSelecionada);
  const dosJogos = jogos.filter((j) => j.rodada_id === rodada.id);
  dados = { ...dados, rodada, jogos: dosJogos };

  const chips = rodadas.map((r) => `
    <button class="chip${r.id === rodada.id ? ' chip--ativo' : ''}" data-rodada="${r.id}">R${r.numero}</button>`).join('');
  const data = rodada.data ? ` · ${formatarData(rodada.data)}` : '';

  app.innerHTML = `
    <div class="chips" role="tablist" aria-label="Rodadas">${chips}</div>
    <h3>Rodada ${rodada.numero}${data}</h3>
    <div class="secao">${dosJogos.length ? dosJogos.map(cartaoJogo).join('') : '<p class="carregando">Nenhum confronto nesta rodada.</p>'}</div>`;
  app.querySelectorAll('.chip').forEach((chip) =>
    chip.addEventListener('click', () => {
      rodadaSelecionada = Number(chip.dataset.rodada);
      renderizar(rodadas, jogos);
    }));
  app.querySelector('.chip--ativo')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

const buscar = async () => {
  const [campeonato, rodadas, jogos] = await Promise.all([buscarCampeonato(), listarRodadas(), listarJogos()]);
  return { campeonato, rodadas, jogos };
};

async function carregar() {
  try {
    await carregarComCache('confrontos', buscar, ({ campeonato, rodadas, jogos }) => {
      dados = { campeonato };
      renderizar(rodadas, jogos);
    });
  } catch (erro) {
    mostrarAviso(app, `Não foi possível carregar os confrontos: ${erro.message}`);
  }
}

montarLayout('confrontos');
if (checarConfiguracao(app)) {
  mostrarCarregando(app);
  carregar();
  assinarMudancas(carregar);
  botaoCompartilhar(async () => {
    if (!dados?.rodada) throw new Error('nenhuma rodada selecionada');
    await compartilharImagem(inserirArte('arte-rodada', arteRodada(dados.campeonato, dados.rodada, dados.jogos)), `rodada-${dados.rodada.numero}.jpg`);
  });
}
