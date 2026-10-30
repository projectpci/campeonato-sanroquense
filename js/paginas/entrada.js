// Tela inicial: lembra o último perfil, mostra o jogo ao vivo / próximo jogo e os escudos dos times em movimento.
// Tudo aqui é "enfeite": se o banco não responder, a tela continua funcionando só com os dois botões.
import '../pwa.js';
import { listarTimes, listarJogos } from '../api.js';
import { semConfiguracao } from '../supabase.js';
import { escapar, escudo, formatarData, horaDoJogo } from '../ui.js';

const CHAVE_PERFIL = 'perfil';

// Último perfil usado: o botão ganha destaque "Continuar"
function lembrarPerfil() {
  let ultimo = '';
  try { ultimo = localStorage.getItem(CHAVE_PERFIL) ?? ''; } catch { /* sem armazenamento */ }
  document.querySelectorAll('[data-perfil]').forEach((a) => {
    if (a.dataset.perfil === ultimo) {
      a.classList.add('entrada__opcao--ultimo');
      a.insertAdjacentHTML('afterbegin', '<span class="entrada__selo">Continuar</span>');
    }
    a.addEventListener('click', () => { try { localStorage.setItem(CHAVE_PERFIL, a.dataset.perfil); } catch { /* sem armazenamento */ } });
  });
}

function faixaDoJogo(jogos) {
  const agora = new Date();
  const aoVivo = jogos.find((j) => j.status === 'ao_vivo');
  const confronto = (j, centro) => `
    <span class="entrada__agora-jogo">${escudo(j.mandante, 32)}<b>${escapar(j.mandante.nome)}</b>
      <i>${centro}</i><b>${escapar(j.visitante.nome)}</b>${escudo(j.visitante, 32)}</span>`;
  if (aoVivo) {
    return { classe: 'entrada__agora--vivo', html: `<span class="entrada__agora-rotulo"><span class="ponto-vivo"></span>Ao vivo agora</span>${confronto(aoVivo, `${aoVivo.gols_mandante ?? 0} × ${aoVivo.gols_visitante ?? 0}`)}` };
  }
  const proximo = jogos.find((j) => j.status === 'agendado' && j.data_hora && new Date(j.data_hora) >= new Date(agora.toDateString()));
  if (!proximo) return null;
  const hoje = new Date(proximo.data_hora).toDateString() === agora.toDateString();
  const dia = new Date(proximo.data_hora).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  const quando = hoje ? `Hoje · ${horaDoJogo(proximo)}` : `${dia} ${formatarData(proximo.data_hora)} · ${horaDoJogo(proximo)}`;
  return { classe: hoje ? 'entrada__agora--hoje' : '', html: `<span class="entrada__agora-rotulo">${hoje ? 'Hoje tem jogo' : 'Próximo jogo'} · ${escapar(quando)}</span>${confronto(proximo, '×')}` };
}

async function enfeitar() {
  if (semConfiguracao) return;
  try {
    const [times, jogos] = await Promise.all([listarTimes(), listarJogos()]);
    const ativos = times.filter((t) => t.ativo !== false);
    // números do campeonato
    const numeros = document.querySelectorAll('.entrada__numeros b');
    if (numeros.length >= 2) { numeros[0].textContent = ativos.length; numeros[1].textContent = jogos.length; }
    // escudos em fila contínua (a lista vai duas vezes para o movimento não ter emenda)
    const faixa = document.getElementById('entrada-escudos');
    const um = ativos.map((t) => escudo(t, 48)).join('');
    faixa.innerHTML = um + um;
    faixa.classList.add('entrada__faixa--andando');
    // jogo ao vivo ou próximo jogo
    const info = faixaDoJogo(jogos);
    const alvo = document.getElementById('entrada-agora');
    if (info) {
      alvo.innerHTML = info.html;
      if (info.classe) alvo.classList.add(info.classe);
      alvo.classList.remove('oculto');
    }
  } catch { /* sem conexão: a tela segue só com as opções */ }
}

lembrarPerfil();
enfeitar();
