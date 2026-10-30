// Formulário do elenco para os clubes: o clube escolhe o time, informa o técnico e os jogadores por posição e envia
// pelo WhatsApp uma mensagem num formato que o painel do organizador reconhece e importa em massa.
// Não grava nada no banco e não pede código: só monta o texto (js/importarElenco.js).
import '../pwa.js';
import { listarTimes } from '../api.js';
import { semConfiguracao, WHATSAPP_ELENCO } from '../supabase.js';
import { escapar, escudo, icone, toast } from '../ui.js';
import { linhaDe } from '../escalacao.js';
import { SECOES, montarMensagem, nomeIgual } from '../importarElenco.js';

window.__appIniciou = true; // js/resgate.js
const app = document.getElementById('app');
const CHAVE = 'elenco_rascunho';
const MINIMO_RECOMENDADO = 11;

const lerRascunho = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) ?? {}; } catch { return {}; } };
const guardarRascunho = () => { try { localStorage.setItem(CHAVE, JSON.stringify({ timeId: estado.timeId, tecnico: estado.tecnico, linhas: estado.linhas })); } catch { /* sem armazenamento */ } };

const doEndereco = Number(new URLSearchParams(location.search).get('time')) || null;
// rascunho de outro time (link individual diferente do último usado neste aparelho) não é reaproveitado
const rascunho = (() => { const r = lerRascunho(); return doEndereco && r.timeId !== doEndereco ? {} : r; })();
const estado = {
  times: [],
  timeId: doEndereco ?? rascunho.timeId ?? null,
  travado: Boolean(doEndereco), // link individual do clube: o time já vem escolhido
  tecnico: rascunho.tecnico ?? '',
  linhas: Object.fromEntries(SECOES.map(([pos]) => [pos, rascunho.linhas?.[pos]?.length ? rascunho.linhas[pos] : [{ numero: '', nome: '' }]])),
};

const jogadoresDoForm = () => SECOES.flatMap(([pos]) => estado.linhas[pos]
  .filter((l) => l.nome.trim())
  .map((l) => ({ posicao: pos, nome: l.nome.trim(), numero: l.numero === '' ? null : Number(l.numero) })));
const timeEscolhido = () => estado.times.find((t) => t.id === estado.timeId);

// Problemas para avisar antes de enviar: número repetido, nome repetido, número sem nome
function conferir() {
  const todos = SECOES.flatMap(([pos]) => estado.linhas[pos].map((l, i) => ({ pos, i, ...l })));
  const marcas = new Map(); // `${pos}:${i}` → texto
  const numeros = new Map();
  const nomes = [];
  for (const l of todos) {
    if (l.numero !== '' && !l.nome.trim()) marcas.set(`${l.pos}:${l.i}`, 'Falta o nome');
    if (l.nome.trim() && l.nome.trim().length < 2) marcas.set(`${l.pos}:${l.i}`, 'Nome muito curto');
    if (l.numero !== '' && l.nome.trim()) numeros.set(l.numero, [...(numeros.get(l.numero) ?? []), l]);
    if (l.nome.trim()) {
      const igual = nomes.find((n) => nomeIgual(n.nome, l.nome));
      if (igual) marcas.set(`${l.pos}:${l.i}`, 'Nome repetido');
      else nomes.push(l);
    }
  }
  for (const [n, lista] of numeros) if (lista.length > 1) lista.forEach((l) => marcas.set(`${l.pos}:${l.i}`, `Número ${n} repetido`));
  return marcas;
}

function htmlLinha(pos, l, i, marcas) {
  const aviso = marcas.get(`${pos}:${i}`);
  return `
    <div class="cadastro__linha${aviso ? ' cadastro__linha--erro' : ''}" data-linha="${pos}:${i}">
      <input class="cadastro__numero" inputmode="numeric" pattern="[0-9]*" maxlength="2" placeholder="Nº" value="${escapar(l.numero)}" aria-label="Número do jogador" data-campo="numero">
      <input class="cadastro__nome" maxlength="40" placeholder="Nome do jogador" value="${escapar(l.nome)}" autocomplete="off" autocapitalize="words" aria-label="Nome do jogador" data-campo="nome">
      <button class="cadastro__remover" type="button" aria-label="Remover jogador" data-remover="${pos}:${i}">✕</button>
      ${aviso ? `<small class="cadastro__aviso">${escapar(aviso)}</small>` : ''}
    </div>`;
}

