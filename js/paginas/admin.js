// Área do organizador: login, confrontos/resultados e times.
import {
  buscarSessao, entrar, sair, listarTimes, listarRodadas, listarJogos, listarJogadores, buscarClassificacao, buscarArtilharia,
  salvarTime, enviarEscudo, salvarRodada, salvarJogo, excluirJogo, excluirTime, excluirRodada, reabrirJogo, atualizarPlacarAoVivo, listarCodigos, gerarCodigo, contarPostsPendentes, listarPicosOnline,
} from '../api.js';
import { montarLayout, marcarNav, definirModo, mostrarPerfil, checarConfiguracao, mostrarCarregando, mostrarAviso, escapar, escudo, icone, toast, formatarData } from '../ui.js';
import { cartaoJogo } from '../cartaoJogo.js';
import { resumoDosGols, textoDoGol } from '../golsDoJogo.js';
import { abrirSumula, painelAoVivo, ligarMarcacaoAoVivo } from '../sumula.js';
import { htmlTabela, linhaArtilheiro } from '../tabelas.js';
import { ordenarClassificacao, posicoesComEmpate } from '../classificacao.js';
import { htmlElenco, htmlSeletorTimes, htmlAvisoElencos, ligarElenco } from '../elencoTime.js';
import { dialogoJogadorAdm, dialogoTecnicoAdm } from '../elencoAdm.js';
import { ligarAcessos } from '../painelAcessos.js';
import { abrirElencoWhatsApp } from '../importacaoElenco.js';
import { rodadaAtual } from '../rodadas.js';
import { assinarMudancas } from '../realtime.js';
import { criarFeed } from '../feed.js';
import { aoMudarOnline } from '../presenca.js';
import { botaoAvisosOrganizador } from '../avisos.js';

const app = document.getElementById('app');
// Menu do painel (embaixo no celular, em cima no computador): navega por #jogos / #elenco / #ajustes
const MENU_ADM = [
  { id: 'jogos', rotulo: 'Jogos', href: '#jogos', icone: 'confrontos' },
  { id: 'tabela', rotulo: 'Tabela', href: '#tabela', icone: 'tabela' },
  { id: 'artilharia', rotulo: 'Artilharia', href: '#artilharia', icone: 'artilharia' },
  { id: 'elenco', rotulo: 'Elenco', href: '#elenco', icone: 'elenco' },
  { id: 'mural', rotulo: 'Mural', href: '#mural', icone: 'mural' },
  { id: 'ajustes', rotulo: 'Ajustes', href: '#ajustes', icone: 'engrenagem' },
];
const abaDoEndereco = () => (MENU_ADM.some((m) => m.id === location.hash.slice(1)) ? location.hash.slice(1) : 'jogos');
const estado = { aba: abaDoEndereco(), rodadaId: null };
const DOMINIO_USUARIO = 'sanroquense.app';

// A marca do topo também fica no painel: só "Sair" leva para fora
montarLayout(estado.aba, { paginas: MENU_ADM, inicio: '#jogos', torcidometro: true });
document.body.dataset.abaAdm = estado.aba; // o torcidômetro só aparece na aba Jogos (css)
window.addEventListener('hashchange', () => { estado.aba = abaDoEndereco(); document.body.dataset.abaAdm = estado.aba; marcarNav(estado.aba); window.scrollTo(0, 0); if (estado.logado) carregar(); });
document.querySelector('.faixa')?.remove();

// ---------- Utilidades ----------
function abrirDialogo(html) {
  document.querySelector('dialog.dialogo')?.remove();
  const dialogo = document.createElement('dialog');
  dialogo.className = 'dialogo';
  dialogo.innerHTML = html;
  dialogo.addEventListener('close', () => dialogo.remove());
  document.body.append(dialogo);
  dialogo.showModal();
  return dialogo;
}

async function executar(acao, mensagemOk) {
  try {
    await acao();
    if (mensagemOk) toast(mensagemOk);
    await carregar();
  } catch (erro) {
    toast(erro.message, true);
  }
}

// Sair: encerra a sessão do organizador e volta para a tela inicial
async function sairDoPainel(e) {
  e?.preventDefault();
  definirModo('');
  try { await sair(); } finally { location.href = 'index.html?sair'; }
}
document.getElementById('btn-sair-header').addEventListener('click', sairDoPainel);

