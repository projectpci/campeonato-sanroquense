import { buscarCampeonato, buscarClassificacao, listarJogosEncerrados, rankingCraques } from '../api.js';
import { htmlRankings } from '../rankings.js';
import { ordenarClassificacao } from '../classificacao.js';
import { assinarMudancas } from '../realtime.js';
import { carregarComCache } from '../cache.js';
import { compartilharImagem } from '../compartilhar.js';
import { arteClassificacao, inserirArte } from '../artes.js';
import { botaoCompartilhar, montarLayout, checarConfiguracao, mostrarCarregando, mostrarAviso, escapar, escudo, icone } from '../ui.js';

const CLASSES_PODIO = ['ouro', 'prata', 'bronze'];
const sinal = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

function celulaPosicao(posicao) {
  const classe = CLASSES_PODIO[posicao - 1];
  return classe
    ? `<td class="pos ${classe}">${icone('coroa')} ${posicao}º</td>`
    : `<td class="pos">${posicao}º</td>`;
}

function htmlTabela(linhas) {
  const corpo = linhas.map((t) => `
    <tr>
      ${celulaPosicao(t.posicao)}
      <td class="time"><a class="time__nome" href="time.html?id=${t.time_id}">${escudo(t, 32)} ${escapar(t.nome)}</a></td>
      <td class="pts">${t.pts}</td>
      <td>${t.j}</td><td>${t.v}</td><td>${t.e}</td><td>${t.d}</td>
      <td class="col-extra">${t.gp}</td><td class="col-extra">${t.gc}</td>
      <td class="${t.sg > 0 ? 'positivo' : t.sg < 0 ? 'negativo' : ''}">${sinal(t.sg)}</td>
    </tr>`).join('');
  return `
    <div class="tabela-rolagem">
      <table class="tabela">
        <thead><tr>
          <th>Pos</th><th>Time</th><th>PTS</th><th>J</th><th>V</th><th>E</th><th>D</th>
          <th class="col-extra">GP</th><th class="col-extra">GC</th><th>SG</th>
        </tr></thead>
        <tbody>${corpo}</tbody>
      </table>
    </div>`;
}

const app = document.getElementById('app');
let dados = null;

const buscar = async () => {
  const [campeonato, linhas, jogos, craques] = await Promise.all([
    buscarCampeonato(), buscarClassificacao(), listarJogosEncerrados(), rankingCraques().catch(() => []),
  ]);
  return { campeonato, linhas, jogos, craques };
};

function desenhar({ campeonato, linhas, jogos, craques = [] }) {
    const ordenadas = ordenarClassificacao(linhas, jogos);
    dados = { campeonato, ordenadas };
    const ultima = jogos.map((j) => j.atualizado_em).filter(Boolean).sort().pop();
    const atualizado = ultima
      ? `Atualizado em ${new Date(ultima).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${new Date(ultima).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      : 'Nenhum jogo encerrado ainda';
    app.innerHTML = `
      ${htmlTabela(ordenadas)}
      <p class="texto-2 texto-pequeno">${atualizado}</p>
      <p class="texto-2 texto-pequeno">J = Jogos · V = Vitórias · E = Empates · D = Derrotas · GP = Gols pró · GC = Gols contra · SG = Saldo de gols · PTS = Pontos</p>
      ${htmlRankings(ordenadas, jogos, craques)}`;
}

async function carregar() {
  try {
    await carregarComCache('classificacao', buscar, desenhar);
  } catch (erro) {
    mostrarAviso(app, `Não foi possível carregar a classificação: ${erro.message}`);
  }
}

montarLayout('classificacao');
if (checarConfiguracao(app)) {
  mostrarCarregando(app);
  carregar();
  assinarMudancas(carregar);
  botaoCompartilhar(async () => {
    if (!dados) return;
    await compartilharImagem(inserirArte('arte-classificacao', arteClassificacao(dados.campeonato, dados.ordenadas)), 'classificacao.jpg');
  });
}
