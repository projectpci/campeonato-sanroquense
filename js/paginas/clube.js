// Área do clube: o time entra com o código de acesso (o mesmo do mural) e tem calendário, resultados,
// tabela, artilharia, mural, elenco (técnico e jogadores com foto) e escalação para compartilhar.
import {
  listarTimes, listarJogos, buscarClassificacao, listarJogosEncerrados, buscarArtilharia, buscarCampeonato, listarJogadores,
  validarCodigo, enviarFotoElenco, clubeSalvarJogador, clubeApagarJogador, clubeSalvarTecnico, clubeBuscarEscalacao, clubeSalvarEscalacao,
} from '../api.js';
import { ordenarClassificacao, posicoesComEmpate } from '../classificacao.js';
import { assinarMudancas } from '../realtime.js';
import { cartaoJogo } from '../cartaoJogo.js';
import { prepararFoto } from '../imagem.js';
import { compartilharImagem } from '../compartilhar.js';
import { arteEscalacao, inserirArte } from '../artes.js';
import { FORMACOES, FORMACAO_PADRAO, POSICOES, htmlCampo, avatarJogador } from '../escalacao.js';
import { montarLayout, checarConfiguracao, mostrarCarregando, mostrarAviso, escapar, escudo, toast } from '../ui.js';

const app = document.getElementById('app');
const CHAVE_CODIGO = 'mural_codigo'; // o mesmo do mural: entrou no clube, já publica no mural como o time
const CHAVE_TIME = 'clube_time';
const ABAS = [['calendario', 'Calendário'], ['resultados', 'Resultados'], ['tabela', 'Tabela'], ['artilharia', 'Artilharia'],
  ['elenco', 'Elenco'], ['escalacao', 'Escalação'], ['mural', 'Mural']];
const ORDEM_POSICAO = Object.fromEntries(POSICOES.map(([p], i) => [p, i]));
const estado = { codigo: '', time: null, aba: 'calendario', dados: null, escalacao: null, alterada: false };

// localStorage pode estar bloqueado (aba anônima): nunca deixa quebrar a página
const guardado = (chave) => { try { return localStorage.getItem(chave) ?? ''; } catch { return ''; } };
const guardar = (chave, valor) => { try { localStorage.setItem(chave, valor); } catch { /* sem armazenamento */ } };
const esquecer = (chave) => { try { localStorage.removeItem(chave); } catch { /* sem armazenamento */ } };

