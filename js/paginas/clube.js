// Área do clube: o time entra com o código de acesso (o mesmo do mural) e tem jogos, tabela, artilharia,
// elenco (técnico e jogadores com foto), escalação para compartilhar e o mural do clube.
import {
  listarTimes, listarJogos, buscarClassificacao, listarJogosEncerrados, buscarArtilharia, buscarCampeonato, listarJogadores,
  validarCodigo, enviarFotoElenco, clubeSalvarJogador, clubeApagarJogador, clubeSalvarTecnico, clubeBuscarEscalacao, clubeSalvarEscalacao,
  clubeMeusPosts, publicarPost, urlFoto,
} from '../api.js';
import { ordenarClassificacao, posicoesComEmpate } from '../classificacao.js';
import { assinarMudancas } from '../realtime.js';
import { prepararFoto } from '../imagem.js';
import { compartilharImagem } from '../compartilhar.js';
import { arteEscalacao, inserirArte } from '../artes.js';
import { FORMACOES, FORMACAO_PADRAO, POSICOES, htmlCampo, avatarJogador } from '../escalacao.js';
import { montarLayout, checarConfiguracao, mostrarCarregando, mostrarAviso, escapar, escudo, icone, toast, formatarData, formatarHora, tempoRelativo } from '../ui.js';

const app = document.getElementById('app');
const CHAVE_CODIGO = 'mural_codigo'; // o mesmo do mural: entrou no clube, já publica no mural como o time
const CHAVE_TIME = 'clube_time';

