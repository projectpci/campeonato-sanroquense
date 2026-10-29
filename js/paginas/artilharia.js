import { buscarArtilharia, buscarCampeonato, listarTimes, listarJogos } from '../api.js';
import { posicoesComEmpate } from '../classificacao.js';
import { assinarMudancas } from '../realtime.js';
import { carregarComCache } from '../cache.js';
import { compartilharImagem } from '../compartilhar.js';
import { arteArtilharia, inserirArte } from '../artes.js';
import { botaoCompartilhar, montarLayout, checarConfiguracao, mostrarCarregando, mostrarAviso, escapar, escudo, icone } from '../ui.js';

const CLASSES_PODIO = ['ouro', 'prata', 'bronze'];
const app = document.getElementById('app');
let timeFiltro = '';
let dados = null;

function linhaArtilheiro(a) {
  const classe = CLASSES_PODIO[a.posicao - 1];
  return `
    <li class="artilheiro${a.posicao === 1 ? ' artilheiro--ouro' : ''}">
      <span class="artilheiro__pos ${classe ?? ''}">${classe ? icone('coroa') : ''}${a.posicao}º</span>
      <div>
        <div class="artilheiro__nome">${escapar(a.jogador)}</div>
        <div class="artilheiro__time">${escudo({ nome: a.time, escudo_url: a.escudo_url }, 32)} ${escapar(a.time)}</div>
      </div>
      <span class="artilheiro__gols">${a.gols}</span>
    </li>`;
}

// Jogos encerrados cujos gols não têm autor lançado (ex.: rodadas jogadas antes do app)
function jogosSemAutor(jogos) {
  const filtro = Number(timeFiltro) || null;
  return jogos.filter((j) => j.status === 'encerrado' && (!filtro || j.mandante_id === filtro || j.visitante_id === filtro)
    && (j.gols ?? []).reduce((s, g) => s + g.quantidade, 0) < (j.gols_mandante ?? 0) + (j.gols_visitante ?? 0)).length;
}

const buscar = async () => {
  const [artilheiros, times, campeonato, jogos] = await Promise.all([buscarArtilharia(timeFiltro || undefined), listarTimes(), buscarCampeonato(), listarJogos()]);
  return { artilheiros, times, campeonato, semAutor: jogosSemAutor(jogos) };
};

function desenhar({ artilheiros, times, campeonato, semAutor = 0 }) {
    const opcoes = times.map((t) => `<option value="${t.id}"${String(t.id) === timeFiltro ? ' selected' : ''}>${escapar(t.nome)}</option>`).join('');
    // A view já ordena por gols; empates dividem a posição (dentro do filtro atual)
    const lista = posicoesComEmpate(artilheiros.map((a) => ({ ...a, gols: Number(a.gols) })));
    dados = { campeonato, lista };
    app.innerHTML = `
      <label class="filtro"><span class="sr-only">Filtrar por time</span>
        <select id="filtro-time"><option value="">Todos os times</option>${opcoes}</select></label>
      ${lista.length
        ? `<ol class="lista">${lista.map(linhaArtilheiro).join('')}</ol>`
        : '<p class="carregando">Nenhum gol registrado ainda.</p>'}
      ${semAutor ? `<p class="aviso texto-pequeno">${semAutor} jogo${semAutor === 1 ? '' : 's'} sem autor dos gols registrado (rodadas anteriores ao app): esses gols contam na tabela, mas não na artilharia.</p>` : ''}
      <p class="texto-2 texto-pequeno">Gols contra não entram na artilharia.</p>`;
    document.getElementById('filtro-time').addEventListener('change', (e) => {
      timeFiltro = e.target.value;
      carregar();
    });
}

async function carregar() {
  try {
    await carregarComCache(`artilharia_${timeFiltro || 'todos'}`, buscar, desenhar);
  } catch (erro) {
    mostrarAviso(app, `Não foi possível carregar a artilharia: ${erro.message}`);
  }
}

montarLayout('artilharia');
if (checarConfiguracao(app)) {
  mostrarCarregando(app);
  carregar();
  assinarMudancas(carregar);
  botaoCompartilhar(async () => {
    if (!dados?.lista.length) throw new Error('nenhum gol registrado ainda');
    await compartilharImagem(inserirArte('arte-artilharia', arteArtilharia(dados.campeonato, dados.lista)), 'artilharia.jpg');
  });
}
