// Elenco de um time: seletor de times em escudos (com aviso de elenco não informado/incompleto), cabeçalho com resumo
// por posição, técnico, busca, jogadores agrupados por posição e ficha do jogador ao tocar na carta.
// Usado na página Elenco (torcedor), na página do time e na aba Elenco do painel (onde tocar na carta edita o jogador).
import { POSICOES, LINHAS, MINIMO_ELENCO, linhaDe, htmlCarta, avatarJogador } from './escalacao.js';
import { escapar, escudo } from './ui.js';

export { MINIMO_ELENCO };
const ORDEM = Object.fromEntries(POSICOES.map(([p], i) => [p, i]));
const NOME_POSICAO = Object.fromEntries(POSICOES);
// Uma seção por posição, mais "sem posição" para quem ainda não foi classificado
const GRUPOS = [...POSICOES.map(([p]) => [p, LINHAS.find(([id]) => id === p)[1]]), ['sem', 'Sem posição']];
const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export const elencoAtivo = (jogadores, timeId) => jogadores
  .filter((j) => j.time_id === timeId && j.ativo !== false)
  .sort((a, b) => (ORDEM[a.posicao] ?? 9) - (ORDEM[b.posicao] ?? 9) || (a.numero ?? 99) - (b.numero ?? 99) || a.nome.localeCompare(b.nome));

// Situação do elenco de um time: 'vazio' (não informado), 'incompleto' (menos que o mínimo) ou 'ok'
export const situacaoDoElenco = (jogadores, timeId) => {
  const n = elencoAtivo(jogadores, timeId).length;
  return { n, situacao: n === 0 ? 'vazio' : n < MINIMO_ELENCO ? 'incompleto' : 'ok' };
};

// Seletor de times: escudos em fila (rola para o lado), o escolhido com anel de destaque.
// Elenco não informado ganha um "!" vermelho; incompleto, o número em amarelo.
export const htmlSeletorTimes = (times, jogadores, selecionado) => `
  <nav class="seletor-times" aria-label="Escolher time">${times.map((t) => {
    const { n, situacao } = situacaoDoElenco(jogadores, t.id);
    const marca = situacao === 'vazio' ? '<i class="seletor-times__alerta" title="Elenco não informado">!</i>'
      : `<i${situacao === 'incompleto' ? ' class="seletor-times__curto" title="Elenco incompleto"' : ''}>${n}</i>`;
    return `
      <button class="seletor-times__item${t.id === selecionado ? ' seletor-times__item--ativo' : ''}" data-elenco-time="${t.id}" aria-pressed="${t.id === selecionado}"
        aria-label="${escapar(t.nome)}${situacao === 'vazio' ? ', elenco não informado' : situacao === 'incompleto' ? `, elenco incompleto com ${n} jogadores` : ''}">
        <span class="seletor-times__escudo">${escudo(t, 48)}${marca}</span>
        <span class="seletor-times__nome">${escapar(t.nome)}</span>
      </button>`;
  }).join('')}</nav>`;

// Resumo para o organizador: quais times estão sem elenco ou incompletos
export function htmlAvisoElencos(times, jogadores) {
  const sem = times.filter((t) => situacaoDoElenco(jogadores, t.id).situacao === 'vazio');
  const curtos = times.filter((t) => situacaoDoElenco(jogadores, t.id).situacao === 'incompleto');
  if (!sem.length && !curtos.length) return `<p class="elenco__resumo-geral elenco__resumo-geral--ok">✅ Todos os times têm elenco informado.</p>`;
  const lista = (ts) => ts.map((t) => escapar(t.nome)).join(', ');
  return `
    <div class="elenco__resumo-geral">
      ${sem.length ? `<p><b>⚠️ ${sem.length} ${sem.length === 1 ? 'time sem elenco informado' : 'times sem elenco informado'}:</b> ${lista(sem)}</p>` : ''}
      ${curtos.length ? `<p><b>🟡 ${curtos.length} ${curtos.length === 1 ? 'elenco incompleto' : 'elencos incompletos'}</b> (menos de ${MINIMO_ELENCO}): ${lista(curtos)}</p>` : ''}
    </div>`;
}

