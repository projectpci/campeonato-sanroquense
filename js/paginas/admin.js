// Área do organizador: login, confrontos/resultados e times.
import {
  buscarSessao, entrar, sair, listarTimes, listarRodadas, listarJogos, listarJogadores,
  salvarTime, enviarEscudo, salvarRodada, salvarJogo, excluirJogo, excluirTime, excluirRodada, salvarResultado, reabrirJogo, atualizarPlacarAoVivo, listarCodigos, gerarCodigo,
} from '../api.js';
import { montarLayout, checarConfiguracao, mostrarCarregando, mostrarAviso, escapar, escudo, toast, formatarData } from '../ui.js';

const app = document.getElementById('app');
const estado = { aba: 'confrontos', rodadaId: null };
const DOMINIO_USUARIO = 'sanroquense.app';

montarLayout(null);
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
  try { await sair(); } finally { location.href = 'index.html'; }
}
document.getElementById('btn-sair-header').addEventListener('click', sairDoPainel);

// ---------- Login ----------
function telaLogin() {
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
      await iniciar();
    } catch (erro) {
      toast(`Não foi possível entrar: ${erro.message}`, true);
    }
  });
}

// ---------- Painel ----------
async function iniciar() {
  const sessao = await buscarSessao();
  if (!sessao) return telaLogin();
  mostrarCarregando(app);
  await carregar();
}

async function carregar() {
  try {
    const [times, rodadas, jogos, jogadores, codigos] = await Promise.all([listarTimes(), listarRodadas(), listarJogos(), listarJogadores(), listarCodigos()]);
    const abas = [['confrontos', 'Confrontos e resultados'], ['times', 'Times']];
    app.innerHTML = `
      <div class="admin__topo">
        <h2>Organizador</h2>
        <div class="form__acoes">
          <a class="botao botao--secundario" href="mural.html">Mural</a>
          <button class="botao botao--secundario" id="btn-csv">Exportar CSV</button>
          <button class="botao botao--secundario" id="btn-sair">Sair</button>
        </div>
      </div>
      <div class="chips" role="tablist">${abas.map(([id, rotulo]) =>
        `<button class="chip${estado.aba === id ? ' chip--ativo' : ''}" data-aba="${id}">${rotulo}</button>`).join('')}</div>
      <div id="aba"></div>`;
    app.querySelectorAll('[data-aba]').forEach((b) => b.addEventListener('click', () => { estado.aba = b.dataset.aba; carregar(); }));
    document.getElementById('btn-sair').addEventListener('click', sairDoPainel);
    document.getElementById('btn-csv').addEventListener('click', () => exportarCsv(jogos, rodadas));
    const aba = document.getElementById('aba');
    if (estado.aba === 'times') abaTimes(aba, times, codigos);
    else abaConfrontos(aba, { times, rodadas, jogos, jogadores });
  } catch (erro) {
    mostrarAviso(app, `Erro ao carregar: ${erro.message}`);
  }
}

// ---------- Aba Times ----------
function abaTimes(aba, times, codigos = []) {
  const codigoDe = (timeId) => codigos.find((c) => c.time_id === timeId)?.codigo;
  aba.innerHTML = `
    <button class="botao" id="novo-time">+ Novo time</button>
    <p class="texto-2 texto-pequeno secao">O <strong>código de publicação</strong> permite ao time postar no mural. Envie só para o responsável do time.</p>
    <ul class="lista">${times.map((t) => `
      <li class="artilheiro admin__time${t.ativo ? '' : ' admin__time--inativo'}">
        ${escudo(t, 48)}
        <div><div class="artilheiro__nome">${escapar(t.nome)}</div>
          <div class="texto-2 texto-pequeno">${escapar(t.sigla ?? '')} ${t.ativo ? '' : '· inativo'}</div>
          <div class="admin__codigo">Código: <code>${escapar(codigoDe(t.id) ?? 'sem código')}</code>
            ${codigoDe(t.id) ? `<button class="link-botao" data-copiar="${t.id}">copiar</button> · ` : ''}
            <button class="link-botao" data-gerar-codigo="${t.id}">${codigoDe(t.id) ? 'gerar novo' : 'gerar'}</button></div></div>
        <button class="botao botao--secundario" data-editar="${t.id}">Editar</button>
      </li>`).join('')}</ul>`;
  aba.querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', async () => {
    const time = times.find((t) => t.id === Number(b.dataset.copiar));
    try {
      await navigator.clipboard.writeText(`Código do ${time.nome} para publicar no mural: ${codigoDe(time.id)}`);
      toast('Código copiado ✔');
    } catch {
      toast('Não foi possível copiar. Selecione o código na tela.', true);
    }
  }));
  aba.querySelectorAll('[data-gerar-codigo]').forEach((b) => b.addEventListener('click', () => {
    const time = times.find((t) => t.id === Number(b.dataset.gerarCodigo));
    if (!codigoDe(time.id) || confirm(`Gerar um novo código para ${time.nome}? O código atual deixa de funcionar.`)) {
      executar(() => gerarCodigo(time.id), 'Novo código gerado ✔');
    }
  }));
  document.getElementById('novo-time').addEventListener('click', () => dialogoTime({ ativo: true }));
  aba.querySelectorAll('[data-editar]').forEach((b) =>
    b.addEventListener('click', () => dialogoTime(times.find((t) => t.id === Number(b.dataset.editar)))));
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

