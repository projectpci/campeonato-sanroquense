// Renderiza o card de um jogo (usado em Confrontos e Início).
import { escapar, escudo, formatarData, horaDoJogo, icone } from './ui.js';
import { registrarJogo } from './compartilharJogo.js';
import { chanceDoCard } from './probabilidade.js';
import { ligarTorcidaOnline } from './torcidaOnline.js';
import './jogoExtras.js'; // botões "Escalações" e "Craque do jogo"

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

// Cor de um lado da barra pelo próprio percentual: vermelho (≤35%) → amarelo (50%) → verde (≥65%)
function corDaChance(pct) {
  const peso = (de, ate) => Math.round(Math.min(1, Math.max(0, (pct - de) / (ate - de))) * 100);
  return pct >= 50
    ? `color-mix(in oklab, var(--cor-chance-alta) ${peso(50, 65)}%, var(--cor-chance-media))`
    : `color-mix(in oklab, var(--cor-chance-media) ${peso(35, 50)}%, var(--cor-chance-baixa))`;
}

// Barra "Chance de vitória" (só nos próximos jogos; ver js/probabilidade.js)
function htmlChance(jogo) {
  const c = chanceDoCard(jogo);
  if (!c) return '';
  const favoritoMandante = c.mandante >= c.visitante;
  const lado = (pct, favorito) => `<span class="${favorito ? 'chance__favorito' : ''}" style="color:${corDaChance(pct)}">${pct}%</span>`;
  return `
    <div class="chance" role="img" aria-label="Chance de vitória: ${escapar(jogo.mandante.nome)} ${c.mandante}%, ${escapar(jogo.visitante.nome)} ${c.visitante}%">
      <div class="chance__rotulos">
        ${lado(c.mandante, favoritoMandante)}
        <span class="chance__titulo" title="Calculada pela força dos times nos resultados do campeonato (vitórias, saldo de gols e adversários enfrentados) e pelo mando de campo">Chance de vitória</span>
        ${lado(c.visitante, !favoritoMandante)}
      </div>
      <div class="chance__barra">
        <i style="flex-grow:${c.mandante};background:${corDaChance(c.mandante)}"></i>
        <i style="flex-grow:${c.visitante};background:${corDaChance(c.visitante)}"></i>
      </div>
    </div>`;
}

// Espaço da torcida online (preenchido por js/torcidaOnline.js): jogos ao vivo e próximos jogos
function htmlTorcida(jogo, aoVivo) {
  if (!aoVivo && !chanceDoCard(jogo)) return '';
  ligarTorcidaOnline();
  return `
    <div class="jogo__torcida oculto" data-torcida data-m="${jogo.mandante_id}" data-v="${jogo.visitante_id}" data-vivo="${aoVivo ? 1 : 0}">
      ${aoVivo ? '<span class="jogo__acompanhando"><span class="ponto-online" aria-hidden="true"></span><b data-total>0</b> acompanhando agora</span>' : ''}
      <span class="jogo__torcida-placar oculto"><small>Torcida online</small>${escudo(jogo.mandante, 32)}<b data-tm>0</b><i>×</i><b data-tv>0</b>${escudo(jogo.visitante, 32)}</span>
    </div>`;
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
  const temEscalacao = (jogo.escalacoes ?? []).length > 0;
  const botoes = temEscalacao || encerrado ? `
    <div class="jogo__acoes">
      ${temEscalacao ? `<button class="jogo__acao" data-ver-escalacao="${jogo.id}">📋 Escalações</button>` : ''}
      ${encerrado ? `<button class="jogo__acao" data-craque="${jogo.id}">⭐ Craque do jogo</button>` : ''}
    </div>` : '';
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
      ${htmlChance(jogo)}
      ${htmlTorcida(jogo, aoVivo)}
      ${encerrado ? `
      <div class="jogo__gols">
        <ul>${listaGols(jogo, jogo.mandante_id)}</ul>
        <ul>${listaGols(jogo, jogo.visitante_id)}</ul>
      </div>` : ''}
      ${botoes}
      ${extras.rodape ?? ''}
    </article>`;
}