// ---------- Login ----------
function telaLogin() {
  document.body.classList.add('painel--login'); // menu do painel só aparece depois de entrar
  mostrarPerfil({ tipo: 'adm', rotulo: 'ADM', quem: 'Organizador · ainda não entrou', contar: false });
  app.innerHTML = `
    <form class="card form" id="form-login">
      <h2>Entrar</h2>
      <label class="campo">Usuário<input type="text" name="email" required autocomplete="username" autocapitalize="none" spellcheck="false"></label>
      <label class="campo">Senha<input type="password" name="senha" required autocomplete="current-password"></label>
      <button class="botao" type="submit">Entrar</button>
    </form>`;
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = new FormData(e.target);
    try {
      // O Supabase Auth exige e-mail: "admsr" vira "admsr@sanroquense.app" (a conta é criada com esse e-mail)
      const usuario = dados.get('email').trim().toLowerCase();
      await entrar(usuario.includes('@') ? usuario : `${usuario}@${DOMINIO_USUARIO}`, dados.get('senha'));
      // Entrou: abre o painel direto (sem reler a sessão, que logo após o login pode ainda não estar disponível)
      entrouNoPainel();
      mostrarCarregando(app);
      await carregar();
      ligarTempoReal();
    } catch (erro) {
      toast(`Não foi possível entrar: ${erro.message}`, true);
    }
  });
}

// ---------- Painel ----------
function entrouNoPainel() {
  estado.logado = true;
  document.body.classList.remove('painel--login');
  definirModo('adm'); // o app passa a abrir direto no painel até "Sair"
  mostrarPerfil({ tipo: 'adm', rotulo: 'ADM', quem: 'Organizador (ADM)' });
  ligarAoVivo();
}

async function iniciar() {
  const sessao = await buscarSessao();
  if (!sessao) return telaLogin();
  entrouNoPainel();
  mostrarCarregando(app);
  await carregar();
  ligarTempoReal();
}

// Tempo real: o que outro organizador lançar (ou um time publicar no mural) aparece sozinho.
// Não redesenha com uma janela aberta, para não perder o que está sendo digitado.
let tempoRealLigado = false;
let feedAdm = null; // feed do mural quando a seção Mural está aberta
function ligarTempoReal() {
  if (tempoRealLigado) return;
  tempoRealLigado = true;
  assinarMudancas(() => {
    if (document.querySelector('dialog[open]')) return;
    if (estado.aba === 'mural' && feedAdm) feedAdm.carregar(); else carregar();
  });
}

async function carregar() {
  try {
    const [times, rodadas, jogos, jogadores, codigos, pendentes] = await Promise.all([listarTimes(), listarRodadas(), listarJogos(), listarJogadores(),
      estado.aba === 'ajustes' ? listarCodigos() : [], contarPostsPendentes().catch(() => 0)]);
    const titulos = { jogos: 'Jogos e resultados', tabela: 'Classificação', artilharia: 'Artilharia', elenco: 'Elenco dos clubes', mural: 'Mural · moderação', ajustes: 'Ajustes' };
    app.innerHTML = `<h2 class="admin__titulo">${titulos[estado.aba]}</h2><div id="aba"></div>`;
    // contador de fotos aguardando aprovação no item "Mural" do menu
    document.querySelectorAll('[data-nav="mural"]').forEach((item) => {
      item.querySelector('.contador')?.remove();
      if (pendentes) item.insertAdjacentHTML('beforeend', `<span class="contador contador--nav" title="Fotos aguardando aprovação">${pendentes}</span>`);
    });
    const aba = document.getElementById('aba');
    feedAdm = null;
    if (estado.aba === 'mural') { feedAdm = criarFeed(aba, { organizador: true }); await feedAdm.carregar(); }
    else if (estado.aba === 'ajustes') abaAjustes(aba, { times, codigos, jogos, rodadas });
    else if (estado.aba === 'tabela') await abaTabela(aba, jogos);
    else if (estado.aba === 'artilharia') await abaArtilharia(aba, jogos);
    else if (estado.aba === 'elenco') abaElenco(aba, times, jogadores);
    else abaConfrontos(aba, { times, rodadas, jogos, jogadores });
  } catch (erro) {
    mostrarAviso(app, `Erro ao carregar: ${erro.message}`);
  }
}

// ---------- Tabela e artilharia (dentro do painel: o organizador confere sem sair dele) ----------
async function abaTabela(aba, jogos) {
  const linhas = ordenarClassificacao(await buscarClassificacao(), jogos.filter((j) => j.status === 'encerrado'));
  aba.innerHTML = `
    ${htmlTabela(linhas, { link: false })}
    <p class="texto-2 texto-pequeno">J = Jogos · V = Vitórias · E = Empates · D = Derrotas · GP = Gols pró · GC = Gols contra · SG = Saldo de gols · PTS = Pontos</p>`;
}

