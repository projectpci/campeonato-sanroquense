// Elenco de um time, só leitura: seletor de times em escudos, cabeçalho com resumo por linha, técnico,
// busca, jogadores agrupados por linha e ficha do jogador ao tocar na carta.
// Usado na página Elenco (torcedor), na página do time e na aba Elenco do painel.
import { POSICOES, LINHAS, linhaDe, htmlCarta, avatarJogador } from './escalacao.js';
import { escapar, escudo } from './ui.js';

const ORDEM = Object.fromEntries(POSICOES.map(([p], i) => [p, i]));
const NOME_POSICAO = Object.fromEntries(POSICOES);
const GRUPOS = [['gol', 'Goleiros'], ['def', 'Defensores'], ['mei', 'Meio-campistas'], ['ata', 'Atacantes'], ['sem', 'Sem posição']];
const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export const elencoAtivo = (jogadores, timeId) => jogadores
  .filter((j) => j.time_id === timeId && j.ativo !== false)
  .sort((a, b) => (ORDEM[a.posicao] ?? 9) - (ORDEM[b.posicao] ?? 9) || (a.numero ?? 99) - (b.numero ?? 99) || a.nome.localeCompare(b.nome));

// Seletor de times: escudos em fila (rola para o lado), o escolhido com anel de destaque
export const htmlSeletorTimes = (times, jogadores, selecionado) => `
  <nav class="seletor-times" aria-label="Escolher time">${times.map((t) => {
    const qtd = elencoAtivo(jogadores, t.id).length;
    return `
      <button class="seletor-times__item${t.id === selecionado ? ' seletor-times__item--ativo' : ''}" data-elenco-time="${t.id}" aria-pressed="${t.id === selecionado}">
        <span class="seletor-times__escudo">${escudo(t, 48)}${qtd ? `<i>${qtd}</i>` : ''}</span>
        <span class="seletor-times__nome">${escapar(t.nome)}</span>
      </button>`;
  }).join('')}</nav>`;

// `gols`: Map jogador_id → gols no campeonato (opcional, aparece na carta e na ficha)
export function htmlElenco(time, jogadores, { gols = new Map(), vazio = 'O clube ainda não cadastrou o elenco.', cabecalho = true, extraTopo = '' } = {}) {
  const elenco = elencoAtivo(jogadores, time.id);
  const porGrupo = (g) => elenco.filter((j) => linhaDe(j.posicao) === g);
  const resumo = LINHAS.filter(([id]) => id !== 'todos').map(([id, rotulo]) =>
    `<span class="elenco__linha elenco__linha--${id}"><b>${porGrupo(id).length}</b> ${rotulo}</span>`).join('');
  const carta = (j) => {
    const g = gols.get(j.id);
    return htmlCarta(j, `data-ficha="${j.id}" aria-label="Ver ficha de ${escapar(j.nome)}"`, g ? `<span class="carta__gols">⚽ ${g}</span>` : '');
  };
  return `
    <section class="elenco" data-elenco="${time.id}">
      ${cabecalho ? `<header class="elenco__topo">
        ${escudo(time, 96)}
        <div class="elenco__titulo">
          <h2>${escapar(time.nome)}</h2>
          <p>${elenco.length} jogador${elenco.length === 1 ? '' : 'es'}</p>
          ${elenco.length ? `<div class="elenco__resumo">${resumo}</div>` : ''}
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
          const lista = porGrupo(g);
          return lista.length ? `
            <div class="elenco__grupo" data-grupo>
              <h3 class="elenco__grupo-titulo elenco__grupo-titulo--${g}">${rotulo}<span>${lista.length}</span></h3>
              <div class="cartas">${lista.map(carta).join('')}</div>
            </div>` : '';
        }).join('')}
        <p class="vazio oculto" data-sem-resultado>Nenhum jogador encontrado.</p>`
        : `<p class="vazio">${escapar(vazio)}</p>`}
    </section>`;
}

// Liga a busca e a ficha do jogador dentro de `container` (chamar depois de inserir o HTML)
export function ligarElenco(container, { time, jogadores, gols = new Map() }) {
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
    if (j) abrirFicha(j, time, gols.get(j.id) ?? 0);
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