function desenhar() {
  const marcas = conferir();
  const meu = estado.travado ? timeEscolhido() : null;
  app.innerHTML = `
    ${meu ? `<section class="cadastro__clube">${escudo(meu, 96)}<div><small>Cadastro do elenco</small><h2>${escapar(meu.nome)}</h2></div></section>` : ''}
    <section class="cadastro__passos card">
      <p><b>1</b><span>Escolha o time e informe o técnico</span></p>
      <p><b>2</b><span>Coloque os jogadores em cada posição</span></p>
      <p><b>3</b><span>Toque em <strong>Enviar</strong> e mande no WhatsApp</span></p>
    </section>

    <section class="card form cadastro__time">
      <label class="campo">Time
        <select data-time ${estado.travado ? 'disabled' : ''}>
          <option value="">Escolha o seu time…</option>
          ${estado.times.map((t) => `<option value="${t.id}"${t.id === estado.timeId ? ' selected' : ''}>${escapar(t.nome)}</option>`).join('')}
        </select></label>
      <label class="campo">Técnico
        <input data-tecnico maxlength="40" placeholder="Nome do técnico" value="${escapar(estado.tecnico)}" autocomplete="off" autocapitalize="words"></label>
    </section>

    ${SECOES.map(([pos, rotulo, emoji]) => `
      <section class="cadastro__secao cadastro__secao--${linhaDe(pos)}" data-secao="${pos}">
        <h3><span aria-hidden="true">${emoji}</span> ${rotulo}<small data-contagem="${pos}">${estado.linhas[pos].filter((l) => l.nome.trim()).length}</small></h3>
        <div class="cadastro__linhas">${estado.linhas[pos].map((l, i) => htmlLinha(pos, l, i, marcas)).join('')}</div>
        <button class="botao botao--secundario botao--pequeno" type="button" data-adicionar="${pos}">+ ${rotulo.slice(0, -1)}</button>
      </section>`).join('')}

    <p class="cadastro__nota texto-2 texto-pequeno">Tudo fica salvo neste celular até você enviar. Quem não tiver número pode deixar em branco.</p>

    <div class="cadastro__barra">
      <span class="cadastro__total" data-total></span>
      <button class="botao botao--secundario" type="button" data-copiar>Copiar</button>
      <button class="botao cadastro__enviar" type="button" data-enviar>${icone('whatsapp')} Enviar</button>
    </div>`;
  atualizarTotal();
}

function atualizarTotal() {
  const n = jogadoresDoForm().length;
  const total = app.querySelector('[data-total]');
  if (total) total.innerHTML = `<b>${n}</b> jogador${n === 1 ? '' : 'es'}${n && n < MINIMO_RECOMENDADO ? `<small>mín. ${MINIMO_RECOMENDADO}</small>` : ''}`;
  SECOES.forEach(([pos]) => {
    const c = app.querySelector(`[data-contagem="${pos}"]`);
    if (c) c.textContent = estado.linhas[pos].filter((l) => l.nome.trim()).length;
  });
}

// Texto pronto, ou null (e um aviso na tela) se ainda falta algo
function mensagemPronta() {
  const time = timeEscolhido();
  const jogadores = jogadoresDoForm();
  if (!time) { toast('Escolha o seu time primeiro.', true); app.querySelector('[data-time]')?.focus(); return null; }
  if (!jogadores.length) { toast('Informe pelo menos um jogador.', true); return null; }
  const problemas = conferir();
  if (problemas.size && !confirm(`Há ${problemas.size} linha${problemas.size === 1 ? '' : 's'} com aviso (número ou nome repetido, por exemplo). Enviar assim mesmo?`)) return null;
  if (jogadores.length < MINIMO_RECOMENDADO && !confirm(`Você informou só ${jogadores.length} jogador${jogadores.length === 1 ? '' : 'es'}. Enviar assim mesmo?`)) return null;
  return montarMensagem({ time: time.nome, tecnico: estado.tecnico.trim(), jogadores });
}

