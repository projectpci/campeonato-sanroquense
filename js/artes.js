// Templates das artes exportadas em PNG (1080×1350). Só montam HTML; o CSS está em compartilhar.css.
import { escapar, escudo, formatarData, horaDoJogo } from './ui.js';
import { htmlCampo, avatarJogador } from './escalacao.js';

const hoje = () => new Date().toLocaleDateString('pt-BR');
const sinal = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
const COR_PODIO = ['ouro', 'prata', 'bronze'];

// QR code do site gerado no próprio navegador (qrcode-generator, via CDN) — grátis e sem serviço externo
function qrCodeSite() {
  if (typeof window.qrcode !== 'function') return '';
  const qr = window.qrcode(0, 'M');
  qr.addData(new URL('./', location.href).href);
  qr.make();
  return qr.createDataURL(8, 4);
}

function moldura(titulo, faixa, campeonato, corpo) {
  const qr = qrCodeSite();
  return `
    <header class="arte__topo">
      <h1 class="arte__titulo">${escapar(titulo)}</h1>
      <div class="arte__info">
        <div><small>Local</small>${escapar(campeonato.local ?? '')}</div>
        <div><small>Organização</small>${escapar(campeonato.organizacao ?? '')}</div>
      </div>
      <h2 class="arte__faixa">${escapar(faixa)}</h2>
    </header>
    ${corpo}
    <footer class="arte__rodape">
      <div class="arte__frases">
        <span>Respeito é a base do jogo!</span>
        <span>Futebol é união!</span>
        <span class="arte__atualizado">Atualizado em ${hoje()}</span>
      </div>
      ${qr ? `<div class="arte__qr"><img src="${qr}" alt="QR code do site"><span>Acompanhe<br>no site</span></div>` : ''}
    </footer>`;
}

export function arteClassificacao(campeonato, linhas) {
  const corpo = linhas.map((t) => `
    <div class="arte-linha arte-linha--classif">
      <span class="arte-pos ${COR_PODIO[t.posicao - 1] ?? ''}">${t.posicao}º</span>
      <span class="arte-time">${escudo(t, 48)} ${escapar(t.nome)}</span>
      <span class="arte-pts">${t.pts}</span>
      <span>${t.j}</span><span>${t.v}</span><span>${t.e}</span><span>${t.d}</span>
      <span>${t.gp}</span><span>${t.gc}</span><span>${sinal(t.sg)}</span>
    </div>`).join('');
  return moldura(campeonato.nome, 'Tabela de classificação', campeonato, `
    <div class="arte-tabela">
      <div class="arte-linha arte-linha--classif arte-linha--cab">
        <span>Pos</span><span>Time</span><span>PTS</span><span>J</span><span>V</span><span>E</span><span>D</span><span>GP</span><span>GC</span><span>SG</span>
      </div>${corpo}</div>`);
}

export function arteRodada(campeonato, rodada, jogos) {
  const data = rodada.data ? ` · ${formatarData(rodada.data)}` : '';
  const gols = (j, timeId) => (j.gols ?? []).filter((g) => g.time_id === timeId)
    .map((g) => `${escapar(g.jogador?.nome ?? 'Gol contra')}${g.contra ? ' (contra)' : g.quantidade > 1 ? ` (${g.quantidade})` : ''}`).join(', ');
  const cartoes = jogos.map((j) => {
    const encerrado = j.status === 'encerrado';
    return `
      <div class="arte-jogo">
        <div class="arte-jogo__linha">
          <span class="arte-jogo__time">${escapar(j.mandante.nome)} ${escudo(j.mandante, 48)}</span>
          <strong class="arte-jogo__placar">${encerrado ? `${j.gols_mandante} × ${j.gols_visitante}` : '×'}</strong>
          <span class="arte-jogo__time arte-jogo__time--v">${escudo(j.visitante, 48)} ${escapar(j.visitante.nome)}</span>
        </div>
        ${encerrado ? `<div class="arte-jogo__gols"><span>${gols(j, j.mandante_id)}</span><span>${gols(j, j.visitante_id)}</span></div>` : ''}
      </div>`;
  }).join('');
  return moldura(campeonato.nome, `Rodada ${rodada.numero}${data}`, campeonato, `<div class="arte-jogos">${cartoes}</div>`);
}

export function arteArtilharia(campeonato, artilheiros) {
  const corpo = artilheiros.slice(0, 10).map((a) => `
    <div class="arte-linha arte-linha--art">
      <span class="arte-pos ${COR_PODIO[a.posicao - 1] ?? ''}">${a.posicao}º</span>
      <span class="arte-time arte-time--col"><b>${escapar(a.jogador)}</b><small>${escapar(a.time)}</small></span>
      ${escudo({ nome: a.time, escudo_url: a.escudo_url }, 48)}
      <span class="arte-pts">${a.gols}</span>
    </div>`).join('');
  return moldura(campeonato.nome, 'Artilharia', campeonato, `<div class="arte-tabela">${corpo}</div>`);
}

