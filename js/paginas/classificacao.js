import { buscarCampeonato, buscarClassificacao, listarJogosEncerrados, rankingCraques } from '../api.js';
import { htmlRankings } from '../rankings.js';
import { ordenarClassificacao } from '../classificacao.js';
import { assinarMudancas } from '../realtime.js';
import { carregarComCache } from '../cache.js';
import { compartilharImagem } from '../compartilhar.js';
import { arteClassificacao, inserirArte } from '../artes.js';
import { htmlTabela } from '../tabelas.js';
import { botaoCompartilhar, montarLayout, checarConfiguracao, mostrarCarregando, mostrarAviso } from '../ui.js';

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
  assinarMudancas(carregar, ['jogos', 'times']);
  botaoCompartilhar(async () => {
    if (!dados) return;
    await compartilharImagem(inserirArte('arte-classificacao', arteClassificacao(dados.campeonato, dados.ordenadas)), 'classificacao.jpg');
  });
}