async function abaArtilharia(aba, jogos) {
  const lista = posicoesComEmpate((await buscarArtilharia()).map((a) => ({ ...a, gols: Number(a.gols) })));
  // jogos encerrados com gols sem autor: o organizador vê o que falta lançar
  const semAutor = jogos.filter((j) => j.status === 'encerrado'
    && (j.gols ?? []).reduce((s, g) => s + g.quantidade, 0) < (j.gols_mandante ?? 0) + (j.gols_visitante ?? 0)).length;
  aba.innerHTML = `
    ${lista.length ? `<ol class="lista">${lista.map(linhaArtilheiro).join('')}</ol>` : '<p class="vazio">Nenhum gol registrado ainda.</p>'}
    ${semAutor ? `<p class="aviso texto-pequeno">${semAutor} jogo${semAutor === 1 ? '' : 's'} encerrado${semAutor === 1 ? '' : 's'} sem todos os autores dos gols lançados: esses gols contam na tabela, mas não na artilharia.</p>` : ''}
    <p class="texto-2 texto-pequeno">Gols contra não entram na artilharia.</p>`;
}

// ---------- Ajustes: avisos, exportar dados, times e códigos, sair ----------
// ---------- Ao vivo (Presence): quem está no app agora, dentro do menu do selo ADM ----------
// O selo mostra a bolinha piscando com o total; o menu abre o detalhe (torcedores, clubes e organização).
function htmlAoVivo(r) {
  const clubes = r.clubes.map((c) => `
    <li class="online__clube">${escudo({ nome: c.nome, escudo_url: c.escudo_url }, 32)}<span>${escapar(c.nome)}</span>${c.aparelhos > 1 ? `<small>×${c.aparelhos}</small>` : ''}</li>`).join('');
  return `
    <p class="online__titulo"><span class="ponto-online" aria-hidden="true"></span>Ao vivo · <strong>${r.total}</strong> no app</p>
    <div class="online__numeros">
      <div><strong>${r.torcedores}</strong><small>${r.torcedores === 1 ? 'Torcedor' : 'Torcedores'}</small></div>
      <div><strong>${r.clubes.length}</strong><small>${r.clubes.length === 1 ? 'Clube' : 'Clubes'}</small></div>
      <div><strong>${r.adm}</strong><small>Org.</small></div>
    </div>
    ${clubes ? `<ul class="online__clubes" aria-label="Clubes no app agora">${clubes}</ul>` : '<p class="texto-2 texto-pequeno">Nenhum clube logado agora.</p>'}
    ${htmlPicos(r.total)}`;
}

// Pico de hoje e recorde (tabela pico_online; o número de agora entra se for maior)
let picos = [];
const horaCurta = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
function htmlPicos(agora) {
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bahia' });
  const deHoje = picos.find((p) => p.dia === hoje);
  const picoHoje = Math.max(agora, deHoje?.pico ?? 0);
  const recorde = picos.reduce((m, p) => (p.pico > (m?.pico ?? 0) ? p : m), null);
  const linhaHoje = `Pico hoje: <strong>${picoHoje}</strong>${deHoje && deHoje.pico >= agora ? ` às ${horaCurta(deHoje.hora)}` : ' (agora)'}`;
  const linhaRecorde = recorde && recorde.pico > picoHoje ? ` · Recorde: <strong>${recorde.pico}</strong> em ${recorde.dia.slice(8, 10)}/${recorde.dia.slice(5, 7)}` : '';
  return `<p class="online__picos texto-pequeno">📈 ${linhaHoje}${linhaRecorde}</p>`;
}
const buscarPicos = () => listarPicosOnline(60).then((lista) => { picos = lista ?? []; }).catch(() => {});
let aoVivoLigado = false;
function ligarAoVivo() {
  if (aoVivoLigado) return;
  aoVivoLigado = true;
  const extra = document.getElementById('perfil-extra');
  const selo = document.getElementById('btn-perfil');
  extra.innerHTML = '<p class="texto-2 texto-pequeno">Contando quem está no app…</p>';
  let ultimo = null;
  // abre o menu: atualiza o pico guardado no banco
  selo.addEventListener('click', () => buscarPicos().then(() => { if (ultimo) extra.innerHTML = htmlAoVivo(ultimo); }));
  buscarPicos();
  aoMudarOnline((r) => {
    ultimo = r;
    extra.innerHTML = htmlAoVivo(r);
    let contador = selo.querySelector('.perfil__ao-vivo');
    if (!contador) { contador = document.createElement('i'); contador.className = 'perfil__ao-vivo'; selo.append(contador); }
    contador.innerHTML = `<span class="ponto-online" aria-hidden="true"></span>${r.total}`;
    contador.title = `${r.total} no app agora`;
  });
}