// `gols`: Map jogador_id → gols no campeonato (opcional, aparece na carta e na ficha)
// `admin`: painel do organizador (texto do aviso de elenco vazio muda)
export function htmlElenco(time, jogadores, { gols = new Map(), vazio = 'O clube ainda não cadastrou o elenco.', cabecalho = true, extraTopo = '', admin = false } = {}) {
  const elenco = elencoAtivo(jogadores, time.id);
  const noGrupo = (g) => elenco.filter((j) => (g === 'sem' ? !NOME_POSICAO[j.posicao] : j.posicao === g));
  const resumo = LINHAS.filter(([id]) => id !== 'todos').map(([id, rotulo]) =>
    `<span class="elenco__linha elenco__linha--${linhaDe(id)}"><b>${noGrupo(id).length}</b> ${rotulo}</span>`).join('');
  const incompleto = elenco.length > 0 && elenco.length < MINIMO_ELENCO;
  const carta = (j) => {
    const g = gols.get(j.id);
    return htmlCarta(j, `data-ficha="${j.id}" aria-label="${admin ? 'Editar' : 'Ver ficha de'} ${escapar(j.nome)}"`, g ? `<span class="carta__gols">⚽ ${g}</span>` : '');
  };
  return `
    <section class="elenco" data-elenco="${time.id}">
      ${cabecalho ? `<header class="elenco__topo">
        ${escudo(time, 96)}
        <div class="elenco__titulo">
          <h2>${escapar(time.nome)}</h2>
          <p>${elenco.length} jogador${elenco.length === 1 ? '' : 'es'}</p>
          ${elenco.length ? `<div class="elenco__resumo">${resumo}</div>` : ''}
          ${incompleto ? `<span class="elenco__selo elenco__selo--curto">🟡 Elenco incompleto · mínimo ${MINIMO_ELENCO}</span>` : ''}
          ${extraTopo}
        </div>
      </header>` : ''}
      <div class="elenco__tecnico">
        ${avatarJogador({ foto_url: time.tecnico_foto_url, numero: 'T' }, 'avatar avatar--medio')}
        <span><small>Técnico</small><strong>${escapar(time.tecnico_nome || 'A definir')}</strong></span>
      </div>
      ${elenco.length ? `
        <label class="busca elenco__busca"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>
          <input type="search" placeholder="Buscar por nome ou número" aria-label="Buscar jogador" data-busca-elenco></label>
        ${GRUPOS.map(([g, rotulo]) => {
          const lista = noGrupo(g);
          return lista.length ? `
            <div class="elenco__grupo" data-grupo>
              <h3 class="elenco__grupo-titulo elenco__grupo-titulo--${linhaDe(g)}">${rotulo}<span>${lista.length}</span></h3>
              <div class="cartas">${lista.map(carta).join('')}</div>
            </div>` : '';
        }).join('')}
        <p class="vazio oculto" data-sem-resultado>Nenhum jogador encontrado.</p>`
        : `<div class="elenco__alerta" role="status">
            <strong>⚠️ Elenco não informado</strong>
            <p>${escapar(admin ? 'Este time ainda não enviou o elenco. Cadastre os jogadores aqui ou importe pelo WhatsApp.' : vazio)}</p>
          </div>`}
    </section>`;
}

// Liga a busca e a ficha do jogador dentro de `container` (chamar depois de inserir o HTML)
// `aoTocar(jogador)`: no painel do organizador, tocar na carta abre a edição em vez da ficha
export function ligarElenco(container, { time, jogadores, gols = new Map(), aoTocar = null }) {
  const busca = container.querySelector('[data-busca-elenco]');
  busca?.addEventListener('input', () => {
    const termo = semAcento(busca.value.trim());
    let algum = false;
    container.querySelectorAll('[data-grupo]').forEach((grupo) => {
      let noGrupo = 0;
      grupo.querySelectorAll('[data-ficha]').forEach((c) => {
        const j = jogadores.find((x) => x.id === Number(c.dataset.ficha));
        const ok = !termo || semAcento(`${j.nome} ${j.numero ?? ''}`).includes(termo);
        c.classList.toggle('oculto', !ok);
        if (ok) noGrupo++;
      });
      grupo.classList.toggle('oculto', !noGrupo);
      algum ||= noGrupo > 0;
    });
    container.querySelector('[data-sem-resultado]')?.classList.toggle('oculto', algum);
  });
  container.addEventListener('click', (e) => {
    const c = e.target.closest('[data-ficha]');
    if (!c) return;
    const j = jogadores.find((x) => x.id === Number(c.dataset.ficha));
    if (!j) return;
    if (aoTocar) aoTocar(j); else abrirFicha(j, time, gols.get(j.id) ?? 0);
  });
}

function abrirFicha(j, time, gols) {
  document.querySelector('dialog.dialogo')?.remove();
  const d = Object.assign(document.createElement('dialog'), { className: 'dialogo dialogo--folha ficha' });
  d.innerHTML = `
    <div class="ficha__foto ficha__foto--${linhaDe(j.posicao)}">
      ${j.foto_url ? `<img src="${escapar(j.foto_url)}" alt="Foto de ${escapar(j.nome)}">` : `<span>${escapar(j.nome.slice(0, 1))}</span>`}
      ${j.numero != null ? `<b class="ficha__numero">${j.numero}</b>` : ''}
    </div>
    <div class="ficha__corpo">
      <h2>${escapar(j.nome)}</h2>
      <p class="ficha__time">${escudo(time, 32)} ${escapar(time.nome)}</p>
      <dl class="ficha__dados">
        <div><dt>Posição</dt><dd>${escapar(NOME_POSICAO[j.posicao] ?? '—')}</dd></div>
        <div><dt>Número</dt><dd>${j.numero ?? '—'}</dd></div>
        <div><dt>Gols</dt><dd>${gols}</dd></div>
      </dl>
      <button class="botao botao--secundario" data-fechar>Fechar</button>
    </div>`;
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-fechar]')) d.close(); });
  d.addEventListener('close', () => d.remove());
  document.body.append(d);
  d.showModal();
}

// Gols por jogador a partir da artilharia (v_artilharia)
export const golsPorJogador = (artilharia = []) => new Map(artilharia.map((a) => [a.jogador_id, Number(a.gols)]));
