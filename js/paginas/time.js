// Página de um time: posição, campanha, forma recente, jogos e artilheiros.
import { buscarClassificacao, buscarArtilharia, listarJogos, listarJogadores, listarTimes } from '../api.js';
import { htmlElenco, elencoAtivo, ligarElenco, golsPorJogador } from '../elencoTime.js';
import { ordenarClassificacao, posicoesComEmpate } from '../classificacao.js';
import { assinarMudancas, TABELAS_JOGOS } from '../realtime.js';
import { cartaoJogo } from '../cartaoJogo.js';
import { prepararChances } from '../probabilidade.js';
import { carregarComCache } from '../cache.js';
import { botaoAvisos } from '../avisos.js';
import { montarLayout, checarConfiguracao, mostrarCarregando, mostrarAviso, escapar, escudo } from '../ui.js';

const app = document.getElementById('app');
const timeId = Number(new URLSearchParams(location.search).get('id'));
const sinal = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

const buscar = async () => {
  const [linhas, jogos, artilharia, jogadores, times] = await Promise.all([
    buscarClassificacao(), listarJogos(), buscarArtilharia(timeId), listarJogadores(timeId), listarTimes(),
  ]);
  return { linhas, encerrados: jogos.filter((j) => j.status === 'encerrado'), jogos, artilharia, jogadores, time: times.find((x) => x.id === timeId) };
};

// V / E / D dos últimos 5 jogos encerrados, do mais recente para o mais antigo
function forma(jogos) {
  return jogos.filter((j) => j.status === 'encerrado').reverse().slice(0, 5).map((j) => {
    const meus = j.mandante_id === timeId ? j.gols_mandante : j.gols_visitante;
    const deles = j.mandante_id === timeId ? j.gols_visitante : j.gols_mandante;
    return meus > deles ? 'v' : meus < deles ? 'd' : 'e';
  });
}

function htmlEstatisticas(t) {
  const itens = [['J', t.j], ['V', t.v], ['E', t.e], ['D', t.d], ['GP', t.gp], ['GC', t.gc], ['SG', sinal(t.sg)], ['%', `${Math.round(Number(t.aproveitamento) || 0)}`]];
  return `<div class="estatisticas">${itens.map(([r, v]) => `<div class="estatisticas__item"><strong>${v}</strong><small>${r}</small></div>`).join('')}</div>`;
}

function htmlArtilheiros(artilharia) {
  const lista = posicoesComEmpate(artilharia.map((a) => ({ ...a, gols: Number(a.gols) })));
  if (!lista.length) return '';
  return `<section class="secao"><h3>Artilheiros do time</h3><ol class="lista">${lista.map((a) => `
    <li class="artilheiro"><span class="artilheiro__pos">${a.posicao}º</span>
      <div><div class="artilheiro__nome">${escapar(a.jogador)}</div></div>
      <span class="artilheiro__gols">${a.gols}</span></li>`).join('')}</ol></section>`;
}

function htmlElencoDoTime(time, jogadores = []) {
  if (!time || (!elencoAtivo(jogadores, time.id).length && !time.tecnico_nome)) return '';
  return `<section class="secao" id="elenco-do-time"><h3>Elenco</h3>${htmlElenco(time, jogadores, { cabecalho: false })}</section>`;
}

function desenhar({ linhas, encerrados, jogos, artilharia, jogadores, time }) {
  prepararChances(jogos); // chance de vitória nos próximos jogos
  const ordenadas = ordenarClassificacao(linhas, encerrados);
  const t = ordenadas.find((l) => l.time_id === timeId);
  if (!t) { mostrarAviso(app, 'Time não encontrado.'); return; }
  document.title = `${t.nome} · Campeonato SRP`;

  const dele = jogos.filter((j) => j.mandante_id === timeId || j.visitante_id === timeId);
  const proximos = dele.filter((j) => j.status !== 'encerrado');
  const resultados = dele.filter((j) => j.status === 'encerrado').reverse();
  const sequencia = forma(dele);

  app.innerHTML = `
    <p><a class="texto-2" href="classificacao.html">← Classificação</a></p>
    <section class="time-topo card card--neon">
      ${escudo(t, 96)}
      <div>
        <h2>${escapar(t.nome)}</h2>
        <p class="texto-2">${t.posicao}º lugar · ${t.pts} ponto${t.pts === 1 ? '' : 's'}</p>
        ${sequencia.length ? `<div class="forma" aria-label="Últimos jogos">${sequencia.map((r) =>
          `<span class="forma__item forma__item--${r}">${r.toUpperCase()}</span>`).join('')}</div>` : ''}
      </div>
    </section>
    ${htmlEstatisticas(t)}
    <div id="avisos-time"></div>
    ${proximos.length ? `<section class="secao"><h3>Próximos jogos</h3>${proximos.map(cartaoJogo).join('')}</section>` : ''}
    ${resultados.length ? `<section class="secao"><h3>Resultados</h3>${resultados.map(cartaoJogo).join('')}</section>` : ''}
    ${htmlElencoDoTime(time, jogadores)}
    ${htmlArtilheiros(artilharia)}`;
  botaoAvisos(document.getElementById('avisos-time'), { timeId, nome: t.nome });
  const elencoDoTime = document.getElementById('elenco-do-time');
  if (elencoDoTime) ligarElenco(elencoDoTime, { time, jogadores, gols: golsPorJogador(artilharia) });
}

async function carregar() {
  try {
    await carregarComCache(`time_${timeId}`, buscar, desenhar);
  } catch (erro) {
    mostrarAviso(app, `Não foi possível carregar o time: ${erro.message}`);
  }
}

montarLayout('classificacao');
document.querySelector('.faixa')?.remove();
if (checarConfiguracao(app)) {
  if (!timeId) mostrarAviso(app, 'Time não informado.');
  else {
    mostrarCarregando(app);
    carregar();
    assinarMudancas(carregar, [...TABELAS_JOGOS, 'jogadores']);
  }
}
