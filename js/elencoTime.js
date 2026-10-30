// Elenco de um time (técnico + cartas dos jogadores), só leitura. Usado na página Elenco, na página do time e no painel.
import { POSICOES, htmlCarta, avatarJogador } from './escalacao.js';
import { escapar, escudo } from './ui.js';

const ORDEM = Object.fromEntries(POSICOES.map(([p], i) => [p, i]));

export const elencoAtivo = (jogadores, timeId) => jogadores
  .filter((j) => j.time_id === timeId && j.ativo !== false)
  .sort((a, b) => (ORDEM[a.posicao] ?? 9) - (ORDEM[b.posicao] ?? 9) || (a.numero ?? 99) - (b.numero ?? 99) || a.nome.localeCompare(b.nome));

export function htmlElenco(time, jogadores, vazio = 'O clube ainda não cadastrou o elenco.') {
  const elenco = elencoAtivo(jogadores, time.id);
  return `
    <div class="tecnico tecnico--leitura">${avatarJogador({ foto_url: time.tecnico_foto_url, numero: 'T' }, 'avatar avatar--medio')}
      <span><small>Técnico</small><strong>${escapar(time.tecnico_nome || 'Não cadastrado')}</strong></span></div>
    ${elenco.length ? `<div class="cartas">${elenco.map((j) => htmlCarta(j, '', '', 'div')).join('')}</div>` : `<p class="vazio">${vazio}</p>`}`;
}

// Chips com os escudos para escolher o time (com a quantidade de jogadores)
export const htmlEscolhaTime = (times, jogadores, selecionado) => `
  <div class="chips" aria-label="Escolher time">${times.map((t) => `
    <button class="chip chip--time${t.id === selecionado ? ' chip--ativo' : ''}" data-elenco-time="${t.id}" aria-pressed="${t.id === selecionado}">
      ${escudo(t, 32)} ${escapar(t.nome)} <small>${elencoAtivo(jogadores, t.id).length}</small></button>`).join('')}</div>`;