app.addEventListener('input', (e) => {
  const campo = e.target.dataset?.campo;
  if (e.target.matches('[data-tecnico]')) { estado.tecnico = e.target.value; guardarRascunho(); return; }
  if (!campo) return;
  const [pos, i] = e.target.closest('[data-linha]').dataset.linha.split(':');
  if (campo === 'numero') e.target.value = e.target.value.replace(/\D/g, '').slice(0, 2);
  estado.linhas[pos][Number(i)][campo] = e.target.value;
  guardarRascunho();
  atualizarTotal();
});
// ao sair do campo: confere repetidos e mostra os avisos nas linhas (sem tirar o foco enquanto digita)
app.addEventListener('focusout', (e) => {
  if (!e.target.dataset?.campo) return;
  const marcas = conferir();
  app.querySelectorAll('[data-linha]').forEach((el) => {
    const aviso = marcas.get(el.dataset.linha);
    el.classList.toggle('cadastro__linha--erro', Boolean(aviso));
    el.querySelector('.cadastro__aviso')?.remove();
    if (aviso) el.insertAdjacentHTML('beforeend', `<small class="cadastro__aviso">${escapar(aviso)}</small>`);
  });
});
app.addEventListener('change', (e) => {
  if (e.target.matches('[data-time]')) { estado.timeId = Number(e.target.value) || null; guardarRascunho(); }
});
app.addEventListener('click', async (e) => {
  const adicionar = e.target.closest('[data-adicionar]');
  if (adicionar) {
    const pos = adicionar.dataset.adicionar;
    estado.linhas[pos].push({ numero: '', nome: '' });
    desenhar();
    app.querySelectorAll(`[data-secao="${pos}"] .cadastro__nome`).forEach((el, i, todos) => { if (i === todos.length - 1) el.focus(); });
    return;
  }
  const remover = e.target.closest('[data-remover]');
  if (remover) {
    const [pos, i] = remover.dataset.remover.split(':');
    estado.linhas[pos].splice(Number(i), 1);
    if (!estado.linhas[pos].length) estado.linhas[pos].push({ numero: '', nome: '' });
    guardarRascunho();
    desenhar();
    return;
  }
  if (e.target.closest('[data-enviar]')) {
    const texto = mensagemPronta();
    if (!texto) return;
    const destino = WHATSAPP_ELENCO ? `https://wa.me/${WHATSAPP_ELENCO}` : 'https://wa.me/';
    location.href = `${destino}?text=${encodeURIComponent(texto)}`;
    return;
  }
  if (e.target.closest('[data-copiar]')) {
    const texto = mensagemPronta();
    if (!texto) return;
    try { await navigator.clipboard.writeText(texto); toast('Mensagem copiada ✔ Cole no WhatsApp.'); } catch { toast('Não foi possível copiar.', true); }
  }
});

async function iniciar() {
  document.body.insertAdjacentHTML('afterbegin', `
    <header class="header"><a class="header__marca" href="index.html">${icone('coroa')}<span>CAMPEONATO <em>SRP</em></span></a></header>`);
  if (semConfiguracao) { app.innerHTML = '<p class="aviso">O site ainda não foi configurado.</p>'; return; }
  try {
    estado.times = (await listarTimes()).filter((t) => t.ativo !== false);
  } catch (erro) {
    app.innerHTML = `<p class="aviso">Não foi possível carregar os times: ${escapar(erro.message)}</p>`;
    return;
  }
  if (!timeEscolhido()) estado.timeId = null;
  desenhar();
}
iniciar();