const traco = (caminho) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${caminho}</svg>`;
const ICONES = {
  jogos: traco('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  elenco: traco('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6c2.6.2 4.6 1.9 5.3 5.4"/>'),
  escalacao: traco('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 12h16"/><circle cx="12" cy="12" r="2.5"/><path d="M9 3v3h6V3M9 21v-3h6v3"/>'),
  sair: traco('<path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 8l-4 4 4 4M6 12h10"/>'),
  camera: traco('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  mais: traco('<path d="M12 5v14M5 12h14"/>'),
  busca: traco('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>'),
  varinha: traco('<path d="M4 20L16 8M14 4v2M18 8h2M17 5l1.5-1.5M12 6l2 2"/>'),
};
const ABAS = [
  ['jogos', 'Jogos', ICONES.jogos], ['tabela', 'Tabela', icone('tabela')], ['artilharia', 'Artilharia', icone('artilharia')],
  ['elenco', 'Elenco', ICONES.elenco], ['escalacao', 'Escalação', ICONES.escalacao], ['mural', 'Mural', icone('mural')],
];

// Posição da vaga → grupo do elenco (para sugerir e preencher automático)
const GRUPO_DA_VAGA = { GOL: 'GOL', ZAG: 'ZAG', LD: 'LAT', LE: 'LAT', ALD: 'LAT', ALE: 'LAT', VOL: 'VOL', MC: 'MEI', MEI: 'MEI', MD: 'MEI', ME: 'MEI', PD: 'ATA', PE: 'ATA', ATA: 'ATA' };
const LINHAS = [['todos', 'Todos', null], ['gol', 'Goleiros', ['GOL']], ['def', 'Defesa', ['ZAG', 'LAT']], ['mei', 'Meio', ['VOL', 'MEI']], ['ata', 'Ataque', ['ATA']]];
const linhaDe = (posicao) => LINHAS.find(([, , grupos]) => grupos?.includes(posicao))?.[0] ?? 'sem';
const nomePosicao = (p) => POSICOES.find(([sigla]) => sigla === p)?.[1] ?? 'Sem posição';
const ORDEM_POSICAO = Object.fromEntries(POSICOES.map(([p], i) => [p, i]));

const estado = { codigo: '', time: null, aba: 'jogos', subJogos: 'proximos', filtroElenco: 'todos', dados: null, escalacao: null, alterada: false, posts: null };

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

// ---------- Entrada (time + código) ----------
async function telaEntrada(mensagem = '') {
  let times;
  try { times = (await listarTimes()).filter((t) => t.ativo !== false); } catch (erro) { mostrarAviso(app, `Não foi possível carregar os times: ${erro.message}`); return; }
  const salvo = guardado(CHAVE_TIME);
  app.innerHTML = `
    <form class="card form clube-entrada" id="form-clube">
      <h2>Área do clube</h2>
      <p class="texto-2">Escolha o seu time e digite o código de acesso enviado pelo organizador.</p>
      <div class="escolha-times">${times.map((t) => `
        <label class="escolha-time"><input type="radio" name="time" value="${t.id}" ${String(t.id) === salvo ? 'checked' : ''} required>
          ${escudo(t, 48)}<span>${escapar(t.nome)}</span></label>`).join('')}</div>
      <label class="campo">Código de acesso
        <span class="senha">
          <input class="senha__campo" name="codigo" type="password" required maxlength="12" placeholder="••••••"
            autocapitalize="characters" autocomplete="current-password" spellcheck="false">
          <button class="senha__ver" type="button" aria-label="Mostrar código" aria-pressed="false">Mostrar</button>
        </span></label>
      ${mensagem ? `<p class="aviso">${escapar(mensagem)}</p>` : ''}
      <button class="botao botao--grande" type="submit">Entrar</button>
    </form>`;
  const ver = app.querySelector('.senha__ver');
  ver.addEventListener('click', () => {
    const campo = app.querySelector('.senha__campo');
    const mostrar = campo.type === 'password';
    campo.type = mostrar ? 'text' : 'password';
    ver.textContent = mostrar ? 'Ocultar' : 'Mostrar';
    ver.setAttribute('aria-pressed', String(mostrar));
    ver.setAttribute('aria-label', mostrar ? 'Ocultar código' : 'Mostrar código');
    campo.focus();
  });
  document.getElementById('form-clube').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = new FormData(e.target);
    const timeId = Number(dados.get('time'));
    const codigo = String(dados.get('codigo')).trim().toUpperCase();
    const enviar = e.target.querySelector('[type=submit]');
    enviar.disabled = true;
    try {
      const time = await validarCodigo(codigo);
      if (!time || time.time_id !== timeId) throw new Error('Código não confere com o time escolhido.');
      guardar(CHAVE_CODIGO, codigo);
      guardar(CHAVE_TIME, String(timeId));
      estado.codigo = codigo;
      mostrarCarregando(app);
      await carregar();
    } catch (erro) {
      toast(erro.message, true);
      enviar.disabled = false;
    }
  });
}

function sairDoClube(mensagem = '') {
  esquecer(CHAVE_CODIGO);
  Object.assign(estado, { codigo: '', time: null, escalacao: null, alterada: false, posts: null, aba: 'jogos' });
  telaEntrada(mensagem);
}

// ---------- Dados ----------
async function buscar() {
  const [campeonato, times, jogos, encerrados, linhas, artilharia, jogadores] = await Promise.all([
    buscarCampeonato(), listarTimes(), listarJogos(), listarJogosEncerrados(), buscarClassificacao(), buscarArtilharia(), listarJogadores(),
  ]);
  return { campeonato, times, jogos, encerrados, linhas, artilharia, jogadores };
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
      <button class="clube-hero__sair" data-sair-clube aria-label="Sair do clube" title="Sair do clube">${ICONES.sair}</button>
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
              <small>${jogo.data_hora ? `${formatarData(jogo.data_hora)} · ${formatarHora(jogo.data_hora)}` : 'A definir'} · ${emCasa(jogo) ? 'Mandante' : 'Visitante'}</small></span>
          </div>
        </div>` : ''}
    </section>`;
}

function desenhar() {
  app.innerHTML = `
    ${htmlHero()}
    <nav class="clube-abas" role="tablist" aria-label="Seções do clube">${ABAS.map(([id, rotulo, svg]) => `
      <button class="clube-aba${estado.aba === id ? ' clube-aba--ativa' : ''}" role="tab" aria-selected="${estado.aba === id}" data-aba="${id}">
        ${svg}<span>${rotulo}</span>${id === 'escalacao' && estado.alterada ? '<i class="ponto" aria-label="não salva"></i>' : ''}</button>`).join('')}</nav>
    <div id="aba-clube" class="clube-conteudo"></div>`;
  app.querySelector('[data-sair-clube]').addEventListener('click', () => {
    if (!estado.alterada || confirm('A escalação tem alterações não salvas. Sair mesmo assim?')) sairDoClube();
  });
  app.querySelectorAll('[data-aba]').forEach((b) => b.addEventListener('click', () => trocarAba(b.dataset.aba)));
  app.querySelector('.clube-aba--ativa')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  desenharAba();
}

function trocarAba(aba) {
  estado.aba = aba;
  app.querySelectorAll('[data-aba]').forEach((b) => {
    const ativa = b.dataset.aba === aba;
    b.classList.toggle('clube-aba--ativa', ativa);
    b.setAttribute('aria-selected', String(ativa));
  });
  desenharAba();
}

function desenharAba() {
  const alvo = document.getElementById('aba-clube');
  alvo.classList.remove('clube-conteudo--entrar');
  void alvo.offsetWidth; // reinicia a animação de entrada
  alvo.classList.add('clube-conteudo--entrar');
  SECOES[estado.aba](alvo);
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
      : `<span class="partida__hora">${data ? formatarHora(j.data_hora) : '—'}<small>${data ? escapar(quando(j.data_hora)) : ''}</small></span>`;
  return `
    <a class="partida" href="time.html?id=${adv.id}">
      <span class="partida__data">${data ? `<b>${data.getDate()}</b>${data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}` : '—'}</span>
      <span class="partida__adv">${escudo(adv, 32)}<span><strong>${escapar(adv.nome)}</strong>
        <small>R${j.rodada?.numero ?? '?'} · ${emCasa(j) ? 'Mandante' : 'Visitante'}</small></span></span>
      ${direita}
    </a>`;
}

const SECOES = {
  jogos(alvo) {
    const todos = jogosDoTime();
    const lista = estado.subJogos === 'proximos' ? todos.filter((j) => j.status !== 'encerrado') : todos.filter((j) => j.status === 'encerrado').reverse();
    alvo.innerHTML = `
      <div class="segmentos" role="tablist">
        <button class="segmento${estado.subJogos === 'proximos' ? ' segmento--ativo' : ''}" data-sub="proximos">Calendário</button>
        <button class="segmento${estado.subJogos === 'resultados' ? ' segmento--ativo' : ''}" data-sub="resultados">Resultados</button>
      </div>
      <div class="partidas">${lista.map(htmlPartida).join('') || `<p class="vazio">${estado.subJogos === 'proximos' ? 'Nenhum jogo agendado.' : 'Nenhum jogo encerrado ainda.'}</p>`}</div>`;
    alvo.querySelectorAll('[data-sub]').forEach((b) => b.addEventListener('click', () => { estado.subJogos = b.dataset.sub; SECOES.jogos(alvo); }));
  },

  tabela(alvo) {
    const linhas = ordenarClassificacao(estado.dados.linhas, estado.dados.encerrados);
    alvo.innerHTML = `
      <div class="tabela-rolagem"><table class="tabela">
        <thead><tr><th>Pos</th><th>Time</th><th>PTS</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th></tr></thead>
        <tbody>${linhas.map((t) => `
          <tr class="${t.time_id === estado.time.id ? 'linha--destaque' : ''}">
            <td class="pos">${t.posicao}º</td>
            <td class="time"><a class="time__nome" href="time.html?id=${t.time_id}">${escudo(t, 32)} ${escapar(t.nome)}</a></td>
            <td class="pts">${t.pts}</td><td>${t.j}</td><td>${t.v}</td><td>${t.e}</td><td>${t.d}</td><td>${t.sg}</td>
          </tr>`).join('')}</tbody></table></div>
      <p class="texto-2 texto-pequeno"><a href="classificacao.html">Ver tabela completa →</a></p>`;
  },

  artilharia(alvo) {
    const fotos = new Map(estado.dados.jogadores.map((j) => [j.id, j]));
    const doTime = posicoesComEmpate(estado.dados.artilharia.filter((a) => a.time_id === estado.time.id).map((a) => ({ ...a, gols: Number(a.gols) })));
    const podio = doTime.slice(0, 3);
    alvo.innerHTML = doTime.length ? `
      <div class="podio">${podio.map((a, i) => `
        <div class="podio__item podio__item--${i + 1}">
          ${avatarJogador(fotos.get(a.jogador_id)?.foto_url ? fotos.get(a.jogador_id) : { numero: `${a.posicao}º` }, 'avatar avatar--medio')}
          <strong>${escapar(a.jogador)}</strong><span class="podio__gols">${a.gols}<small> gol${a.gols === 1 ? '' : 's'}</small></span>
        </div>`).join('')}</div>
      ${doTime.length > 3 ? `<ol class="lista">${doTime.slice(3).map((a) => `
        <li class="artilheiro"><span class="artilheiro__pos">${a.posicao}º</span>
          <div><div class="artilheiro__nome">${escapar(a.jogador)}</div></div><span class="artilheiro__gols">${a.gols}</span></li>`).join('')}</ol>` : ''}
      <p class="texto-2 texto-pequeno"><a href="artilharia.html">Artilharia geral →</a></p>`
      : '<p class="vazio">Nenhum gol do clube ainda.</p>';
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
      <div class="barra-acoes">
        <button class="botao botao--secundario" data-salvar-escalacao>${estado.alterada ? 'Salvar alterações' : 'Salvo ✔'}</button>
        <button class="botao" data-compartilhar-escalacao>${icone('whatsapp')} Compartilhar</button>
      </div>`;

    const mudou = () => { estado.alterada = true; app.querySelector('[data-aba="escalacao"]').innerHTML = `${ICONES.escalacao}<span>Escalação</span><i class="ponto" aria-label="não salva"></i>`; SECOES.escalacao(alvo); };
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
    alvo.querySelector('[data-compartilhar-escalacao]').addEventListener('click', (e) => compartilharEscalacao(e.currentTarget, jogadores));
  },

  async mural(alvo) {
    alvo.innerHTML = `
      <button class="botao botao--grande" data-publicar>${ICONES.camera} Publicar foto do clube</button>
      <p class="texto-2 texto-pequeno">As fotos aparecem aqui na hora. No mural geral, entram depois que o organizador aprovar.</p>
      <div class="galeria" id="galeria-clube">${'<span class="galeria__item esqueleto__bloco"></span>'.repeat(4)}</div>
      <p class="texto-2 texto-pequeno"><a href="mural.html">Ver o mural geral →</a></p>`;
    alvo.querySelector('[data-publicar]').addEventListener('click', dialogoPublicar);
    try {
      estado.posts = await clubeMeusPosts(estado.codigo);
      if (estado.aba !== 'mural') return;
      document.getElementById('galeria-clube').innerHTML = estado.posts.map((p) => `
        <figure class="galeria__item">
          <img src="${escapar(urlFoto(p.foto_path))}" loading="lazy" alt="${escapar(p.descricao ?? 'Foto do clube')}">
          <span class="galeria__selo ${p.aprovado ? 'galeria__selo--ok' : ''}">${p.aprovado ? 'No mural' : 'Em análise'}</span>
          <figcaption>${escapar(tempoRelativo(p.criado_em))}${p.comentarios ? ` · ${p.comentarios} 💬` : ''}</figcaption>
        </figure>`).join('') || '<p class="vazio">Nenhuma foto publicada ainda.</p>';
    } catch (erro) { tratarErro(erro); }
  },
};

