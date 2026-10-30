// Área do clube: o time entra com o código de acesso e fica nela até tocar em "Sair".
// Menu próprio (como o painel do organizador): Meu clube (só o time: números, jogos e artilheiros),
// Elenco, Escalação, Campeonato (geral: tabela e artilharia) e Mural (publica e comenta como o time).
import {
  listarTimes, listarJogos, buscarClassificacao, buscarArtilharia, buscarCampeonato, listarJogadores,
  validarCodigo, enviarFotoElenco, clubeSalvarJogador, clubeApagarJogador, clubeSalvarTecnico, clubeBuscarEscalacao, clubeSalvarEscalacao,
  clubePublicarEscalacao, clubeRetirarEscalacao, publicarPost,
} from '../api.js';
import { criarFeed } from '../feed.js';
import { ordenarClassificacao, posicoesComEmpate } from '../classificacao.js';
import { assinarMudancas, TABELAS_JOGOS } from '../realtime.js';
import { prepararFoto } from '../imagem.js';
import { compartilharImagem, gerarImagem } from '../compartilhar.js';
import { arteEscalacao, inserirArte } from '../artes.js';
import { FORMACOES, FORMACAO_PADRAO, POSICOES, LINHAS, linhaDe, htmlCampo, htmlCarta, avatarJogador } from '../escalacao.js';
import { montarLayout, marcarNav, definirModo, mostrarPerfil, perfilDoClube, checarConfiguracao, mostrarCarregando, mostrarAviso, escapar, escudo, icone, toast, formatarData, horaDoJogo } from '../ui.js';

const app = document.getElementById('app');
const CHAVE_CODIGO = 'mural_codigo'; // o mesmo do mural: entrou no clube, já publica no mural como o time
const CHAVE_TIME = 'clube_time';

