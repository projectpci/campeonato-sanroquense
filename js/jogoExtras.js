// Botões do card do jogo para a torcida: ver as escalações publicadas e votar no craque do jogo.
import { buscarEscalacoesJogo, listarJogadores, craqueResultado, votarCraque } from './api.js';
import { jogoRegistrado } from './compartilharJogo.js';
import { htmlCampo, htmlCarta } from './escalacao.js';
import { escapar, escudo, toast, aparelho } from './ui.js';
const meusVotos = () => { try { return JSON.parse(localStorage.getItem('craque_votos') ?? '{}'); } catch { return {}; } };
const guardarVoto = (jogoId, jogadorId) => {
  try { localStorage.setItem('craque_votos', JSON.stringify({ ...meusVotos(), [jogoId]: jogadorId })); } catch { /* sem armazenamento */ }
};

function abrirDialogo(html) {
  document.querySelector('dialog.dialogo')?.remove();
  const d = Object.assign(document.createElement('dialog'), { className: 'dialogo dialogo--folha', innerHTML: html });
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-fechar]')) d.close(); });
  document.body.append(d);
  d.showModal();
  return d;
}

const topo = (titulo, jogo) => `
  <div class="folha__topo"><h2>${titulo}</h2><button class="botao botao--secundario" data-fechar>Fechar</button></div>
  <p class="texto-2 texto-pequeno">${escapar(jogo.mandante.nome)} × ${escapar(jogo.visitante.nome)}${jogo.rodada?.numero ? ` · Rodada ${jogo.rodada.numero}` : ''}</p>`;

// ---------- Escalações publicadas ----------
async function verEscalacoes(jogo) {
  const d = abrirDialogo(`<div class="form">${topo('Escalações', jogo)}<div data-corpo><p class="carregando">Carregando...</p></div></div>`);
  try {
    const [escalacoes, jogadores] = await Promise.all([buscarEscalacoesJogo(jogo.id), listarJogadores()]);
    const times = [jogo.mandante, jogo.visitante].filter((t) => escalacoes.some((e) => e.time_id === t.id));
    let atual = times[0]?.id;
    const corpo = d.querySelector('[data-corpo]');
    const pintar = () => {
      const esc = escalacoes.find((e) => e.time_id === atual);
      const doTime = jogadores.filter((j) => j.time_id === atual);
      const banco = (esc.reservas ?? []).map((id) => doTime.find((j) => j.id === id)).filter(Boolean);
      corpo.innerHTML = `
        ${times.length > 1 ? `<div class="segmentos">${times.map((t) =>
          `<button class="segmento${t.id === atual ? ' segmento--ativo' : ''}" data-time-esc="${t.id}">${escapar(t.nome)}</button>`).join('')}</div>` : ''}
        <p class="centro"><b>${escapar(times.find((t) => t.id === atual).nome)}</b> · ${escapar(esc.formacao)}</p>
        ${htmlCampo({ formacao: esc.formacao, titulares: esc.titulares, jogadores: doTime })}
        ${banco.length ? `<h3>Reservas</h3><p class="texto-2">${banco.map((j) => `${j.numero != null ? `${j.numero} · ` : ''}${escapar(j.nome)}`).join(' · ')}</p>` : ''}`;
      corpo.querySelectorAll('[data-time-esc]').forEach((b) => b.addEventListener('click', () => { atual = Number(b.dataset.timeEsc); pintar(); }));
    };
    if (atual) pintar(); else corpo.innerHTML = '<p class="vazio">Nenhuma escalação publicada.</p>';
  } catch (erro) {
    toast(erro.message, true);
  }
}

// ---------- Craque do jogo ----------
async function craqueDoJogo(jogo) {
  const d = abrirDialogo(`<div class="form">${topo('Craque do jogo ⭐', jogo)}<div data-corpo><p class="carregando">Carregando...</p></div></div>`);
  const corpo = d.querySelector('[data-corpo]');
  try {
    const [resultado, todos] = await Promise.all([craqueResultado(jogo.id), listarJogadores()]);
    const candidatos = todos.filter((j) => j.ativo !== false && [jogo.mandante_id, jogo.visitante_id].includes(j.time_id));
    const pintar = (res) => {
      const total = res.votos.reduce((s, v) => s + v.votos, 0);
      const votosDe = (id) => res.votos.find((v) => v.jogador_id === id)?.votos ?? 0;
      const maior = Math.max(0, ...res.votos.map((v) => v.votos));
      const meu = meusVotos()[jogo.id];
      if (!candidatos.length) { corpo.innerHTML = '<p class="vazio">Os clubes ainda não cadastraram o elenco deste jogo.</p>'; return; }
      const bloco = (time) => `
        <h3 class="craque__time">${escudo(time, 32)} ${escapar(time.nome)}</h3>
        <div class="cartas cartas--folha">${candidatos.filter((j) => j.time_id === time.id).map((j) => {
          const n = votosDe(j.id);
          const pct = total ? Math.round((n / total) * 100) : 0;
          const marca = `${res.aberta ? '' : n === maior && n > 0 ? '<span class="craque__selo">Craque!</span>' : ''}
            ${total ? `<span class="craque__barra"><i style="width:${pct}%"></i></span><span class="carta__marca">${n} voto${n === 1 ? '' : 's'} · ${pct}%</span>` : ''}
            ${meu === j.id ? '<span class="carta__marca">Seu voto ✓</span>' : ''}`;
          return htmlCarta(j, res.aberta ? `data-votar="${j.id}"${meu === j.id ? ' aria-current="true"' : ''}` : '', marca, res.aberta ? 'button' : 'div');
        }).join('')}</div>`;
      corpo.innerHTML = `
        <p class="texto-2 texto-pequeno">${res.aberta
          ? `Toque no jogador para votar${meu ? ' (dá para trocar o voto)' : ''}.${res.encerra_em
            ? ` Votação aberta até ${new Date(res.encerra_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}.` : ''}`
          : 'Votação encerrada.'} ${total} voto${total === 1 ? '' : 's'}.</p>
        ${bloco(jogo.mandante)}${bloco(jogo.visitante)}`;
    };
    pintar(resultado);
    corpo.addEventListener('click', async (e) => {
      const carta = e.target.closest('[data-votar]');
      if (!carta) return;
      carta.disabled = true;
      try {
        const id = Number(carta.dataset.votar);
        const novo = await votarCraque(jogo.id, id, aparelho());
        guardarVoto(jogo.id, id);
        toast('Voto registrado ⭐');
        pintar(novo);
      } catch (erro) {
        toast(erro.message, true);
        carta.disabled = false;
      }
    });
  } catch (erro) {
    corpo.innerHTML = `<p class="aviso">${escapar(erro.message)}</p>`;
  }
}

document.addEventListener('click', (e) => {
  const esc = e.target.closest('[data-ver-escalacao]');
  const craque = e.target.closest('[data-craque]');
  if (!esc && !craque) return;
  e.preventDefault();
  const jogo = jogoRegistrado(esc ? esc.dataset.verEscalacao : craque.dataset.craque);
  if (!jogo) return;
  if (esc) verEscalacoes(jogo); else craqueDoJogo(jogo);
});