function abaAjustes(aba, { times, codigos, jogos, rodadas }) {
  aba.innerHTML = `
    <section class="ajuste">
      <h3>⚽ Novo confronto</h3>
      ${rodadas.length ? `
        <p class="texto-2 texto-pequeno">Escolha a rodada e adicione o jogo (data, horário e times).</p>
        <div class="novo-confronto">
          <label class="seletor"><span class="sr-only">Rodada</span>
            <select id="rodada-novo-confronto">${rodadas.map((r) => `<option value="${r.id}"${r.id === (estado.rodadaId ?? rodadaAtual(rodadas, jogos)) ? ' selected' : ''}>Rodada ${r.numero}${r.data ? ` · ${formatarData(r.data)}` : ''}</option>`).join('')}</select></label>
          <button class="botao" id="novo-confronto">+ Adicionar confronto</button>
        </div>` : '<p class="texto-2 texto-pequeno">Crie a primeira rodada em Jogos (+ Rodada).</p>'}
    </section>
    <section class="ajuste">
      <h3>📊 Acessos e instalações</h3>
      <div id="ajuste-acessos"><p class="texto-2 texto-pequeno">Contando os acessos…</p></div>
    </section>
    <section class="ajuste">
      <h3>Avisos no celular</h3>
      <p class="texto-2 texto-pequeno">Receba um aviso quando um time enviar foto para aprovar.</p>
      <div id="avisos-adm"></div>
    </section>
    <section class="ajuste">
      <h3>Dados do campeonato</h3>
      <p class="texto-2 texto-pequeno">Baixa todos os jogos com placar e autores dos gols (abre no Excel).</p>
      <button class="botao botao--secundario" id="btn-csv">Exportar CSV</button>
    </section>
    <section class="ajuste">
      <h3>Times e códigos de acesso</h3>
      <div id="ajuste-times"></div>
    </section>
    <section class="ajuste">
      <h3>Conta</h3>
      <button class="botao botao--perigo" id="btn-sair-painel">Sair do painel</button>
    </section>`;
  document.getElementById('novo-confronto')?.addEventListener('click', () => {
    const rodada = rodadas.find((r) => r.id === Number(document.getElementById('rodada-novo-confronto').value));
    estado.rodadaId = rodada.id; // ao voltar para Jogos, já abre nesta rodada
    dialogoConfronto(rodada, times, jogos.filter((j) => j.rodada_id === rodada.id));
  });
  ligarAcessos(document.getElementById('ajuste-acessos'));
  botaoAvisosOrganizador(document.getElementById('avisos-adm'));
  document.getElementById('btn-csv').addEventListener('click', () => exportarCsv(jogos, rodadas));
  document.getElementById('btn-sair-painel').addEventListener('click', sairDoPainel);
  abaTimes(document.getElementById('ajuste-times'), times, codigos);
}

// ---------- Times (dentro de Ajustes): cartões com código oculto, Copiar, Editar e Gerar novo ----------
const LINK_CLUBE = new URL('clube.html', location.href).href;
const textoDoCodigo = (time, codigo) => `⚽ ${time.nome} — Campeonato SRP\nCódigo de acesso: ${codigo}\nÁrea do clube: ${LINK_CLUBE}`;

function abaTimes(aba, times, codigos = []) {
  const codigoDe = (timeId) => codigos.find((c) => c.time_id === timeId)?.codigo;
  aba.innerHTML = `
    <p class="texto-2 texto-pequeno">O código dá acesso à Área do clube (elenco, escalação e mural). Envie só para o responsável de cada time.</p>
    <div class="times-adm">${times.map((t) => {
      const codigo = codigoDe(t.id);
      return `
        <article class="time-adm${t.ativo ? '' : ' time-adm--inativo'}">
          <div class="time-adm__topo">
            ${escudo(t, 48)}
            <div class="time-adm__nome"><strong>${escapar(t.nome)}</strong>
              <span>${escapar(t.sigla ?? '')}${t.ativo ? '' : ' · inativo'}</span></div>
            <button class="time-adm__editar" data-editar="${t.id}" aria-label="Editar ${escapar(t.nome)}" title="Editar">${icone('engrenagem')}</button>
          </div>
          <div class="time-adm__codigo">
            <code data-codigo="${t.id}" data-oculto="1">${codigo ? '••••••' : 'sem código'}</code>
            ${codigo ? `<button class="time-adm__ver" data-ver-codigo="${t.id}" aria-label="Mostrar código">Ver</button>` : ''}
          </div>
          <div class="time-adm__acoes">
            ${codigo ? `<button class="botao" data-copiar="${t.id}">Copiar</button>` : ''}
            <button class="botao botao--secundario" data-gerar-codigo="${t.id}">${codigo ? 'Gerar novo' : 'Gerar código'}</button>
          </div>
        </article>`;
    }).join('')}
      <button class="time-adm time-adm--novo" id="novo-time">+ Novo time</button>
    </div>`;
  aba.querySelectorAll('[data-ver-codigo]').forEach((b) => b.addEventListener('click', () => {
    const campo = aba.querySelector(`[data-codigo="${b.dataset.verCodigo}"]`);
    const mostrar = campo.dataset.oculto === '1';
    campo.textContent = mostrar ? codigoDe(Number(b.dataset.verCodigo)) : '••••••';
    campo.dataset.oculto = mostrar ? '0' : '1';
    b.textContent = mostrar ? 'Ocultar' : 'Ver';
  }));
  aba.querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', async () => {
    const time = times.find((x) => x.id === Number(b.dataset.copiar));
    const texto = textoDoCodigo(time, codigoDe(time.id));
    try {
      await navigator.clipboard.writeText(texto);
      b.textContent = 'Copiado ✓';
      b.classList.add('botao--ligado');
      setTimeout(() => { b.textContent = 'Copiar'; b.classList.remove('botao--ligado'); }, 1800);
    } catch {
      prompt('Copie o texto abaixo:', texto); // navegador sem acesso à área de transferência
    }
  }));
  aba.querySelectorAll('[data-gerar-codigo]').forEach((b) => b.addEventListener('click', () => {
    const time = times.find((x) => x.id === Number(b.dataset.gerarCodigo));
    if (!codigoDe(time.id) || confirm(`Gerar um novo código para ${time.nome}? O código atual deixa de funcionar.`)) {
      executar(() => gerarCodigo(time.id), 'Novo código gerado ✔');
    }
  }));
  document.getElementById('novo-time').addEventListener('click', () => dialogoTime({ ativo: true }));
  aba.querySelectorAll('[data-editar]').forEach((b) =>
    b.addEventListener('click', () => dialogoTime(times.find((x) => x.id === Number(b.dataset.editar)))));
}