const traco = (caminho) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${caminho}</svg>`;
const ICONES = {
  camera: traco('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  mais: traco('<path d="M12 5v14M5 12h14"/>'),
  busca: traco('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>'),
  varinha: traco('<path d="M4 20L16 8M14 4v2M18 8h2M17 5l1.5-1.5M12 6l2 2"/>'),
};
// Menu do clube (embaixo no celular, em cima no computador): navega por #clube / #elenco / ...
const MENU_CLUBE = [
  { id: 'clube', rotulo: 'Meu clube', href: '#clube', icone: 'escudo' },
  { id: 'elenco', rotulo: 'Elenco', href: '#elenco', icone: 'elenco' },
  { id: 'escalacao', rotulo: 'Escalação', href: '#escalacao', icone: 'escalacao' },
  { id: 'campeonato', rotulo: 'Campeonato', href: '#campeonato', icone: 'tabela' },
  { id: 'mural', rotulo: 'Mural', href: '#mural', icone: 'mural' },
];
const TITULOS = { elenco: 'Elenco', escalacao: 'Escalação', campeonato: 'Campeonato', mural: 'Mural' };
const abaDoEndereco = () => (MENU_CLUBE.some((m) => m.id === location.hash.slice(1)) ? location.hash.slice(1) : 'clube');

// Posição da vaga → grupo do elenco (para sugerir e preencher automático)
const GRUPO_DA_VAGA = { GOL: 'GOL', ZAG: 'ZAG', LD: 'LAT', LE: 'LAT', ALD: 'LAT', ALE: 'LAT', VOL: 'VOL', MC: 'MEI', MEI: 'MEI', MD: 'MEI', ME: 'MEI', PD: 'ATA', PE: 'ATA', ATA: 'ATA' };
const nomePosicao = (p) => POSICOES.find(([sigla]) => sigla === p)?.[1] ?? 'Sem posição';
const ORDEM_POSICAO = Object.fromEntries(POSICOES.map(([p], i) => [p, i]));

const estado = { codigo: '', time: null, aba: abaDoEndereco(), subJogos: 'proximos', subGeral: 'tabela', filtroElenco: 'todos', dados: null, escalacao: null, alterada: false, feed: null, desatualizado: false };

// localStorage pode estar bloqueado (aba anônima): nunca deixa quebrar a página
const guardado = (chave) => { try { return localStorage.getItem(chave) ?? ''; } catch { return ''; } };
const guardar = (chave, valor) => { try { localStorage.setItem(chave, valor); } catch { /* sem armazenamento */ } };
const esquecer = (chave) => { try { localStorage.removeItem(chave); } catch { /* sem armazenamento */ } };

function abrirDialogo(html, classe = '') {
  document.querySelector('dialog.dialogo')?.remove();
  const d = Object.assign(document.createElement('dialog'), { className: `dialogo ${classe}`, innerHTML: html });
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-fechar]')) d.close(); });
  document.body.append(d);
  d.showModal();
  return d;
}

// Erro de código (trocado pelo organizador): volta para a entrada
function tratarErro(erro) {
  if (erro.codigoInvalido) { sairDoClube(erro.message); return; }
  toast(erro.message, true);
}

// ---------- Entrada em 2 passos: 1) escolhe o time · 2) o time fica em destaque e pede o código ----------
async function telaEntrada(mensagem = '') {
  document.body.classList.add('painel--login'); // o menu do clube só aparece depois de entrar
  mostrarPerfil({ tipo: 'clube', rotulo: 'Clube', quem: 'Clube · ainda não entrou', contar: false });
  let times;
  try { times = (await listarTimes()).filter((t) => t.ativo !== false); } catch (erro) { mostrarAviso(app, `Não foi possível carregar os times: ${erro.message}`); return; }
  const salvo = times.find((t) => String(t.id) === guardado(CHAVE_TIME));
  if (salvo) pedirCodigo(salvo, times, mensagem); else escolherTime(times, mensagem);
}

function escolherTime(times, mensagem = '') {
  app.innerHTML = `
    <section class="card form clube-entrada">
      <h2>Área do clube</h2>
      <p class="texto-2">Escolha o seu time para entrar.</p>
      ${mensagem ? `<p class="aviso">${escapar(mensagem)}</p>` : ''}
      <div class="escolha-times">${times.map((t) => `
        <button class="escolha-time" type="button" data-escolher-time="${t.id}">${escudo(t, 48)}<span>${escapar(t.nome)}</span></button>`).join('')}</div>
    </section>`;
  app.querySelectorAll('[data-escolher-time]').forEach((b) => b.addEventListener('click', () =>
    pedirCodigo(times.find((t) => t.id === Number(b.dataset.escolherTime)), times)));
}

function pedirCodigo(time, times, mensagem = '') {
  app.innerHTML = `
    <form class="card form clube-entrada clube-entrada--codigo" id="form-clube">
      <div class="clube-entrada__time">
        ${escudo(time, 96)}
        <h2>${escapar(time.nome)}</h2>
        <p class="texto-2">Digite o código de acesso enviado pelo organizador.</p>
      </div>
      <label class="campo">Código de acesso
        <span class="senha">
          <input class="senha__campo" name="codigo" type="password" required maxlength="12" placeholder="••••••"
            autocapitalize="characters" autocomplete="current-password" spellcheck="false">
          <button class="senha__ver" type="button" aria-label="Mostrar código" aria-pressed="false">Mostrar</button>
        </span></label>
      ${mensagem ? `<p class="aviso">${escapar(mensagem)}</p>` : ''}
      <button class="botao botao--grande" type="submit">Entrar</button>
      <button class="link-botao centro" type="button" data-trocar-time>← Escolher outro time</button>
    </form>`;
  const campo = app.querySelector('.senha__campo');
  campo.focus();
  const ver = app.querySelector('.senha__ver');
  ver.addEventListener('click', () => {
    const mostrar = campo.type === 'password';
    campo.type = mostrar ? 'text' : 'password';
    ver.textContent = mostrar ? 'Ocultar' : 'Mostrar';
    ver.setAttribute('aria-pressed', String(mostrar));
    ver.setAttribute('aria-label', mostrar ? 'Ocultar código' : 'Mostrar código');
    campo.focus();
  });
  app.querySelector('[data-trocar-time]').addEventListener('click', () => { esquecer(CHAVE_TIME); escolherTime(times); });
  document.getElementById('form-clube').addEventListener('submit', async (e) => {
    e.preventDefault();
    const codigo = campo.value.trim().toUpperCase();
    const enviar = e.target.querySelector('[type=submit]');
    enviar.disabled = true;
    try {
      const valido = await validarCodigo(codigo);
      if (!valido || valido.time_id !== time.id) throw new Error(`Código não confere com o ${time.nome}.`);
      guardar(CHAVE_CODIGO, codigo);
      guardar(CHAVE_TIME, String(time.id));
      estado.codigo = codigo;
      mostrarCarregando(app);
      await carregar();
    } catch (erro) {
      toast(erro.message, true);
      enviar.disabled = false;
      campo.select();
    }
  });
}

// Código trocado pelo organizador: volta para a entrada do clube (continua no perfil clube)
function sairDoClube(mensagem = '') {
  esquecer(CHAVE_CODIGO);
  Object.assign(estado, { codigo: '', time: null, escalacao: null, alterada: false, feed: null });
  telaEntrada(mensagem);
}

// "Sair" do topo: encerra o perfil clube e volta para a tela inicial
function sairDoPerfil(e) {
  e.preventDefault();
  if (estado.alterada && !confirm('A escalação tem alterações não salvas. Sair mesmo assim?')) return;
  esquecer(CHAVE_CODIGO);
  estado.alterada = false;
  definirModo('');
  location.href = 'index.html?sair';
}

// ---------- Dados ----------
async function buscar() {
  const [campeonato, times, jogos, linhas, artilharia, jogadores] = await Promise.all([
    buscarCampeonato(), listarTimes(), listarJogos(), buscarClassificacao(), buscarArtilharia(), listarJogadores(),
  ]);
  return { campeonato, times, jogos, encerrados: jogos.filter((j) => j.status === 'encerrado'), linhas, artilharia, jogadores };
}

async function carregar() {
  try {
    const dados = await buscar();
    const time = dados.times.find((t) => t.id === Number(guardado(CHAVE_TIME)));
    if (!estado.time) {
      // primeira carga: confere se o código ainda vale (o organizador pode ter gerado outro)
      const valido = await validarCodigo(estado.codigo);
      if (!time || valido?.time_id !== time.id) { sairDoClube('O código não vale mais. Peça o novo ao organizador.'); return; }
    }
    estado.time = time;
    estado.dados = dados;
    estado.desatualizado = false;
    document.body.classList.remove('painel--login');
    definirModo('clube'); // o app passa a abrir direto na área do clube até "Sair"
    perfilDoClube(time);
    if (!estado.escalacao) {
      const salva = await clubeBuscarEscalacao(estado.codigo);
      estado.escalacao = { formacao: salva.formacao ?? FORMACAO_PADRAO, titulares: salva.titulares ?? {}, reservas: salva.reservas ?? [] };
    }
    desenhar();
  } catch (erro) {
    if (erro.codigoInvalido) sairDoClube(erro.message);
    else mostrarAviso(app, `Não foi possível carregar a área do clube: ${erro.message}`);
  }
}

const elenco = () => estado.dados.jogadores
  .filter((j) => j.time_id === estado.time.id && j.ativo !== false)
  .sort((a, b) => (ORDEM_POSICAO[a.posicao] ?? 9) - (ORDEM_POSICAO[b.posicao] ?? 9) || (a.numero ?? 99) - (b.numero ?? 99) || a.nome.localeCompare(b.nome));

const jogosDoTime = () => estado.dados.jogos.filter((j) => j.mandante_id === estado.time.id || j.visitante_id === estado.time.id);
const proximoJogo = () => jogosDoTime().find((j) => j.status !== 'encerrado');
const adversarioDe = (j) => (j.mandante_id === estado.time.id ? j.visitante : j.mandante);
const emCasa = (j) => j.mandante_id === estado.time.id;
function resultadoDe(j) {
  const meus = emCasa(j) ? j.gols_mandante : j.gols_visitante;
  const deles = emCasa(j) ? j.gols_visitante : j.gols_mandante;
  return { meus, deles, letra: meus > deles ? 'v' : meus < deles ? 'd' : 'e' };
}
const diasAte = (iso) => Math.round((new Date(new Date(iso).toDateString()) - new Date(new Date().toDateString())) / 86400000);
const quando = (iso) => { const n = diasAte(iso); return n < 0 ? '' : n === 0 ? 'hoje' : n === 1 ? 'amanhã' : `em ${n} dias`; };

// ---------- Tela ----------
function htmlHero() {
  const { time, dados } = estado;
  const linha = ordenarClassificacao(dados.linhas, dados.encerrados).find((l) => l.time_id === time.id);
  const forma = jogosDoTime().filter((j) => j.status === 'encerrado').reverse().slice(0, 5).map((j) => resultadoDe(j).letra);
  const jogo = proximoJogo();
  return `
    <section class="clube-hero">
      <div class="clube-hero__time">
        ${escudo(time, 96)}
        <div>
          <small>Área do clube</small>
          <h2>${escapar(time.nome)}</h2>
          ${forma.length ? `<div class="forma">${forma.map((r) => `<span class="forma__item forma__item--${r}">${r.toUpperCase()}</span>`).join('')}</div>` : ''}
        </div>
      </div>
      <div class="clube-hero__numeros">
        <div><strong>${linha ? `${linha.posicao}º` : '—'}</strong><small>Posição</small></div>
        <div><strong>${linha?.pts ?? 0}</strong><small>Pontos</small></div>
        <div><strong>${linha?.j ?? 0}</strong><small>Jogos</small></div>
        <div><strong>${elenco().length}</strong><small>Elenco</small></div>
      </div>
      ${jogo ? `
        <div class="clube-hero__proximo">
          <span class="texto-pequeno">Próximo jogo${jogo.data_hora ? ` · ${escapar(quando(jogo.data_hora))}` : ''}</span>
          <div class="clube-hero__confronto">
            ${escudo(time, 32)}<b>×</b>${escudo(adversarioDe(jogo), 32)}
            <span><strong>${escapar(adversarioDe(jogo).nome)}</strong>
              <small>${jogo.data_hora ? `${formatarData(jogo.data_hora)} · ${horaDoJogo(jogo)}` : 'A definir'} · ${emCasa(jogo) ? 'Mandante' : 'Visitante'}</small></span>
          </div>
        </div>` : ''}
    </section>`;
}

// "Meu clube" abre com o cartão do time; as outras seções, com um título curto e o escudo
function htmlTopo() {
  if (estado.aba === 'clube') return htmlHero();
  return `<h2 class="clube-titulo">${escudo(estado.time, 32)}<span><small>${escapar(estado.time.nome)}</small>${TITULOS[estado.aba]}</span></h2>`;
}

function desenhar() {
  marcarNav(estado.aba);
  marcarEscalacaoPendente();
  app.innerHTML = `${htmlTopo()}<div id="aba-clube" class="clube-conteudo clube-conteudo--entrar"></div>`;
  estado.feed = null;
  SECOES[estado.aba](document.getElementById('aba-clube'));
}

// Ponto no item "Escalação" do menu enquanto houver alteração por salvar
function marcarEscalacaoPendente() {
  document.querySelectorAll('[data-nav="escalacao"]').forEach((item) => {
    item.querySelector('.ponto')?.remove();
    if (estado.alterada) item.insertAdjacentHTML('beforeend', '<i class="ponto" aria-label="não salva"></i>');
  });
}

function trocarAba() {
  estado.aba = abaDoEndereco();
  window.scrollTo(0, 0);
  if (!estado.time) { marcarNav(estado.aba); return; }
  if (estado.desatualizado) carregar(); else desenhar();
}

// ---------- Seções ----------
function htmlPartida(j) {
  const adv = adversarioDe(j);
  const data = j.data_hora ? new Date(j.data_hora) : null;
  const encerrado = j.status === 'encerrado';
  const r = encerrado ? resultadoDe(j) : null;
  const direita = encerrado
    ? `<span class="partida__placar"><b>${r.meus} × ${r.deles}</b><i class="forma__item forma__item--${r.letra}">${r.letra.toUpperCase()}</i></span>`
    : j.status === 'ao_vivo'
      ? `<span class="partida__placar"><b>${j.gols_mandante ?? 0} × ${j.gols_visitante ?? 0}</b><i class="selo selo--aovivo">Ao vivo</i></span>`
      : data && (j.horario_definido === false ? new Date(data).setHours(23, 59) : data) < new Date()
        ? '<span class="partida__hora">—<small>aguardando resultado</small></span>'
        : `<span class="partida__hora">${data ? horaDoJogo(j) : '—'}<small>${data ? escapar(quando(j.data_hora)) : ''}</small></span>`;
  return `
    <div class="partida">
      <span class="partida__data">${data ? `<b>${data.getDate()}</b>${data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}` : '—'}</span>
      <span class="partida__adv">${escudo(adv, 32)}<span><strong>${escapar(adv.nome)}</strong>
        <small>R${j.rodada?.numero ?? '?'} · ${emCasa(j) ? 'Mandante' : 'Visitante'}</small></span></span>
      ${direita}
    </div>`;
}

// Artilheiros do clube (pódio + lista), com a posição de cada um na artilharia geral
function htmlArtilheirosDoClube() {
  const fotos = new Map(estado.dados.jogadores.map((j) => [j.id, j]));
  const geral = posicoesComEmpate(estado.dados.artilharia.map((a) => ({ ...a, gols: Number(a.gols) })));
  const doTime = geral.filter((a) => a.time_id === estado.time.id);
  if (!doTime.length) return '<p class="vazio">Nenhum gol do clube ainda.</p>';
  return `
    <div class="podio">${doTime.slice(0, 3).map((a, i) => `
      <div class="podio__item podio__item--${i + 1}">
        ${avatarJogador(fotos.get(a.jogador_id)?.foto_url ? fotos.get(a.jogador_id) : { numero: `${i + 1}º` }, 'avatar avatar--medio')}
        <strong>${escapar(a.jogador)}</strong><span class="podio__gols">${a.gols}<small> gol${a.gols === 1 ? '' : 's'}</small></span>
        <small class="texto-2">${a.posicao}º no geral</small>
      </div>`).join('')}</div>
    ${doTime.length > 3 ? `<ol class="lista">${doTime.slice(3).map((a) => `
      <li class="artilheiro"><span class="artilheiro__pos">${a.posicao}º</span>
        <div><div class="artilheiro__nome">${escapar(a.jogador)}</div></div><span class="artilheiro__gols">${a.gols}</span></li>`).join('')}</ol>` : ''}`;
}

function htmlTabelaGeral() {
  const linhas = ordenarClassificacao(estado.dados.linhas, estado.dados.encerrados);
  return `
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>Pos</th><th>Time</th><th>PTS</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th></tr></thead>
      <tbody>${linhas.map((t) => `
        <tr class="${t.time_id === estado.time.id ? 'linha--destaque' : ''}">
          <td class="pos">${t.posicao}º</td>
          <td class="time"><span class="time__nome">${escudo(t, 32)} ${escapar(t.nome)}</span></td>
          <td class="pts">${t.pts}</td><td>${t.j}</td><td>${t.v}</td><td>${t.e}</td><td>${t.d}</td><td>${t.sg}</td>
        </tr>`).join('')}</tbody></table></div>`;
}

function htmlArtilhariaGeral() {
  const geral = posicoesComEmpate(estado.dados.artilharia.map((a) => ({ ...a, gols: Number(a.gols) }))).slice(0, 20);
  return geral.length ? `<ol class="lista">${geral.map((a) => `
    <li class="artilheiro${a.time_id === estado.time.id ? ' linha--destaque' : ''}"><span class="artilheiro__pos">${a.posicao}º</span>
      <div><div class="artilheiro__nome">${escapar(a.jogador)}</div><div class="artilheiro__time">${escudo({ nome: a.time, escudo_url: a.escudo_url }, 32)} ${escapar(a.time)}</div></div>
      <span class="artilheiro__gols">${a.gols}</span></li>`).join('')}</ol>` : '<p class="vazio">Nenhum gol no campeonato ainda.</p>';
}

const SECOES = {
  // Só o time: jogos (calendário e resultados) e artilheiros do clube
  clube(alvo) {
    const todos = jogosDoTime();
    const lista = estado.subJogos === 'proximos' ? todos.filter((j) => j.status !== 'encerrado') : todos.filter((j) => j.status === 'encerrado').reverse();
    alvo.innerHTML = `
      <section class="secao">
        <h3>Jogos do clube</h3>
        <div class="segmentos" role="tablist">
          <button class="segmento${estado.subJogos === 'proximos' ? ' segmento--ativo' : ''}" data-sub="proximos">Calendário</button>
          <button class="segmento${estado.subJogos === 'resultados' ? ' segmento--ativo' : ''}" data-sub="resultados">Resultados</button>
        </div>
        <div class="partidas">${lista.map(htmlPartida).join('') || `<p class="vazio">${estado.subJogos === 'proximos' ? 'Nenhum jogo agendado.' : 'Nenhum jogo encerrado ainda.'}</p>`}</div>
      </section>
      <section class="secao">
        <h3>Artilheiros do clube</h3>
        ${htmlArtilheirosDoClube()}
      </section>`;
    alvo.querySelectorAll('[data-sub]').forEach((b) => b.addEventListener('click', () => { estado.subJogos = b.dataset.sub; SECOES.clube(alvo); }));
  },

  // Geral: tabela e artilharia de todos os times (o clube fica destacado)
  campeonato(alvo) {
    alvo.innerHTML = `
      <div class="segmentos" role="tablist">
        <button class="segmento${estado.subGeral === 'tabela' ? ' segmento--ativo' : ''}" data-geral="tabela">Classificação</button>
        <button class="segmento${estado.subGeral === 'artilharia' ? ' segmento--ativo' : ''}" data-geral="artilharia">Artilharia geral</button>
      </div>
      ${estado.subGeral === 'tabela' ? htmlTabelaGeral() : htmlArtilhariaGeral()}`;
    alvo.querySelectorAll('[data-geral]').forEach((b) => b.addEventListener('click', () => { estado.subGeral = b.dataset.geral; SECOES.campeonato(alvo); }));
  },

  elenco(alvo) {
    const { time } = estado;
    const todos = elenco();
    const grupos = LINHAS.find(([id]) => id === estado.filtroElenco)?.[2];
    const jogadores = grupos ? todos.filter((j) => grupos.includes(j.posicao)) : todos;
    alvo.innerHTML = `
      <button class="tecnico" data-editar-tecnico>
        ${avatarJogador({ foto_url: time.tecnico_foto_url, numero: 'T' }, 'avatar avatar--medio')}
        <span><small>Técnico</small><strong>${escapar(time.tecnico_nome || 'Cadastrar técnico')}</strong></span>
        <span class="tecnico__editar">Editar</span>
      </button>
      <div class="chips" aria-label="Filtrar por posição">${LINHAS.map(([id, rotulo, g]) => {
        const qtd = g ? todos.filter((j) => g.includes(j.posicao)).length : todos.length;
        return `<button class="chip${estado.filtroElenco === id ? ' chip--ativo' : ''}" data-filtro="${id}">${rotulo} <small>${qtd}</small></button>`;
      }).join('')}</div>
      <div class="cartas">
        ${jogadores.map((j) => htmlCarta(j, `data-editar-jogador="${j.id}"`)).join('')}
        <button class="carta carta--nova" data-novo-jogador>${ICONES.mais}<span>Adicionar jogador</span></button>
      </div>`;
    alvo.querySelector('[data-editar-tecnico]').addEventListener('click', dialogoTecnico);
    alvo.querySelector('[data-novo-jogador]').addEventListener('click', () => dialogoJogador({ posicao: grupos?.[0] ?? '' }));
    alvo.querySelectorAll('[data-filtro]').forEach((b) => b.addEventListener('click', () => { estado.filtroElenco = b.dataset.filtro; SECOES.elenco(alvo); }));
    alvo.querySelectorAll('[data-editar-jogador]').forEach((b) =>
      b.addEventListener('click', () => dialogoJogador(todos.find((j) => j.id === Number(b.dataset.editarJogador)))));
  },

  escalacao(alvo) {
    const esc = estado.escalacao;
    const jogadores = elenco();
    const ativos = new Set(jogadores.map((j) => j.id));
    for (const [vaga, id] of Object.entries(esc.titulares)) if (!ativos.has(Number(id))) delete esc.titulares[vaga]; // saiu do elenco
    esc.reservas = esc.reservas.filter((id) => ativos.has(id));
    const titulares = new Set(Object.values(esc.titulares).map(Number));
    const banco = jogadores.filter((j) => !titulares.has(j.id));

    alvo.innerHTML = `
      <div class="escalacao__barra">
        <label class="seletor"><span class="sr-only">Formação</span>
          <select data-formacao>${Object.keys(FORMACOES).map((f) => `<option${f === esc.formacao ? ' selected' : ''}>${f}</option>`).join('')}</select></label>
        <span class="escalacao__contador${titulares.size === 11 ? ' escalacao__contador--ok' : ''}">${titulares.size}/11</span>
        <button class="botao botao--secundario botao--icone" data-auto title="Preencher automático pelas posições">${ICONES.varinha}<span>Auto</span></button>
      </div>
      ${jogadores.length ? '' : '<p class="aviso">Cadastre os jogadores na aba Elenco para escalar o time.</p>'}
      ${htmlCampo({ formacao: esc.formacao, titulares: esc.titulares, jogadores, interativo: true })}
      <p class="centro texto-pequeno"><button class="link-botao" data-limpar>Limpar escalação</button></p>
      <section class="secao">
        <h3>Banco <small class="texto-2">${esc.reservas.length} reserva${esc.reservas.length === 1 ? '' : 's'} · toque para marcar</small></h3>
        <div class="banco">${banco.map((j) => `
          <button class="banco__item${esc.reservas.includes(j.id) ? ' banco__item--ativo' : ''}" data-reserva="${j.id}" aria-pressed="${esc.reservas.includes(j.id)}">
            ${avatarJogador(j, 'avatar')}<span>${escapar(j.nome.split(' ')[0])}</span></button>`).join('') || '<span class="texto-2 texto-pequeno">Todos os jogadores estão no campo.</span>'}</div>
      </section>
      ${htmlPublicacao()}
      <div class="barra-acoes">
        <button class="botao botao--secundario" data-salvar-escalacao>${estado.alterada ? 'Salvar alterações' : 'Salvo ✔'}</button>
        <button class="botao" data-compartilhar-escalacao>${icone('whatsapp')} Compartilhar</button>
        <button class="botao botao--secundario barra-acoes__largo" data-mural-escalacao>${icone('mural')} Publicar no mural do app</button>
      </div>`;

    const mudou = () => { estado.alterada = true; marcarEscalacaoPendente(); SECOES.escalacao(alvo); };
    alvo.querySelector('[data-formacao]').addEventListener('change', (e) => { esc.formacao = e.target.value; mudou(); });
    alvo.querySelectorAll('[data-vaga]').forEach((b) => b.addEventListener('click', () => escolherJogador(Number(b.dataset.vaga), jogadores, mudou)));
    alvo.querySelectorAll('[data-reserva]').forEach((b) => b.addEventListener('click', () => {
      const id = Number(b.dataset.reserva);
      esc.reservas = esc.reservas.includes(id) ? esc.reservas.filter((r) => r !== id) : [...esc.reservas, id];
      mudou();
    }));
    alvo.querySelector('[data-auto]').addEventListener('click', () => { preencherAutomatico(jogadores); mudou(); toast('Time escalado pelas posições. Ajuste à vontade.'); });
    alvo.querySelector('[data-limpar]').addEventListener('click', () => {
      if (confirm('Tirar todos os jogadores do campo e do banco?')) { esc.titulares = {}; esc.reservas = []; mudou(); }
    });
    alvo.querySelector('[data-salvar-escalacao]').addEventListener('click', () => salvarEscalacao(alvo));
    alvo.querySelector('[data-publicar-escalacao]')?.addEventListener('click', () => publicarEscalacao(alvo, true));
    alvo.querySelector('[data-retirar-escalacao]')?.addEventListener('click', () => publicarEscalacao(alvo, false));
    alvo.querySelector('[data-compartilhar-escalacao]').addEventListener('click', (e) => compartilharEscalacao(e.currentTarget, jogadores));
    alvo.querySelector('[data-mural-escalacao]').addEventListener('click', (e) => publicarEscalacaoNoMural(e.currentTarget, jogadores));
  },

  // Mural geral dentro da área do clube: publica, curte e comenta como o time (sem digitar nome)
  async mural(alvo) {
    mostrarCarregando(alvo);
    const feed = criarFeed(alvo, { clube: { codigo: estado.codigo, time: estado.time } });
    estado.feed = feed;
    try { await feed.carregar(); } catch (erro) { tratarErro(erro); }
  },
};


// ---------- Escalação ----------
const ondeEsta = (id) => Object.entries(estado.escalacao.titulares).find(([, j]) => Number(j) === id)?.[0];

function preencherAutomatico(jogadores) {
  const esc = estado.escalacao;
  const vagas = FORMACOES[esc.formacao];
  const usados = new Set();
  const titulares = {};
  vagas.forEach(([rotulo], i) => { // 1º: quem joga na posição da vaga
    const j = jogadores.find((x) => !usados.has(x.id) && x.posicao === GRUPO_DA_VAGA[rotulo]);
    if (j) { titulares[i] = j.id; usados.add(j.id); }
  });
  vagas.forEach(([rotulo], i) => { // 2º: completa com quem sobrou (goleiro só no gol)
    if (titulares[i] != null) return;
    const j = jogadores.find((x) => !usados.has(x.id) && (rotulo === 'GOL' || x.posicao !== 'GOL'));
    if (j) { titulares[i] = j.id; usados.add(j.id); }
  });
  esc.titulares = titulares;
  esc.reservas = esc.reservas.filter((id) => !usados.has(id));
}

function escolherJogador(vaga, jogadores, mudou) {
  const esc = estado.escalacao;
  const rotulo = FORMACOES[esc.formacao][vaga][0];
  const grupo = GRUPO_DA_VAGA[rotulo];
  const atual = esc.titulares[vaga] != null ? Number(esc.titulares[vaga]) : null;
  let filtro = jogadores.some((j) => j.posicao === grupo) ? 'sugeridos' : 'todos';
  let busca = '';

  const d = abrirDialogo(`
    <div class="form folha">
      <div class="folha__topo"><h2>Escolher · ${escapar(rotulo)}</h2><button class="botao botao--secundario" data-fechar>Fechar</button></div>
      <label class="busca">${ICONES.busca}<input type="search" placeholder="Buscar jogador" aria-label="Buscar jogador"></label>
      <div class="segmentos">
        <button class="segmento" data-filtro-folha="sugeridos">${escapar(nomePosicao(grupo))}s</button>
        <button class="segmento" data-filtro-folha="todos">Todos</button>
      </div>
      <div class="cartas cartas--folha" data-lista></div>
      ${atual != null ? '<button class="botao botao--secundario" data-vazia>Deixar posição vazia</button>' : ''}
    </div>`, 'dialogo--folha');

  const lista = d.querySelector('[data-lista]');
  const pintar = () => {
    d.querySelectorAll('[data-filtro-folha]').forEach((b) => b.classList.toggle('segmento--ativo', b.dataset.filtroFolha === filtro));
    const termo = busca.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    const visiveis = jogadores.filter((j) => (filtro === 'todos' || j.posicao === grupo)
      && (!termo || `${j.nome} ${j.numero ?? ''}`.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().includes(termo)));
    lista.innerHTML = visiveis.map((j) => {
      const onde = ondeEsta(j.id);
      const marca = j.id === atual ? '<span class="carta__marca">Nesta posição</span>'
        : onde != null ? `<span class="carta__marca">No campo · ${escapar(FORMACOES[esc.formacao][onde][0])}</span>`
          : esc.reservas.includes(j.id) ? '<span class="carta__marca">No banco</span>' : '';
      return htmlCarta(j, `data-jogador="${j.id}"${j.id === atual ? ' aria-current="true"' : ''}`, marca);
    }).join('') || '<p class="vazio">Nenhum jogador encontrado.</p>';
  };
  d.querySelector('input[type=search]').addEventListener('input', (e) => { busca = e.target.value; pintar(); });
  d.addEventListener('click', (e) => {
    const f = e.target.closest('[data-filtro-folha]');
    if (f) { filtro = f.dataset.filtroFolha; pintar(); return; }
    if (e.target.closest('[data-vazia]')) { delete esc.titulares[vaga]; d.close(); mudou(); return; }
    const item = e.target.closest('[data-jogador]');
    if (!item) return;
    const id = Number(item.dataset.jogador);
    const anterior = ondeEsta(id);
    if (anterior != null && anterior !== String(vaga)) { // já estava no campo: troca de lugar com quem está aqui
      if (atual != null) esc.titulares[anterior] = atual; else delete esc.titulares[anterior];
    }
    esc.titulares[vaga] = id;
    esc.reservas = esc.reservas.filter((r) => r !== id);
    d.close();
    mudou();
  });
  pintar();
}

// Publicar a escalação no card do próximo jogo (a torcida vê em "Escalações")
const publicadaNoProximo = () => (proximoJogo()?.escalacoes ?? []).some((e) => e.time_id === estado.time.id);
function htmlPublicacao() {
  const jogo = proximoJogo();
  if (!jogo) return '';
  const adv = escapar(adversarioDe(jogo).nome);
  return publicadaNoProximo()
    ? `<div class="publicacao publicacao--ok"><span>📢 Escalação publicada no jogo contra <b>${adv}</b>${estado.alterada ? ' (salve e publique de novo para atualizar)' : ''}.</span>
        <span class="publicacao__acoes"><button class="botao botao--secundario" data-publicar-escalacao>Atualizar</button>
        <button class="link-botao" data-retirar-escalacao>Retirar</button></span></div>`
    : `<div class="publicacao"><span>A torcida ainda não vê esta escalação.</span>
        <button class="botao" data-publicar-escalacao>📢 Publicar no jogo contra ${adv}</button></div>`;
}

async function publicarEscalacao(alvo, publicar) {
  const jogo = proximoJogo();
  try {
    if (publicar) {
      if (Object.keys(estado.escalacao.titulares).length < 11 && !confirm('A escalação ainda não tem 11 jogadores. Publicar assim mesmo?')) return;
      if (estado.alterada) await clubeSalvarEscalacao(estado.codigo, estado.escalacao); // publica o que está na tela
      estado.alterada = false;
      await clubePublicarEscalacao(estado.codigo, jogo.id);
      toast('Escalação publicada para a torcida ✔');
    } else {
      if (!confirm('Retirar a escalação do jogo? A torcida deixa de ver.')) return;
      await clubeRetirarEscalacao(estado.codigo, jogo.id);
      toast('Escalação retirada');
    }
    await carregar();
  } catch (erro) { tratarErro(erro); }
}

async function salvarEscalacao(alvo) {
  try {
    await clubeSalvarEscalacao(estado.codigo, estado.escalacao);
    estado.alterada = false;
    marcarEscalacaoPendente();
    toast('Escalação salva ✔');
    SECOES.escalacao(alvo);
  } catch (erro) { tratarErro(erro); }
}

async function compartilharEscalacao(botao, jogadores) {
  if (Object.keys(estado.escalacao.titulares).length < 11 && !confirm('A escalação ainda não tem 11 jogadores. Compartilhar assim mesmo?')) return;
  botao.disabled = true;
  toast('Gerando imagem...');
  try {
    const arte = inserirArte('arte-escalacao', arteEscalacao(estado.dados.campeonato, estado.time, estado.escalacao, jogadores, proximoJogo()));
    await compartilharImagem(arte, `escalacao-${estado.time.sigla ?? 'time'}.jpg`.toLowerCase());
  } catch (erro) {
    toast(`Não foi possível gerar a imagem: ${erro.message}`, true);
  } finally {
    botao.disabled = false;
  }
}

// Publica a arte da escalação no mural do app (entra depois da aprovação do organizador)
async function publicarEscalacaoNoMural(botao, jogadores) {
  if (Object.keys(estado.escalacao.titulares).length < 11 && !confirm('A escalação ainda não tem 11 jogadores. Publicar assim mesmo?')) return;
  const jogo = proximoJogo();
  botao.disabled = true;
  toast('Gerando imagem...');
  try {
    const arte = inserirArte('arte-escalacao', arteEscalacao(estado.dados.campeonato, estado.time, estado.escalacao, jogadores, jogo));
    arte.classList.remove('arte--story'); // no mural vai sempre no formato post (4:5)
    const foto = await prepararFoto(await gerarImagem(arte));
    const descricao = jogo ? `📋 Escalação do ${estado.time.nome} para o jogo contra ${adversarioDe(jogo).nome}. Bora! ⚽` : `📋 Escalação do ${estado.time.nome}. Bora! ⚽`;
    toast('Publicando no mural...');
    await publicarPost({ codigo: estado.codigo, descricao, foto, jogoId: jogo?.id ?? null });
    toast('Enviada! Aparece no mural depois da aprovação do organizador.');
  } catch (erro) {
    tratarErro(erro);
  } finally {
    botao.disabled = false;
  }
}

// ---------- Elenco ----------
function campoFoto(urlAtual, rotulo) {
  return `
    <label class="foto-escolha">
      <input type="file" name="foto" accept="image/*" class="sr-only">
      <span class="foto-escolha__circulo">${urlAtual ? `<img src="${escapar(urlAtual)}" alt="">` : ICONES.camera}</span>
      <span class="texto-pequeno">${urlAtual ? 'Trocar foto' : rotulo}</span>
    </label>`;
}

function ligarPrevia(d) {
  d.querySelector('[name=foto]').addEventListener('change', (e) => {
    const arquivo = e.target.files[0];
    if (arquivo) d.querySelector('.foto-escolha__circulo').innerHTML = `<img src="${URL.createObjectURL(arquivo)}" alt="Prévia da foto">`;
  });
}

async function fotoEnviada(d, urlAtual) {
  const arquivo = d.querySelector('[name=foto]').files[0];
  if (!arquivo) return urlAtual ?? null;
  toast('Enviando foto...');
  return enviarFotoElenco(estado.time.id, await prepararFoto(arquivo, { lado: 400, quadrada: true }));
}

function dialogoJogador(jogador) {
  const d = abrirDialogo(`
    <form class="form">
      <h2>${jogador.id ? 'Editar jogador' : 'Novo jogador'}</h2>
      ${campoFoto(jogador.foto_url, 'Adicionar foto')}
      <label class="campo">Nome*<input name="nome" required maxlength="40" autocomplete="off" value="${escapar(jogador.nome ?? '')}"></label>
      <label class="campo campo--curto">Número<input name="numero" type="number" min="0" max="99" inputmode="numeric" value="${jogador.numero ?? ''}"></label>
      <fieldset class="opcoes"><legend>Posição</legend>${POSICOES.map(([p, nome]) => `
        <label class="opcao opcao--${linhaDe(p)}"><input type="radio" name="posicao" value="${p}"${jogador.posicao === p ? ' checked' : ''}><span>${nome}</span></label>`).join('')}
      </fieldset>
      <div class="form__acoes">
        ${jogador.id ? '<button class="botao botao--perigo" type="button" data-remover>Remover</button>' : ''}
        <button class="botao botao--secundario" type="button" data-fechar>Cancelar</button>
        <button class="botao" type="submit">Salvar</button>
      </div>
    </form>`);
  ligarPrevia(d);
  d.querySelector('[data-remover]')?.addEventListener('click', async () => {
    if (!confirm(`Remover ${jogador.nome} do elenco? Os gols dele continuam na artilharia.`)) return;
    try { await clubeApagarJogador(estado.codigo, jogador.id); d.close(); toast('Jogador removido'); await carregar(); } catch (erro) { tratarErro(erro); }
  });
  d.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = new FormData(e.target);
    const salvar = e.target.querySelector('[type=submit]');
    salvar.disabled = true;
    try {
      const fotoUrl = await fotoEnviada(d, jogador.foto_url);
      await clubeSalvarJogador(estado.codigo, {
        id: jogador.id, nome: String(dados.get('nome')).trim(), foto_url: fotoUrl,
        numero: dados.get('numero') === '' ? null : Number(dados.get('numero')), posicao: dados.get('posicao') ?? '',
      });
      d.close();
      toast('Jogador salvo ✔');
      await carregar();
    } catch (erro) {
      tratarErro(erro);
      salvar.disabled = false;
    }
  });
}

function dialogoTecnico() {
  const { time } = estado;
  const d = abrirDialogo(`
    <form class="form">
      <h2>Técnico</h2>
      ${campoFoto(time.tecnico_foto_url, 'Adicionar foto')}
      <label class="campo">Nome<input name="nome" maxlength="40" autocomplete="off" value="${escapar(time.tecnico_nome ?? '')}"></label>
      <div class="form__acoes">
        <button class="botao botao--secundario" type="button" data-fechar>Cancelar</button>
        <button class="botao" type="submit">Salvar</button>
      </div>
    </form>`);
  ligarPrevia(d);
  d.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const salvar = e.target.querySelector('[type=submit]');
    salvar.disabled = true;
    try {
      const fotoUrl = await fotoEnviada(d, time.tecnico_foto_url);
      await clubeSalvarTecnico(estado.codigo, new FormData(e.target).get('nome'), fotoUrl);
      d.close();
      toast('Técnico salvo ✔');
      await carregar();
    } catch (erro) {
      tratarErro(erro);
      salvar.disabled = false;
    }
  });
}

// ---------- Início ----------
// A marca do topo leva para "Meu clube": só "Sair" tira da área do clube
montarLayout(estado.aba, { paginas: MENU_CLUBE, inicio: '#clube' });
document.querySelector('.faixa')?.remove();
document.getElementById('btn-sair-header').addEventListener('click', sairDoPerfil);
window.addEventListener('hashchange', trocarAba);
if (checarConfiguracao(app)) {
  estado.codigo = guardado(CHAVE_CODIGO);
  if (estado.codigo && guardado(CHAVE_TIME)) { mostrarCarregando(app); carregar(); } else telaEntrada();
  // Realtime: não redesenha com uma janela aberta (alguém editando o elenco) nem com a escalação por salvar.
  // No Mural só o feed se atualiza; o resto fica marcado para recarregar ao trocar de seção.
  assinarMudancas(() => {
    if (!estado.time) return;
    if (estado.aba === 'mural' || document.querySelector('dialog[open]') || estado.alterada) { estado.desatualizado = true; return; }
    carregar();
  }, [...TABELAS_JOGOS, 'jogadores']);
  assinarMudancas(() => { if (estado.aba === 'mural' && estado.feed) estado.feed.carregar().catch(tratarErro); }, ['posts', 'comentarios']);
  window.addEventListener('beforeunload', (e) => { if (estado.alterada) e.preventDefault(); });
}