function htmlCarta(j, atributos = '', extra = '') {
  return `
    <button class="carta carta--${linhaDe(j.posicao)}" ${atributos}>
      <span class="carta__foto">${j.foto_url ? `<img src="${escapar(j.foto_url)}" alt="" loading="lazy">` : `<span>${escapar((j.nome || '?').slice(0, 1))}</span>`}</span>
      ${j.numero != null ? `<span class="carta__numero">${j.numero}</span>` : ''}
      <span class="carta__posicao">${escapar(j.posicao ?? '—')}</span>
      <span class="carta__nome">${escapar(j.nome)}</span>
      ${extra}
    </button>`;
}

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

async function salvarEscalacao(alvo) {
  try {
    await clubeSalvarEscalacao(estado.codigo, estado.escalacao);
    estado.alterada = false;
    app.querySelector('[data-aba="escalacao"] .ponto')?.remove();
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

// ---------- Mural do clube ----------
function dialogoPublicar() {
  const jogos = jogosDoTime().map((j) => `<option value="${j.id}">R${j.rodada?.numero ?? '?'} · ${escapar(j.mandante.nome)} × ${escapar(j.visitante.nome)}</option>`).join('');
  const d = abrirDialogo(`
    <form class="form">
      <h2>Publicar foto</h2>
      <label class="foto-escolha foto-escolha--larga">
        <input type="file" name="foto" accept="image/*" required class="sr-only">
        <span class="foto-escolha__quadro">${ICONES.camera}<span class="texto-pequeno">Toque para escolher a foto</span></span>
      </label>
      <label class="campo">Descrição<textarea name="descricao" maxlength="500" placeholder="Conte como foi o jogo..."></textarea></label>
      <label class="campo">Jogo (opcional)<select name="jogo"><option value="">Nenhum</option>${jogos}</select></label>
      <p class="texto-2 texto-pequeno">Aparece no painel do clube na hora. No mural geral, depois da aprovação do organizador.</p>
      <div class="form__acoes">
        <button class="botao botao--secundario" type="button" data-fechar>Cancelar</button>
        <button class="botao" type="submit">Enviar</button>
      </div>
    </form>`);
  d.querySelector('[name=foto]').addEventListener('change', (e) => {
    const arquivo = e.target.files[0];
    if (arquivo) d.querySelector('.foto-escolha__quadro').innerHTML = `<img src="${URL.createObjectURL(arquivo)}" alt="Prévia da foto">`;
  });
  d.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = new FormData(e.target);
    const enviar = e.target.querySelector('[type=submit]');
    enviar.disabled = true;
    try {
      toast('Enviando foto...');
      const foto = await prepararFoto(dados.get('foto'));
      await publicarPost({ codigo: estado.codigo, descricao: dados.get('descricao'), foto, jogoId: dados.get('jogo') ? Number(dados.get('jogo')) : null });
      d.close();
      toast('Foto enviada! Já aparece aqui; no mural geral, após aprovação.');
      if (estado.aba === 'mural') desenharAba();
    } catch (erro) {
      tratarErro(erro);
      enviar.disabled = false;
    }
  });
}

// ---------- Início ----------
montarLayout('inicio');
document.querySelector('.faixa')?.remove();
if (checarConfiguracao(app)) {
  estado.codigo = guardado(CHAVE_CODIGO);
  if (estado.codigo && guardado(CHAVE_TIME)) { mostrarCarregando(app); carregar(); } else telaEntrada();
  // Realtime: não redesenha com uma janela aberta (alguém editando o elenco) nem com a escalação por salvar
  assinarMudancas(() => { if (estado.time && !document.querySelector('dialog[open]') && !estado.alterada) carregar(); });
  window.addEventListener('beforeunload', (e) => { if (estado.alterada) e.preventDefault(); });
}