// Redimensiona o escudo para 256px (quadrado) antes de subir
function redimensionar(arquivo, lado = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = Object.assign(document.createElement('canvas'), { width: lado, height: lado });
      const escala = Math.min(lado / img.width, lado / img.height);
      const w = img.width * escala;
      const h = img.height * escala;
      canvas.getContext('2d').drawImage(img, (lado - w) / 2, (lado - h) / 2, w, h);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Imagem inválida.'))), 'image/png');
    };
    img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    img.src = URL.createObjectURL(arquivo);
  });
}

function dialogoTime(time) {
  const d = abrirDialogo(`
    <form class="form" method="dialog" id="form-time">
      <h2>${time.id ? 'Editar time' : 'Novo time'}</h2>
      <label class="campo">Nome*<input name="nome" required value="${escapar(time.nome ?? '')}"></label>
      <label class="campo">Sigla<input name="sigla" maxlength="4" value="${escapar(time.sigla ?? '')}"></label>
      <label class="campo">Escudo<input type="file" name="escudo" accept="image/*"></label>
      <label class="campo campo--check"><input type="checkbox" name="ativo" ${time.ativo ? 'checked' : ''}> Time ativo</label>
      <div class="form__acoes">
        ${time.id ? '<button class="botao botao--perigo" type="button" data-excluir>Excluir</button>' : ''}
        <button class="botao botao--secundario" type="button" data-fechar>Cancelar</button>
        <button class="botao" type="submit">Salvar</button>
      </div>
    </form>`);
  d.querySelector('[data-fechar]').addEventListener('click', () => d.close());
  d.querySelector('[data-excluir]')?.addEventListener('click', () => {
    if (confirm(`Excluir o time ${time.nome}? Se ele já jogou, desative em vez de excluir.`)) executar(async () => { await excluirTime(time.id); d.close(); }, 'Time excluído');
  });
  d.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const dados = new FormData(e.target);
    executar(async () => {
      const campos = { nome: dados.get('nome').trim(), sigla: dados.get('sigla').trim() || null, ativo: dados.has('ativo') };
      let salvo = await salvarTime(time.id ? { id: time.id, ...campos } : campos);
      if (!time.id) await gerarCodigo(salvo.id); // time novo já nasce com código para o mural
      const arquivo = dados.get('escudo');
      if (arquivo?.size) {
        const url = await enviarEscudo(salvo.id, await redimensionar(arquivo));
        salvo = await salvarTime({ id: salvo.id, escudo_url: url });
      }
      d.close();
    }, 'Time salvo ✔');
  });
}

