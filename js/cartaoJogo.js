// Renderiza o card de um jogo (usado em Confrontos e Início).
import { escapar, escudo, formatarData, horaDoJogo, icone } from './ui.js';
import { registrarJogo } from './compartilharJogo.js';

function listaGols(jogo, timeId) {
  return (jogo.gols ?? [])
    .filter((g) => g.time_id === timeId)
    .map((g) => {
      const nome = g.jogador?.nome ?? 'Gol contra';
      const detalhe = g.contra ? ' (contra)' : g.quantidade > 1 ? ` (${g.quantidade})` : '';
      return `<li>⚽ ${escapar(nome)}${detalhe}</li>`;
    })
    .join('');
}

// `extras` (só no painel do organizador): { acao } vai ao lado do selo de status, { rodape } vai no fim do card.
export function cartaoJogo(jogo, extras = {}) {
  const encerrado = jogo.status === 'encerrado';
  const aoVivo = jogo.status === 'ao_vivo';
  const centro = encerrado || aoVivo
    ? `<strong class="jogo__placar">${jogo.gols_mandante} <span>×</span> ${jogo.gols_visitante}</strong>`
    : `<span class="jogo__versus">×</span><span class="texto-2 texto-pequeno">${escapar(horaDoJogo(jogo))}</span>`;
  const rotuloStatus = { agendado: 'Agendado', ao_vivo: 'Ao vivo', encerrado: 'Encerrado', adiado: 'Adiado', wo: 'W.O.' }[jogo.status];
  const data = jogo.data_hora ? formatarData(jogo.data_hora) : '';
  registrarJogo(jogo);
  const compartilhar = `<button class="jogo__compartilhar" data-compartilhar-jogo="${jogo.id}" aria-label="Compartilhar este jogo no WhatsApp" title="Compartilhar">${icone('whatsapp')}</button>`;

  return `
    <article class="card jogo">
      <header class="jogo__topo">
        <span class="texto-2 texto-pequeno">${escapar(data)}</span>
        <span class="jogo__topo-dir">
          <span class="selo${encerrado ? ' selo--encerrado' : aoVivo ? ' selo--aovivo' : ''}">${rotuloStatus}</span>
          ${compartilhar}${extras.acao ?? ''}
        </span>
      </header>
      <div class="jogo__confronto">
        <div class="jogo__time">${escudo(jogo.mandante, 48)}<span>${escapar(jogo.mandante.nome)}</span></div>
        <div class="jogo__centro">${centro}</div>
        <div class="jogo__time">${escudo(jogo.visitante, 48)}<span>${escapar(jogo.visitante.nome)}</span></div>
      </div>
      ${encerrado ? `
      <div class="jogo__gols">
        <ul>${listaGols(jogo, jogo.mandante_id)}</ul>
        <ul>${listaGols(jogo, jogo.visitante_id)}</ul>
      </div>` : ''}
      ${extras.rodape ?? ''}
    </article>`;
}