// ---------- Aba Confrontos e resultados ----------
function abaConfrontos(aba, { times, rodadas, jogos, jogadores }) {
  if (!rodadas.some((r) => r.id === estado.rodadaId)) {
    estado.rodadaId = (rodadas.find((r) => jogos.some((j) => j.rodada_id === r.id && j.status === 'agendado')) ?? rodadas.at(-1))?.id ?? null;
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
      <div class="secao">${dosJogos.map((j) => cartaoAdmin(j)).join('') || '<p class="texto-2">Nenhum confronto ainda.</p>'}</div>
      <button class="botao" id="novo-confronto">+ Adicionar confronto</button>` : '<p class="texto-2">Crie a primeira rodada.</p>'}`;

  aba.querySelectorAll('[data-rodada]').forEach((b) => b.addEventListener('click', () => { estado.rodadaId = Number(b.dataset.rodada); carregar(); }));
  document.getElementById('nova-rodada').addEventListener('click', () => dialogoRodada(rodadas));
  document.getElementById('editar-rodada')?.addEventListener('click', () => dialogoRodada(rodadas, rodada));
  document.getElementById('novo-confronto')?.addEventListener('click', () => dialogoConfronto(rodada, times, dosJogos));
  aba.querySelectorAll('[data-editar-jogo]').forEach((b) =>
    b.addEventListener('click', () => dialogoConfronto(rodada, times, dosJogos, dosJogos.find((j) => j.id === Number(b.dataset.editarJogo)))));
  aba.querySelectorAll('[data-resultado]').forEach((b) =>
    b.addEventListener('click', () => dialogoResultado(jogos.find((j) => j.id === Number(b.dataset.resultado)), jogadores)));
  aba.querySelectorAll('[data-iniciar]').forEach((b) => b.addEventListener('click', () =>
    executar(() => atualizarPlacarAoVivo(Number(b.dataset.iniciar), 0, 0), 'Jogo iniciado — placar ao vivo ligado')));
  aba.querySelectorAll('[data-gol]').forEach((b) => b.addEventListener('click', () => {
    const [id, lado, delta] = b.dataset.gol.split(':');
    const jogo = jogos.find((j) => j.id === Number(id));
    const gm = Math.max(0, (jogo.gols_mandante ?? 0) + (lado === 'm' ? Number(delta) : 0));
    const gv = Math.max(0, (jogo.gols_visitante ?? 0) + (lado === 'v' ? Number(delta) : 0));
    executar(() => atualizarPlacarAoVivo(jogo.id, gm, gv));
  }));
  aba.querySelectorAll('[data-cancelar-vivo]').forEach((b) => b.addEventListener('click', () => {
    if (confirm('Cancelar o jogo ao vivo? O placar parcial será apagado e o jogo volta para agendado.')) {
      executar(() => reabrirJogo(Number(b.dataset.cancelarVivo)), 'Jogo voltou para agendado');
    }
  }));
  aba.querySelectorAll('[data-excluir]').forEach((b) => b.addEventListener('click', () => {
    const jogo = jogos.find((j) => j.id === Number(b.dataset.excluir));
    const aviso = jogo.status === 'encerrado' ? 'Este jogo já foi encerrado e a classificação será recalculada. Excluir?' : 'Excluir este confronto?';
    if (confirm(aviso)) executar(() => excluirJogo(jogo.id), 'Confronto excluído');
  }));
}

// Backup: baixa todos os jogos (com autores dos gols) em CSV, abre direto no Excel
function exportarCsv(jogos, rodadas) {
  const numero = (id) => rodadas.find((r) => r.id === id)?.numero ?? '';
  const autores = (j) => (j.gols ?? []).map((g) =>
    `${g.jogador?.nome ?? 'sem nome'}${g.quantidade > 1 ? ` (${g.quantidade})` : ''}${g.contra ? ' (contra)' : ''}`).join(', ');
  const linhas = [['Rodada', 'Data/hora', 'Mandante', 'Gols mandante', 'Gols visitante', 'Visitante', 'Status', 'Autores dos gols'],
    ...[...jogos].sort((a, b) => numero(a.rodada_id) - numero(b.rodada_id)).map((j) => [
      numero(j.rodada_id), j.data_hora ?? '', j.mandante.nome, j.gols_mandante ?? '', j.gols_visitante ?? '', j.visitante.nome, j.status, autores(j)])];
  const csv = `﻿${linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  Object.assign(document.createElement('a'), { href: url, download: 'campeonato-sanroquense.csv' }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function cartaoAdmin(j) {
  const encerrado = j.status === 'encerrado';
  const aoVivo = j.status === 'ao_vivo';
  const placar = encerrado || aoVivo ? `${j.gols_mandante} × ${j.gols_visitante}` : '×';
  // Placar ao vivo: +/− por time (atualiza para a torcida em tempo real)
  const controle = (lado, nome) => `
    <div class="aovivo__time"><span class="texto-2 texto-pequeno">${escapar(nome)}</span>
      <button class="botao botao--secundario" data-gol="${j.id}:${lado}:-1" aria-label="Tirar gol de ${escapar(nome)}">−</button>
      <button class="botao" data-gol="${j.id}:${lado}:1" aria-label="Gol de ${escapar(nome)}">+ Gol</button></div>`;
  return `
    <article class="card jogo">
      <div class="jogo__confronto">
        <div class="jogo__time">${escudo(j.mandante, 48)}<span>${escapar(j.mandante.nome)}</span></div>
        <div class="jogo__centro"><strong class="jogo__placar">${placar}</strong></div>
        <div class="jogo__time">${escudo(j.visitante, 48)}<span>${escapar(j.visitante.nome)}</span></div>
      </div>
      ${aoVivo ? `<div class="aovivo"><span class="selo selo--aovivo">Ao vivo</span>
        <div class="aovivo__controles">${controle('m', j.mandante.nome)}${controle('v', j.visitante.nome)}</div></div>` : ''}
      <div class="form__acoes">
        <button class="botao botao--perigo" data-excluir="${j.id}">Excluir</button>
        <button class="botao botao--secundario" data-editar-jogo="${j.id}">Editar</button>
        ${aoVivo ? `<button class="botao botao--secundario" data-cancelar-vivo="${j.id}">Cancelar ao vivo</button>` : ''}
        ${j.status === 'agendado' ? `<button class="botao botao--secundario" data-iniciar="${j.id}">Iniciar ao vivo</button>` : ''}
        <button class="botao" data-resultado="${j.id}">${encerrado ? 'Corrigir resultado' : aoVivo ? 'Encerrar jogo' : 'Lançar resultado'}</button>
      </div>
    </article>`;
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

function dialogoConfronto(rodada, times, jogosDaRodada, jogo = null) {
  const ocupados = new Set(jogosDaRodada.filter((j) => j.id !== jogo?.id).flatMap((j) => [j.mandante_id, j.visitante_id]));
  const livres = times.filter((t) => (t.ativo || [jogo?.mandante_id, jogo?.visitante_id].includes(t.id)) && !ocupados.has(t.id));
  const opcoes = (selecionado) => livres.map((t) => `<option value="${t.id}"${t.id === selecionado ? ' selected' : ''}>${escapar(t.nome)}</option>`).join('');
  const dataLocal = jogo?.data_hora ? new Date(new Date(jogo.data_hora) - new Date(jogo.data_hora).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
  const d = abrirDialogo(`
    <form class="form" method="dialog">
      <h2>${jogo ? 'Editar' : 'Novo'} confronto · Rodada ${rodada.numero}</h2>
      ${livres.length < 2 ? '<p class="aviso">Não há times livres suficientes nesta rodada.</p>' : ''}
      <label class="campo">Mandante<select name="mandante" required>${opcoes(jogo?.mandante_id)}</select></label>
      <label class="campo">Visitante<select name="visitante" required>${opcoes(jogo?.visitante_id)}</select></label>
      <label class="campo">Data e hora (opcional)<input type="datetime-local" name="data_hora" value="${dataLocal}"></label>
      <div class="form__acoes">
        <button class="botao botao--secundario" type="button" data-fechar>Cancelar</button>
        <button class="botao" type="submit" ${livres.length < 2 ? 'disabled' : ''}>Salvar</button>
      </div>
    </form>`);
  const visitante = d.querySelector('[name=visitante]');
  if (!jogo && visitante.options.length > 1) visitante.selectedIndex = 1;
  d.querySelector('[data-fechar]').addEventListener('click', () => d.close());
  d.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const dados = new FormData(e.target);
    executar(async () => {
      await salvarJogo({
        ...(jogo ? { id: jogo.id } : {}), rodada_id: rodada.id, mandante_id: Number(dados.get('mandante')), visitante_id: Number(dados.get('visitante')),
        data_hora: dados.get('data_hora') ? new Date(dados.get('data_hora')).toISOString() : null,
      });
      d.close();
    }, 'Confronto salvo ✔');
  });
}

// ---------- Formulário de resultado (placar + autores dos gols) ----------
function linhaGol(nomeLista, gol = {}) {
  return `
    <div class="gol-linha">
      <input class="gol-nome" list="${nomeLista}" placeholder="Jogador" value="${escapar(gol.jogador?.nome ?? '')}">
      <input class="gol-qtd" type="number" min="1" value="${gol.quantidade ?? 1}" aria-label="Quantidade de gols">
      <label class="gol-contra"><input type="checkbox" ${gol.contra ? 'checked' : ''}> contra</label>
      <button type="button" class="botao botao--secundario gol-remover" aria-label="Remover autor">✕</button>
    </div>`;
}

function dialogoResultado(jogo, jogadores) {
  const lado = (time, adversario, rotulo) => ({ time, adversario, rotulo });
  const lados = [lado(jogo.mandante, jogo.visitante, 'mandante'), lado(jogo.visitante, jogo.mandante, 'visitante')];
  const datalist = (timeId) => `<datalist id="dl-${timeId}">${jogadores.filter((j) => j.time_id === timeId)
    .map((j) => `<option value="${escapar(j.nome)}">`).join('')}</datalist>`;
  const golsDoTime = (timeId) => (jogo.gols ?? []).filter((g) => g.time_id === timeId);

  const d = abrirDialogo(`
    <form class="form" id="form-resultado">
      <section class="form" data-etapa="placar">
        <h2>Resultado</h2>
        <div class="placar-form">
          <div class="jogo__time">${escudo(jogo.mandante, 48)}<span>${escapar(jogo.mandante.nome)}</span></div>
          <input class="placar-input" type="number" min="0" name="gm" required value="${jogo.gols_mandante ?? 0}" aria-label="Gols ${escapar(jogo.mandante.nome)}">
          <span>×</span>
          <input class="placar-input" type="number" min="0" name="gv" required value="${jogo.gols_visitante ?? 0}" aria-label="Gols ${escapar(jogo.visitante.nome)}">
          <div class="jogo__time">${escudo(jogo.visitante, 48)}<span>${escapar(jogo.visitante.nome)}</span></div>
        </div>
        <div class="form__acoes">
          ${jogo.status === 'encerrado' ? '<button class="botao botao--perigo" type="button" id="reabrir">Reabrir jogo</button>' : ''}
          <button class="botao botao--secundario" type="button" data-fechar>Cancelar</button>
          <button class="botao" type="submit" id="avancar">Informar gols</button>
        </div>
      </section>
      <section class="form oculto" data-etapa="gols">
        <h2>Quem fez os gols?</h2>
        <p class="texto-2" id="resumo-placar"></p>
        ${datalist(jogo.mandante_id)}${datalist(jogo.visitante_id)}
        ${lados.map(({ time }) => `
          <fieldset class="gols-time" data-time="${time.id}">
            <legend>${escapar(time.nome)} <span class="soma" data-soma="${time.id}"></span></legend>
            <div class="gols-lista">${golsDoTime(time.id).map((g) => linhaGol(`dl-${time.id}`, g)).join('')}</div>
            <button type="button" class="botao botao--secundario" data-add="${time.id}">+ adicionar autor</button>
          </fieldset>`).join('')}
        <div class="form__acoes">
          <button class="botao botao--secundario" type="button" id="voltar">Voltar ao placar</button>
          <button class="botao" type="submit" id="salvar-resultado">Salvar resultado</button>
        </div>
      </section>
    </form>`);

  const form = d.querySelector('form');
  const placar = () => [Number(form.gm.value) || 0, Number(form.gv.value) || 0];
  const etapa = (nome) => d.querySelectorAll('[data-etapa]').forEach((s) => s.classList.toggle('oculto', s.dataset.etapa !== nome));
  const naEtapaGols = () => !d.querySelector('[data-etapa="gols"]').classList.contains('oculto');

  // Só aparecem os times que marcaram; cada um começa com uma linha já com o total de gols
  const abrirGols = () => {
    const [gm, gv] = placar();
    d.querySelector('#resumo-placar').textContent = `${jogo.mandante.nome} ${gm} × ${gv} ${jogo.visitante.nome}`;
    for (const [time, gols] of [[jogo.mandante, gm], [jogo.visitante, gv]]) {
      const bloco = d.querySelector(`.gols-time[data-time="${time.id}"]`);
      bloco.classList.toggle('oculto', gols === 0);
      const lista = bloco.querySelector('.gols-lista');
      if (gols > 0 && !lista.children.length) {
        lista.insertAdjacentHTML('beforeend', linhaGol(`dl-${time.id}`, { quantidade: gols }));
        ajustarLista(lista.firstElementChild, time.id);
      }
    }
    etapa('gols');
    validar();
  };

  // Em gol contra o autor é do adversário: troca a lista de sugestões da linha
  const ajustarLista = (linha, timeId) => {
    const contra = linha.querySelector('.gol-contra input').checked;
    const alvo = contra ? (timeId === jogo.mandante_id ? jogo.visitante_id : jogo.mandante_id) : timeId;
    linha.querySelector('.gol-nome').setAttribute('list', `dl-${alvo}`);
  };

  const coletar = () => [...d.querySelectorAll('.gols-time:not(.oculto)')].flatMap((bloco) =>
    [...bloco.querySelectorAll('.gol-linha')].map((linha) => ({
      time_id: Number(bloco.dataset.time),
      jogador_nome: linha.querySelector('.gol-nome').value.trim(),
      quantidade: Number(linha.querySelector('.gol-qtd').value) || 0,
      contra: linha.querySelector('.gol-contra input').checked,
    })));

  const validar = () => {
    const gols = coletar();
    const [gm, gv] = placar();
    const alvo = { [jogo.mandante_id]: gm, [jogo.visitante_id]: gv };
    let valido = true;
    for (const id of [jogo.mandante_id, jogo.visitante_id]) {
      const soma = gols.filter((g) => g.time_id === id).reduce((s, g) => s + g.quantidade, 0);
      const ok = soma === alvo[id];
      valido &&= ok;
      const el = d.querySelector(`[data-soma="${id}"]`);
      el.textContent = `${soma}/${alvo[id]} ${ok ? '✔' : '✖'}`;
      el.className = `soma ${ok ? 'soma--ok' : 'soma--erro'}`;
    }
    const semNome = gols.some((g) => !g.contra && !g.jogador_nome);
    valido &&= !semNome && gols.every((g) => g.quantidade > 0);
    d.querySelector('#salvar-resultado').disabled = !valido;
  };

  d.addEventListener('input', (e) => { if (e.target.closest('.gol-contra')) ajustarLista(e.target.closest('.gol-linha'), Number(e.target.closest('.gols-time').dataset.time)); validar(); });
  d.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) {
      d.querySelector(`.gols-time[data-time="${add.dataset.add}"] .gols-lista`).insertAdjacentHTML('beforeend', linhaGol(`dl-${add.dataset.add}`));
      validar();
    }
    if (e.target.closest('.gol-remover')) { e.target.closest('.gol-linha').remove(); validar(); }
  });
  d.querySelectorAll('.gols-time').forEach((bloco) => bloco.querySelectorAll('.gol-linha').forEach((l) => ajustarLista(l, Number(bloco.dataset.time))));
  d.querySelector('[data-fechar]').addEventListener('click', () => d.close());
  d.querySelector('#reabrir')?.addEventListener('click', () => {
    if (confirm('Reabrir o jogo apaga o placar e os gols lançados. Continuar?')) executar(async () => { await reabrirJogo(jogo.id); d.close(); }, 'Jogo reaberto');
  });
  d.querySelector('#voltar').addEventListener('click', () => etapa('placar'));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const [gm, gv] = placar();
    if (!naEtapaGols()) {
      if (gm + gv > 0) { abrirGols(); return; } // 0×0 não tem autores: salva direto
    } else if (d.querySelector('#salvar-resultado').disabled) return;
    executar(async () => { await salvarResultado(jogo.id, gm, gv, coletar()); d.close(); }, 'Resultado salvo ✔');
  });
  validar();
}

if (checarConfiguracao(app)) iniciar();