// ---------- Aba Elenco (o organizador também cadastra e edita jogadores e técnico) ----------
function abaElenco(aba, times, jogadores) {
  const ativos = times.filter((t) => t.ativo !== false);
  if (!ativos.some((t) => t.id === estado.elencoTimeId)) estado.elencoTimeId = ativos[0]?.id ?? null;
  const time = ativos.find((t) => t.id === estado.elencoTimeId);
  aba.innerHTML = `
    <div class="elenco__ferramentas"><button class="botao botao--secundario" type="button" id="elenco-zap">📲 Elenco por WhatsApp</button></div>
    ${htmlAvisoElencos(ativos, jogadores)}
    ${htmlSeletorTimes(ativos, jogadores, estado.elencoTimeId)}
    ${time ? `<div class="elenco__acoes-adm">
      <button class="botao" type="button" id="adm-novo-jogador">+ Jogador</button>
      <button class="botao botao--secundario" type="button" id="adm-tecnico">Técnico</button>
    </div>` : ''}
    <div id="elenco-adm"></div>`;
  document.getElementById('elenco-zap').addEventListener('click', () => abrirElencoWhatsApp({ times, jogadores, executar }));
  if (time) {
    const alvo = document.getElementById('elenco-adm');
    alvo.innerHTML = htmlElenco(time, jogadores, { admin: true });
    ligarElenco(alvo, { time, jogadores, aoTocar: (jogador) => dialogoJogadorAdm({ time, jogador, executar }) });
    document.getElementById('adm-novo-jogador').addEventListener('click', () => dialogoJogadorAdm({ time, executar }));
    document.getElementById('adm-tecnico').addEventListener('click', () => dialogoTecnicoAdm({ time, executar }));
  }
  aba.querySelectorAll('[data-elenco-time]').forEach((b) => b.addEventListener('click', () => { estado.elencoTimeId = Number(b.dataset.elencoTime); abaElenco(aba, times, jogadores); }));
  aba.querySelector('.seletor-times__item--ativo')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

// ---------- Aba Confrontos e resultados ----------
function abaConfrontos(aba, { times, rodadas, jogos, jogadores }) {
  if (!rodadas.some((r) => r.id === estado.rodadaId)) {
    estado.rodadaId = rodadaAtual(rodadas, jogos);
  }
  const rodada = rodadas.find((r) => r.id === estado.rodadaId);
  const dosJogos = jogos.filter((j) => j.rodada_id === estado.rodadaId);

  aba.innerHTML = `
    <div class="chips">${rodadas.map((r) =>
      `<button class="chip${r.id === estado.rodadaId ? ' chip--ativo' : ''}" data-rodada="${r.id}">R${r.numero}</button>`).join('')}
      <button class="chip" id="nova-rodada">+ Rodada</button></div>
    ${rodada ? `
      <div class="admin__topo"><h3>Rodada ${rodada.numero}${rodada.data ? ` · ${formatarData(rodada.data)}` : ''}</h3>
        <button class="botao botao--secundario" id="editar-rodada">Editar rodada</button></div>
      ${rodada.observacao ? `<p class="texto-2">${escapar(rodada.observacao)}</p>` : ''}
      <div class="secao">${dosJogos.map((j) => cartaoAdmin(j)).join('') || '<p class="texto-2">Nenhum confronto ainda. Adicione em Ajustes → Novo confronto.</p>'}</div>` : '<p class="texto-2">Crie a primeira rodada.</p>'}`;

  aba.querySelectorAll('[data-rodada]').forEach((b) => b.addEventListener('click', () => { estado.rodadaId = Number(b.dataset.rodada); carregar(); }));
  document.getElementById('nova-rodada').addEventListener('click', () => dialogoRodada(rodadas));
  document.getElementById('editar-rodada')?.addEventListener('click', () => dialogoRodada(rodadas, rodada));
  aba.querySelectorAll('[data-menu]').forEach((b) => b.addEventListener('click', () =>
    menuDoJogo(jogos.find((j) => j.id === Number(b.dataset.menu)), { rodada, times, dosJogos, jogadores })));
  ligarMarcacaoAoVivo(aba, jogos, jogadores, { executar });
}

// Engrenagem do card: ações do jogo em cartões grandes, com a principal em destaque
function menuDoJogo(jogo, { rodada, times, dosJogos, jogadores }) {
  const sumula = () => abrirSumula(jogo, jogadores, { executar });
  const itens = [];
  if (jogo.status === 'agendado') {
    itens.push({ icone: '⚽', rotulo: 'Lançar resultado', dica: 'Placar e quem fez os gols', acao: sumula, destaque: true });
    itens.push({ icone: '🔴', rotulo: 'Iniciar ao vivo', dica: 'Liga o placar em tempo real para a torcida',
      acao: () => executar(() => atualizarPlacarAoVivo(jogo.id, 0, 0), 'Jogo iniciado — placar ao vivo ligado') });
  } else if (jogo.status === 'ao_vivo') {
    itens.push({ icone: '🏁', rotulo: 'Encerrar jogo', dica: 'Confere os gols e fecha o resultado', acao: sumula, destaque: true });
    itens.push({ icone: '↩', rotulo: 'Cancelar ao vivo', dica: 'Apaga o placar parcial e volta para agendado', acao: () => {
      if (confirm('Cancelar o jogo ao vivo? O placar parcial será apagado e o jogo volta para agendado.')) {
        executar(() => reabrirJogo(jogo.id), 'Jogo voltou para agendado');
      }
    } });
  } else {
    itens.push({ icone: '✏️', rotulo: 'Editar resultado', dica: 'Corrigir placar, autores e tipo dos gols', acao: sumula, destaque: true });
  }
  itens.push({ icone: '📅', rotulo: 'Editar confronto', dica: 'Times, data e horário', acao: () => dialogoConfronto(rodada, times, dosJogos, jogo) });
  itens.push({ icone: '🗑', rotulo: 'Excluir confronto', dica: jogo.status === 'encerrado' ? 'A classificação será recalculada' : 'Remove este jogo da rodada', perigo: true, acao: () => {
    const aviso = jogo.status === 'encerrado' ? 'Este jogo já foi encerrado e a classificação será recalculada. Excluir?' : 'Excluir este confronto?';
    if (confirm(aviso)) executar(() => excluirJogo(jogo.id), 'Confronto excluído');
  } });

  const placar = jogo.status === 'agendado' ? '×' : `${jogo.gols_mandante ?? 0} × ${jogo.gols_visitante ?? 0}`;
  const d = abrirDialogo(`
    <div class="form menu-jogo">
      <div class="menu-jogo__topo">
        <div class="menu-jogo__time">${escudo(jogo.mandante, 48)}<span>${escapar(jogo.mandante.nome)}</span></div>
        <strong class="menu-jogo__placar">${placar}</strong>
        <div class="menu-jogo__time">${escudo(jogo.visitante, 48)}<span>${escapar(jogo.visitante.nome)}</span></div>
      </div>
      <div class="menu-jogo__lista">
        ${itens.map((it, i) => `
          <button class="menu-jogo__item${it.destaque ? ' menu-jogo__item--destaque' : ''}${it.perigo ? ' menu-jogo__item--perigo' : ''}" type="button" data-i="${i}">
            <span class="menu-jogo__icone" aria-hidden="true">${it.icone}</span>
            <span><b>${it.rotulo}</b><small>${it.dica}</small></span>
          </button>`).join('')}
      </div>
      <button class="link-botao" type="button" data-fechar>Fechar</button>
    </div>`);
  d.addEventListener('click', (e) => {
    if (e.target === d || e.target.closest('[data-fechar]')) return d.close();
    const botao = e.target.closest('[data-i]');
    if (!botao) return;
    d.close();
    itens[Number(botao.dataset.i)].acao();
  });
}

// Backup: baixa todos os jogos (com autores dos gols) em CSV, abre direto no Excel
function exportarCsv(jogos, rodadas) {
  const numero = (id) => rodadas.find((r) => r.id === id)?.numero ?? '';
  const autores = (j) => [j.mandante_id, j.visitante_id].flatMap((id) => resumoDosGols(j, id).map(textoDoGol)).join(', ');
  const linhas = [['Rodada', 'Data/hora', 'Mandante', 'Gols mandante', 'Gols visitante', 'Visitante', 'Status', 'Autores dos gols'],
    ...[...jogos].sort((a, b) => numero(a.rodada_id) - numero(b.rodada_id)).map((j) => [
      numero(j.rodada_id), j.data_hora ?? '', j.mandante.nome, j.gols_mandante ?? '', j.gols_visitante ?? '', j.visitante.nome, j.status, autores(j)])];
  const csv = `﻿${linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  Object.assign(document.createElement('a'), { href: url, download: 'campeonato-sanroquense.csv' }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function cartaoAdmin(j) {
  return cartaoJogo(j, {
    acao: `<button class="engrenagem" data-menu="${j.id}" aria-label="Ações do jogo" title="Ações do jogo">${icone('engrenagem')}</button>`,
    rodape: j.status === 'ao_vivo' ? painelAoVivo(j) : '',
  });
}

function dialogoRodada(rodadas, rodada = {}) {
  const proximo = rodada.numero ?? Math.max(0, ...rodadas.map((r) => r.numero)) + 1;
  const d = abrirDialogo(`
    <form class="form" method="dialog">
      <h2>${rodada.id ? 'Editar rodada' : 'Nova rodada'}</h2>
      <label class="campo">Número<input type="number" name="numero" min="1" required value="${proximo}"></label>
      <label class="campo">Data<input type="date" name="data" value="${rodada.data ?? ''}"></label>
      <label class="campo">Observação<input name="observacao" value="${escapar(rodada.observacao ?? '')}"></label>
      <div class="form__acoes">
        ${rodada.id ? '<button class="botao botao--perigo" type="button" data-excluir>Excluir rodada</button>' : ''}
        <button class="botao botao--secundario" type="button" data-fechar>Cancelar</button>
        <button class="botao" type="submit">Salvar</button>
      </div>
    </form>`);
  d.querySelector('[data-fechar]').addEventListener('click', () => d.close());
  d.querySelector('[data-excluir]')?.addEventListener('click', () => {
    if (confirm(`Excluir a rodada ${rodada.numero} com todos os confrontos e resultados dela? A classificação será recalculada.`)) {
      executar(async () => { await excluirRodada(rodada.id); d.close(); }, 'Rodada excluída');
    }
  });
  d.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const dados = new FormData(e.target);
    executar(async () => {
      const nova = await salvarRodada({ ...(rodada.id ? { id: rodada.id } : {}), numero: Number(dados.get('numero')), data: dados.get('data') || null, observacao: dados.get('observacao') || null });
      estado.rodadaId = nova.id;
      d.close();
    }, 'Rodada salva ✔');
  });
}

// Novo / editar confronto: a prévia do jogo muda conforme os times escolhidos
function dialogoConfronto(rodada, times, jogosDaRodada, jogo = null) {
  const ocupados = new Set(jogosDaRodada.filter((j) => j.id !== jogo?.id).flatMap((j) => [j.mandante_id, j.visitante_id]));
  const livres = times.filter((t) => (t.ativo || [jogo?.mandante_id, jogo?.visitante_id].includes(t.id)) && !ocupados.has(t.id));
  const opcoes = (selecionado) => livres.map((t) => `<option value="${t.id}"${t.id === selecionado ? ' selected' : ''}>${escapar(t.nome)}</option>`).join('');
  const dataLocal = jogo?.data_hora ? new Date(new Date(jogo.data_hora) - new Date(jogo.data_hora).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
  const aDefinir = jogo?.horario_definido === false;
  const d = abrirDialogo(`
    <form class="form confronto" method="dialog">
      <div class="folha__topo">
        <div><span class="sumula__status">Rodada ${rodada.numero}</span><h2>${jogo ? 'Editar' : 'Novo'} confronto</h2></div>
        <button class="link-botao" type="button" data-fechar aria-label="Fechar">✕</button>
      </div>
      ${livres.length < 2 ? '<p class="aviso">Não há times livres suficientes nesta rodada.</p>' : ''}
      <div class="confronto__previa" aria-hidden="true">
        <div class="confronto__lado" data-previa="mandante"></div><i>×</i><div class="confronto__lado" data-previa="visitante"></div>
      </div>
      <div class="confronto__times">
        <label class="campo">Mandante<select name="mandante" required>${opcoes(jogo?.mandante_id)}</select></label>
        <label class="campo">Visitante<select name="visitante" required>${opcoes(jogo?.visitante_id)}</select></label>
      </div>
      <div class="confronto__quando">
        <label class="campo">Data<input type="date" name="data" value="${dataLocal.slice(0, 10)}"></label>
        <label class="campo">Hora<input type="time" name="hora" value="${aDefinir ? '' : dataLocal.slice(11, 16)}" ${aDefinir ? 'disabled' : ''}></label>
      </div>
      <label class="campo campo--check"><input type="checkbox" name="a_definir" ${aDefinir ? 'checked' : ''}> Horário a definir</label>
      <p class="aviso texto-pequeno oculto" data-igual>Escolha times diferentes para mandante e visitante.</p>
      <div class="form__acoes">
        <button class="botao botao--secundario" type="button" data-fechar>Cancelar</button>
        <button class="botao" type="submit" ${livres.length < 2 ? 'disabled' : ''}>Salvar confronto</button>
      </div>
    </form>`);
  const mandante = d.querySelector('[name=mandante]');
  const visitante = d.querySelector('[name=visitante]');
  if (!jogo && visitante.options.length > 1) visitante.selectedIndex = 1;
  const salvar = d.querySelector('[type=submit]');
  const previa = () => {
    for (const [lado, campo] of [['mandante', mandante], ['visitante', visitante]]) {
      const time = times.find((t) => t.id === Number(campo.value));
      d.querySelector(`[data-previa="${lado}"]`).innerHTML = time ? `${escudo(time, 48)}<span>${escapar(time.nome)}</span>` : '<span class="texto-2">—</span>';
    }
    const igual = mandante.value && mandante.value === visitante.value;
    d.querySelector('[data-igual]').classList.toggle('oculto', !igual);
    salvar.disabled = livres.length < 2 || igual;
  };
  mandante.addEventListener('change', previa);
  visitante.addEventListener('change', previa);
  previa();
  d.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', () => d.close()));
  const campoHora = d.querySelector('[name=hora]');
  d.querySelector('[name=a_definir]').addEventListener('change', (e) => { campoHora.disabled = e.target.checked; });
  d.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const dados = new FormData(e.target);
    const data = dados.get('data');
    const semHora = Boolean(dados.get('a_definir')) || !dados.get('hora');
    executar(async () => {
      await salvarJogo({
        ...(jogo ? { id: jogo.id } : {}), rodada_id: rodada.id, mandante_id: Number(dados.get('mandante')), visitante_id: Number(dados.get('visitante')),
        // sem hora: guarda o dia ao meio-dia (evita trocar de dia pelo fuso) e marca "a definir"
        data_hora: data ? new Date(`${data}T${semHora ? '12:00' : dados.get('hora')}`).toISOString() : null,
        horario_definido: !(data && semHora),
      });
      d.close();
    }, 'Confronto salvo ✔');
  });
}

if (checarConfiguracao(app)) iniciar();