function abrirDialogo(html) {
  document.querySelector('dialog.dialogo')?.remove();
  const d = Object.assign(document.createElement('dialog'), { className: 'dialogo', innerHTML: html });
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
  const times = (await listarTimes()).filter((t) => t.ativo !== false);
  const salvo = guardado(CHAVE_TIME);
  app.innerHTML = `
    <form class="card form" id="form-clube">
      <h2>Área do clube</h2>
      <p class="texto-2">Escolha o seu time e digite o código de acesso enviado pelo organizador.</p>
      <div class="escolha-times">${times.map((t) => `
        <label class="escolha-time"><input type="radio" name="time" value="${t.id}" ${String(t.id) === salvo ? 'checked' : ''} required>
          ${escudo(t, 48)}<span>${escapar(t.nome)}</span></label>`).join('')}</div>
      <label class="campo">Código de acesso
        <input name="codigo" required autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="12"></label>
      ${mensagem ? `<p class="aviso">${escapar(mensagem)}</p>` : ''}
      <button class="botao" type="submit">Entrar</button>
    </form>`;
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
  Object.assign(estado, { codigo: '', time: null, escalacao: null, alterada: false, aba: 'calendario' });
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

// ---------- Tela ----------
function desenhar() {
  const { time } = estado;
  app.innerHTML = `
    <section class="time-topo card card--neon">
      ${escudo(time, 96)}
      <div><h2>${escapar(time.nome)}</h2><p class="texto-2">Área do clube</p>
        <button class="link-botao texto-pequeno" data-sair-clube>Sair do clube</button></div>
    </section>
    <div class="chips" role="tablist" aria-label="Seções do clube">${ABAS.map(([id, rotulo]) =>
      `<button class="chip${estado.aba === id ? ' chip--ativo' : ''}" data-aba="${id}">${rotulo}</button>`).join('')}</div>
    <div id="aba-clube"></div>`;
  app.querySelector('[data-sair-clube]').addEventListener('click', () => sairDoClube());
  app.querySelectorAll('[data-aba]').forEach((b) => b.addEventListener('click', () => { estado.aba = b.dataset.aba; desenhar(); }));
  app.querySelector('.chip--ativo')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  SECOES[estado.aba](document.getElementById('aba-clube'));
}

const listaJogos = (jogos, vazio) => jogos.length ? jogos.map(cartaoJogo).join('') : `<p class="carregando">${vazio}</p>`;

const SECOES = {
  calendario(alvo) {
    alvo.innerHTML = `<section class="secao"><h3>Próximos jogos</h3>
      ${listaJogos(jogosDoTime().filter((j) => j.status !== 'encerrado'), 'Nenhum jogo agendado.')}</section>`;
  },

  resultados(alvo) {
    alvo.innerHTML = `<section class="secao"><h3>Resultados</h3>
      ${listaJogos(jogosDoTime().filter((j) => j.status === 'encerrado').reverse(), 'Nenhum jogo encerrado ainda.')}</section>`;
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
    const doTime = posicoesComEmpate(estado.dados.artilharia.filter((a) => a.time_id === estado.time.id).map((a) => ({ ...a, gols: Number(a.gols) })));
    alvo.innerHTML = `<section class="secao"><h3>Artilheiros do clube</h3>
      ${doTime.length ? `<ol class="lista">${doTime.map((a) => `
        <li class="artilheiro"><span class="artilheiro__pos">${a.posicao}º</span>
          <div><div class="artilheiro__nome">${escapar(a.jogador)}</div></div>
          <span class="artilheiro__gols">${a.gols}</span></li>`).join('')}</ol>` : '<p class="carregando">Nenhum gol do clube ainda.</p>'}
      <p class="texto-2 texto-pequeno"><a href="artilharia.html">Artilharia geral →</a></p></section>`;
  },

  mural(alvo) {
    alvo.innerHTML = `<section class="card secao">
      <h3>Mural</h3>
      <p class="texto-2">Você já está identificado como <b>${escapar(estado.time.nome)}</b>: no mural, as fotos saem com o nome e o escudo do clube.</p>
      <a class="botao" href="mural.html">Abrir o mural e publicar foto</a></section>`;
  },

  elenco(alvo) {
    const { time } = estado;
    const jogadores = elenco();
    alvo.innerHTML = `
      <section class="secao"><h3>Técnico</h3>
        <div class="card elenco__item">
          ${avatarJogador({ foto_url: time.tecnico_foto_url, numero: 'T' })}
          <div class="elenco__nome"><strong>${escapar(time.tecnico_nome || 'Sem técnico cadastrado')}</strong></div>
          <button class="botao botao--secundario" data-editar-tecnico>Editar</button>
        </div></section>
      <section class="secao"><h3>Jogadores (${jogadores.length})</h3>
        ${jogadores.map((j) => `
          <div class="card elenco__item">
            ${avatarJogador(j)}
            <div class="elenco__nome"><strong>${j.numero != null ? `${j.numero} · ` : ''}${escapar(j.nome)}</strong>
              <span class="texto-2 texto-pequeno">${escapar(POSICOES.find(([p]) => p === j.posicao)?.[1] ?? 'Sem posição')}</span></div>
            <button class="botao botao--secundario" data-editar-jogador="${j.id}">Editar</button>
          </div>`).join('') || '<p class="carregando">Nenhum jogador cadastrado.</p>'}
        <button class="botao" data-novo-jogador>+ Adicionar jogador</button>
      </section>`;
    alvo.querySelector('[data-editar-tecnico]').addEventListener('click', dialogoTecnico);
    alvo.querySelector('[data-novo-jogador]').addEventListener('click', () => dialogoJogador({}));
    alvo.querySelectorAll('[data-editar-jogador]').forEach((b) =>
      b.addEventListener('click', () => dialogoJogador(jogadores.find((j) => j.id === Number(b.dataset.editarJogador)))));
  },

  escalacao(alvo) {
    const esc = estado.escalacao;
    const jogadores = elenco();
    const ativos = new Set(jogadores.map((j) => j.id));
    // tira quem saiu do elenco
    for (const [vaga, id] of Object.entries(esc.titulares)) if (!ativos.has(Number(id))) delete esc.titulares[vaga];
    esc.reservas = esc.reservas.filter((id) => ativos.has(id));
    const titulares = new Set(Object.values(esc.titulares).map(Number));
    const jogo = proximoJogo();
    const adversario = jogo && (jogo.mandante_id === estado.time.id ? jogo.visitante : jogo.mandante);

    alvo.innerHTML = `
      <div class="chips" aria-label="Formação">${Object.keys(FORMACOES).map((f) =>
        `<button class="chip${f === esc.formacao ? ' chip--ativo' : ''}" data-formacao="${f}">${f}</button>`).join('')}</div>
      ${jogo ? `<p class="texto-2 texto-pequeno">Próximo jogo: <b>${escapar(estado.time.nome)} × ${escapar(adversario.nome)}</b></p>` : ''}
      ${jogadores.length ? '' : '<p class="aviso">Cadastre os jogadores na aba Elenco para escalar o time.</p>'}
      ${htmlCampo({ formacao: esc.formacao, titulares: esc.titulares, jogadores, interativo: true })}
      <p class="texto-2 texto-pequeno centro">Toque numa posição para escolher o jogador · ${titulares.size}/11 escalados</p>
      <section class="secao"><h3>Reservas</h3>
        <div class="chips chips--quebra">${jogadores.filter((j) => !titulares.has(j.id)).map((j) =>
          `<button class="chip${esc.reservas.includes(j.id) ? ' chip--ativo' : ''}" data-reserva="${j.id}">${j.numero != null ? `${j.numero} · ` : ''}${escapar(j.nome)}</button>`).join('') || '<span class="texto-2 texto-pequeno">Todos os jogadores estão no campo.</span>'}</div>
      </section>
      ${estado.alterada ? '<p class="aviso">Alterações ainda não salvas.</p>' : ''}
      <div class="form__acoes">
        <button class="botao botao--secundario" data-limpar>Limpar</button>
        <button class="botao botao--secundario" data-salvar-escalacao>Salvar</button>
        <button class="botao" data-compartilhar-escalacao>Compartilhar imagem</button>
      </div>`;

    const mudou = () => { estado.alterada = true; SECOES.escalacao(alvo); };
    alvo.querySelectorAll('[data-formacao]').forEach((b) => b.addEventListener('click', () => { esc.formacao = b.dataset.formacao; mudou(); }));
    alvo.querySelectorAll('[data-vaga]').forEach((b) => b.addEventListener('click', () => escolherJogador(Number(b.dataset.vaga), jogadores, mudou)));
    alvo.querySelectorAll('[data-reserva]').forEach((b) => b.addEventListener('click', () => {
      const id = Number(b.dataset.reserva);
      esc.reservas = esc.reservas.includes(id) ? esc.reservas.filter((r) => r !== id) : [...esc.reservas, id];
      mudou();
    }));
    alvo.querySelector('[data-limpar]').addEventListener('click', () => {
      if (confirm('Tirar todos os jogadores do campo e do banco?')) { esc.titulares = {}; esc.reservas = []; mudou(); }
    });
    alvo.querySelector('[data-salvar-escalacao]').addEventListener('click', () => salvarEscalacao(alvo));
    alvo.querySelector('[data-compartilhar-escalacao]').addEventListener('click', (e) => compartilharEscalacao(e.currentTarget, jogadores, jogo));
  },
};

// ---------- Escalação ----------
function escolherJogador(vaga, jogadores, mudou) {
  const esc = estado.escalacao;
  const atual = Number(esc.titulares[vaga]);
  const ondeEsta = (id) => Object.entries(esc.titulares).find(([, j]) => Number(j) === id)?.[0];
  const d = abrirDialogo(`
    <div class="form">
      <h2>Escolher jogador</h2>
      <div class="lista-escolha">${jogadores.map((j) => `
        <button class="lista-escolha__item${j.id === atual ? ' lista-escolha__item--ativo' : ''}" data-jogador="${j.id}">
          ${avatarJogador(j)}
          <span><strong>${j.numero != null ? `${j.numero} · ` : ''}${escapar(j.nome)}</strong>
            <small class="texto-2">${escapar(POSICOES.find(([p]) => p === j.posicao)?.[1] ?? '')}${ondeEsta(j.id) != null && j.id !== atual ? ' · já está no campo' : ''}</small></span>
        </button>`).join('')}</div>
      <div class="form__acoes">
        ${esc.titulares[vaga] != null ? '<button class="botao botao--secundario" data-vazia>Deixar vazia</button>' : ''}
        <button class="botao botao--secundario" data-fechar>Cancelar</button>
      </div>
    </div>`);
  d.addEventListener('click', (e) => {
    const item = e.target.closest('[data-jogador]');
    if (e.target.closest('[data-vazia]')) { delete esc.titulares[vaga]; d.close(); mudou(); return; }
    if (!item) return;
    const id = Number(item.dataset.jogador);
    const anterior = ondeEsta(id);
    if (anterior != null) delete esc.titulares[anterior]; // trocou de posição
    esc.titulares[vaga] = id;
    esc.reservas = esc.reservas.filter((r) => r !== id);
    d.close();
    mudou();
  });
}

async function salvarEscalacao(alvo) {
  try {
    await clubeSalvarEscalacao(estado.codigo, estado.escalacao);
    estado.alterada = false;
    toast('Escalação salva ✔');
    SECOES.escalacao(alvo);
  } catch (erro) { tratarErro(erro); }
}

async function compartilharEscalacao(botao, jogadores, jogo) {
  botao.disabled = true;
  toast('Gerando imagem...');
  try {
    const arte = inserirArte('arte-escalacao', arteEscalacao(estado.dados.campeonato, estado.time, estado.escalacao, jogadores, jogo));
    await compartilharImagem(arte, `escalacao-${estado.time.sigla ?? 'time'}.jpg`.toLowerCase());
  } catch (erro) {
    toast(`Não foi possível gerar a imagem: ${erro.message}`, true);
  } finally {
    botao.disabled = false;
  }
}

// ---------- Elenco ----------
function campoFoto(urlAtual) {
  return `
    <label class="campo">Foto (opcional)<input type="file" name="foto" accept="image/*"></label>
    <img class="avatar avatar--grande previa-foto${urlAtual ? '' : ' oculto'}" src="${escapar(urlAtual ?? '')}" alt="Prévia da foto">`;
}

function ligarPrevia(d) {
  d.querySelector('[name=foto]').addEventListener('change', (e) => {
    const arquivo = e.target.files[0];
    const previa = d.querySelector('.previa-foto');
    previa.classList.toggle('oculto', !arquivo);
    if (arquivo) previa.src = URL.createObjectURL(arquivo);
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
      <label class="campo">Nome*<input name="nome" required maxlength="40" value="${escapar(jogador.nome ?? '')}"></label>
      <div class="form__linha">
        <label class="campo">Número<input name="numero" type="number" min="0" max="99" inputmode="numeric" value="${jogador.numero ?? ''}"></label>
        <label class="campo">Posição<select name="posicao"><option value="">—</option>${POSICOES.map(([p, nome]) =>
          `<option value="${p}"${jogador.posicao === p ? ' selected' : ''}>${nome}</option>`).join('')}</select></label>
      </div>
      ${campoFoto(jogador.foto_url)}
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
        numero: dados.get('numero') === '' ? null : Number(dados.get('numero')), posicao: dados.get('posicao'),
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
      <label class="campo">Nome<input name="nome" maxlength="40" value="${escapar(time.tecnico_nome ?? '')}"></label>
      ${campoFoto(time.tecnico_foto_url)}
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
montarLayout('inicio');
document.querySelector('.faixa')?.remove();
if (checarConfiguracao(app)) {
  estado.codigo = guardado(CHAVE_CODIGO);
  if (estado.codigo && guardado(CHAVE_TIME)) { mostrarCarregando(app); carregar(); } else telaEntrada();
  // Realtime: não redesenha com uma janela aberta (alguém editando o elenco)
  assinarMudancas(() => { if (estado.time && !document.querySelector('dialog[open]')) carregar(); });
}
