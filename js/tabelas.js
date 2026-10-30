// Tabela de classificação e lista de artilheiros (páginas do torcedor e painel do organizador).
import { escapar, escudo, icone } from './ui.js';

const CLASSES_PODIO = ['ouro', 'prata', 'bronze'];
const sinal = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

function celulaPosicao(posicao) {
  const classe = CLASSES_PODIO[posicao - 1];
  return classe
    ? `<td class="pos ${classe}">${icone('coroa')} ${posicao}º</td>`
    : `<td class="pos">${posicao}º</td>`;
}

// `link`: nome do time abre a página do time (no painel fica sem link, para não sair dele)
export function htmlTabela(linhas, { link = true } = {}) {
  const nome = (t) => (link
    ? `<a class="time__nome" href="time.html?id=${t.time_id}">${escudo(t, 32)} ${escapar(t.nome)}</a>`
    : `<span class="time__nome">${escudo(t, 32)} ${escapar(t.nome)}</span>`);
  const corpo = linhas.map((t) => `
    <tr>
      ${celulaPosicao(t.posicao)}
      <td class="time">${nome(t)}</td>
      <td class="pts">${t.pts}</td>
      <td>${t.j}</td><td>${t.v}</td><td>${t.e}</td><td>${t.d}</td>
      <td class="col-extra">${t.gp}</td><td class="col-extra">${t.gc}</td>
      <td class="${t.sg > 0 ? 'positivo' : t.sg < 0 ? 'negativo' : ''}">${sinal(t.sg)}</td>
    </tr>`).join('');
  return `
    <div class="tabela-rolagem">
      <table class="tabela">
        <thead><tr>
          <th>Pos</th><th>Time</th><th>PTS</th><th>J</th><th>V</th><th>E</th><th>D</th>
          <th class="col-extra">GP</th><th class="col-extra">GC</th><th>SG</th>
        </tr></thead>
        <tbody>${corpo}</tbody>
      </table>
    </div>`;
}

export function linhaArtilheiro(a) {
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