// Um jogo: antes ("Hoje tem jogo" / "Próximo jogo"), durante ("Ao vivo") e depois ("Resultado final" com os autores)
export function arteJogo(campeonato, jogo) {
  const encerrado = jogo.status === 'encerrado';
  const aoVivo = jogo.status === 'ao_vivo';
  const hoje = jogo.data_hora && new Date(jogo.data_hora).toDateString() === new Date().toDateString();
  const faixa = encerrado ? 'Resultado final' : aoVivo ? 'Ao vivo' : hoje ? 'Hoje tem jogo' : 'Próximo jogo';
  const quando = [jogo.rodada?.numero ? `Rodada ${jogo.rodada.numero}` : '', jogo.data_hora ? formatarData(jogo.data_hora) : '',
    jogo.data_hora && !encerrado ? horaDoJogo(jogo) : ''].filter(Boolean).join(' · ');
  const gols = (timeId) => (jogo.gols ?? []).filter((g) => g.time_id === timeId)
    .map((g) => `<span>⚽ ${escapar(g.jogador?.nome ?? 'Gol contra')}${g.contra ? ' (contra)' : g.quantidade > 1 ? ` (${g.quantidade})` : ''}</span>`).join('');
  const time = (t) => `<div class="arte-partida__time">${escudo(t, 48)}<strong>${escapar(t.nome)}</strong></div>`;
  const centro = encerrado || aoVivo
    ? `<div class="arte-partida__placar"><b>${jogo.gols_mandante ?? 0}</b><i>×</i><b>${jogo.gols_visitante ?? 0}</b></div>`
    : '<div class="arte-partida__placar arte-partida__placar--vs"><i>×</i></div>';
  const autores = encerrado && (jogo.gols ?? []).length
    ? `<div class="arte-partida__gols"><div>${gols(jogo.mandante_id)}</div><div>${gols(jogo.visitante_id)}</div></div>` : '';
  return moldura(campeonato.nome, faixa, campeonato, `
    <div class="arte-partida">
      <p class="arte-partida__quando">${escapar(quando)}</p>
      <div class="arte-partida__confronto">${time(jogo.mandante)}${centro}${time(jogo.visitante)}</div>
      ${autores}
      ${!encerrado && !aoVivo ? '<p class="arte-partida__chamada">Vem pro Campo Maicon Santos!</p>' : ''}
    </div>`);
}

// Escalação no campo (padrão das transmissões): time, próximo jogo, 11 titulares, reservas e técnico
export function arteEscalacao(campeonato, time, { formacao, titulares, reservas = [] }, jogadores, jogo) {
  const qr = qrCodeSite();
  const adversario = jogo ? (jogo.mandante_id === time.id ? jogo.visitante : jogo.mandante) : null;
  const infoJogo = jogo ? `x ${escapar(adversario.nome)} · ${formatarData(jogo.data_hora)} · ${horaDoJogo(jogo)}` : '';
  const banco = reservas.map((id) => jogadores.find((j) => j.id === id)).filter(Boolean)
    .map((j) => `<span>${j.numero != null ? `<b>${j.numero}</b> ` : ''}${escapar(j.nome)}</span>`).join('');
  const tecnico = time.tecnico_nome ? `
    <div class="arte-esc__tecnico">${avatarJogador({ foto_url: time.tecnico_foto_url, numero: 'T' }, 'arte-esc__foto')}
      <div><small>Técnico</small>${escapar(time.tecnico_nome)}</div></div>` : '';
  return `
    <header class="arte-esc__topo">
      ${escudo(time, 48)}
      <div class="arte-esc__titulo">
        <h1>${escapar(time.nome)}</h1>
        <p>Escalação · ${escapar(formacao)}${infoJogo ? ` · ${infoJogo}` : ''}</p>
      </div>
      ${adversario ? escudo(adversario, 48) : ''}
    </header>
    <div class="arte-esc__campo">${htmlCampo({ formacao, titulares, jogadores })}</div>
    <footer class="arte-esc__base">
      <div class="arte-esc__banco"><small>Reservas</small><div>${banco || '—'}</div>
        <span class="arte__atualizado">${escapar(campeonato.nome)} · ${escapar(campeonato.local ?? '')}</span></div>
      ${tecnico}
      ${qr ? `<div class="arte__qr"><img src="${qr}" alt="QR code do site"></div>` : ''}
    </footer>`;
}

// Insere (ou troca) a arte oculta no body e devolve o elemento
export function inserirArte(id, html) {
  document.getElementById(id)?.remove();
  const el = Object.assign(document.createElement('div'), { id, className: 'arte', innerHTML: html });
  document.body.append(el);
  return el;
}
