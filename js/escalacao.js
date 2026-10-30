// Escalação: formações (11 jogadores) e o desenho do campo, usado na tela do clube e na arte para compartilhar.
import { escapar } from './ui.js';

// [rótulo, x %, y %] — y = 0 no ataque (topo do campo), 100 no gol
export const FORMACOES = {
  '4-4-2': [['GOL', 50, 90], ['LD', 86, 70], ['ZAG', 62, 75], ['ZAG', 38, 75], ['LE', 14, 70],
    ['MD', 86, 45], ['MC', 62, 50], ['MC', 38, 50], ['ME', 14, 45], ['ATA', 62, 20], ['ATA', 38, 20]],
  '4-3-3': [['GOL', 50, 90], ['LD', 86, 70], ['ZAG', 62, 75], ['ZAG', 38, 75], ['LE', 14, 70],
    ['VOL', 50, 56], ['MC', 74, 45], ['MC', 26, 45], ['PD', 82, 22], ['ATA', 50, 16], ['PE', 18, 22]],
  '4-2-3-1': [['GOL', 50, 90], ['LD', 86, 70], ['ZAG', 62, 75], ['ZAG', 38, 75], ['LE', 14, 70],
    ['VOL', 64, 57], ['VOL', 36, 57], ['MD', 84, 36], ['MEI', 50, 37], ['ME', 16, 36], ['ATA', 50, 15]],
  '3-5-2': [['GOL', 50, 90], ['ZAG', 76, 74], ['ZAG', 50, 76], ['ZAG', 24, 74], ['ALD', 88, 48],
    ['VOL', 63, 56], ['VOL', 37, 56], ['ALE', 12, 48], ['MEI', 50, 38], ['ATA', 64, 18], ['ATA', 36, 18]],
  '5-3-2': [['GOL', 50, 90], ['ALD', 88, 64], ['ZAG', 70, 75], ['ZAG', 50, 77], ['ZAG', 30, 75], ['ALE', 12, 64],
    ['MC', 74, 47], ['VOL', 50, 53], ['MC', 26, 47], ['ATA', 64, 20], ['ATA', 36, 20]],
  '4-1-4-1': [['GOL', 50, 90], ['LD', 86, 70], ['ZAG', 62, 75], ['ZAG', 38, 75], ['LE', 14, 70],
    ['VOL', 50, 58], ['MD', 86, 40], ['MC', 62, 43], ['MC', 38, 43], ['ME', 14, 40], ['ATA', 50, 16]],
};
export const FORMACAO_PADRAO = '4-4-2';

// Linhas do elenco (filtro e cor das cartas): [id, rótulo, posições]
export const LINHAS = [['todos', 'Todos', null], ['gol', 'Goleiros', ['GOL']], ['def', 'Defesa', ['ZAG', 'LAT']], ['mei', 'Meio', ['VOL', 'MEI']], ['ata', 'Ataque', ['ATA']]];
export const linhaDe = (posicao) => LINHAS.find(([, , grupos]) => grupos?.includes(posicao))?.[0] ?? 'sem';

export const POSICOES = [['GOL', 'Goleiro'], ['ZAG', 'Zagueiro'], ['LAT', 'Lateral'], ['VOL', 'Volante'], ['MEI', 'Meia'], ['ATA', 'Atacante']];

const primeiroNome = (nome) => {
  const partes = String(nome ?? '').trim().split(/\s+/);
  return partes.length > 1 && partes[0].length <= 3 ? partes.slice(0, 2).join(' ') : partes[0]; // "Zé Carlos" fica inteiro
};

export function avatarJogador(j, classe = 'avatar') {
  if (j?.foto_url) return `<img class="${classe}" src="${escapar(j.foto_url)}" alt="">`;
  return `<span class="${classe} ${classe.split(" ")[0]}--sem-foto">${escapar(j?.numero ?? j?.posicao ?? '?')}</span>`;
}

// Campo com as 11 vagas. `interativo`: vagas viram botões (tela do clube); senão, só desenho (arte)
export function htmlCampo({ formacao, titulares = {}, jogadores = [], interativo = false }) {
  const porId = new Map(jogadores.map((j) => [j.id, j]));
  const vagas = (FORMACOES[formacao] ?? FORMACOES[FORMACAO_PADRAO]).map(([rotulo, x, y], i) => {
    const j = porId.get(Number(titulares[i]));
    const tag = interativo ? 'button' : 'div';
    return `
      <${tag} class="gramado__vaga${j ? '' : ' gramado__vaga--vazia'}" ${interativo ? `type="button" data-vaga="${i}"` : ''} style="left:${x}%;top:${y}%">
        ${j ? avatarJogador(j, 'gramado__foto') : `<span class="gramado__foto gramado__foto--vazio">+</span>`}
        <span class="gramado__nome">${j ? `${j.foto_url && j.numero != null ? `<b>${j.numero}</b> ` : ''}${escapar(primeiroNome(j.nome))}` : rotulo}</span>
      </${tag}>`;
  }).join('');
  return `
    <div class="gramado">
      <span class="gramado__linha gramado__linha--meio"></span><span class="gramado__circulo"></span>
      <span class="gramado__area gramado__area--topo"></span><span class="gramado__area gramado__area--base"></span>
      <span class="gramado__pequena gramado__pequena--topo"></span><span class="gramado__pequena gramado__pequena--base"></span>
      ${vagas}
    </div>`;
}

// Carta do jogador (estilo figurinha): foto, número, posição e nome. `tag`: 'button' (clicável) ou 'div'
export function htmlCarta(j, atributos = '', extra = '', tag = 'button') {
  return `
    <${tag} class="carta carta--${linhaDe(j.posicao)}" ${atributos}>
      <span class="carta__foto">${j.foto_url ? `<img src="${escapar(j.foto_url)}" alt="" loading="lazy">` : `<span>${escapar((j.nome || '?').slice(0, 1))}</span>`}</span>
      ${j.numero != null ? `<span class="carta__numero">${j.numero}</span>` : ''}
      <span class="carta__posicao">${escapar(j.posicao ?? '—')}</span>
      <span class="carta__nome">${escapar(j.nome)}</span>
      ${extra}
    </${tag}>`;
}
