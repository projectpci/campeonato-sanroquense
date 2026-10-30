// Tela inicial: o app sempre abre aqui. O perfil em uso (torcedor, clube ou ADM) fica destacado com "Continuar"
// e entra direto, sem pedir código/senha de novo. Mostra o jogo ao vivo / próximos jogos e os escudos em movimento.
// Tudo aqui é "enfeite": se o banco não responder, a tela continua funcionando só com os dois botões.
import '../pwa.js';
import { listarTimes, listarJogos } from '../api.js';
import { semConfiguracao } from '../supabase.js';
import { escapar, escudo, formatarData, horaDoJogo, modoAtivo, definirModo } from '../ui.js';

window.__appIniciou = true; // js/resgate.js: a tela inicial abriu

// Perfil em uso (ou o último usado): o botão ganha o destaque "Continuar"
function lembrarPerfil() {
  let ultimo = modoAtivo();
  if (!ultimo) { try { ultimo = localStorage.getItem('perfil') ?? ''; } catch { /* sem armazenamento */ } }
  document.querySelectorAll('[data-modo]').forEach((a) => {
    if (a.dataset.modo === ultimo) {
      a.classList.add(a.classList.contains('entrada__adm') ? 'entrada__adm--ultimo' : 'entrada__opcao--ultimo');
      a.insertAdjacentHTML('afterbegin', '<span class="entrada__selo">Continuar</span>');
    }
    a.addEventListener('click', () => { definirModo(a.dataset.modo); try { localStorage.setItem('perfil', a.dataset.modo); } catch { /* sem armazenamento */ } });
  });
}

const TROCA_MS = 5000; // a faixa passa para o próximo jogo a cada 5 s
const JANELA_DIAS = 7;  // mostra os jogos até 7 dias depois do primeiro que vem
const MAX_JOGOS = 8;

const confronto = (j, centro) => `
  <span class="entrada__agora-jogo">${escudo(j.mandante, 32)}<b>${escapar(j.mandante.nome)}</b>
    <i>${centro}</i><b>${escapar(j.visitante.nome)}</b>${escudo(j.visitante, 32)}</span>`;

// Um "slide" por jogo: primeiro os ao vivo, depois os próximos agendados
function slidesDosJogos(jogos) {
  const agora = new Date();
  const hojeCedo = new Date(agora.toDateString()).getTime();
  const vivos = jogos.filter((j) => j.status === 'ao_vivo').map((j) => ({
    classe: 'entrada__agora--vivo',
    html: `<span class="entrada__agora-rotulo"><span class="ponto-vivo"></span>Ao vivo agora</span>${confronto(j, `${j.gols_mandante ?? 0} × ${j.gols_visitante ?? 0}`)}`,
  }));
  const futuros = jogos.filter((j) => j.status === 'agendado' && j.data_hora && new Date(j.data_hora).getTime() >= hojeCedo)
    .sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora));
  // até o fim do 7º dia depois do primeiro jogo (pega a rodada seguinte inteira)
  const limite = futuros.length ? new Date(new Date(futuros[0].data_hora).toDateString()).getTime() + (JANELA_DIAS + 1) * 86400000 - 1 : 0;
  const proximos = futuros.filter((j) => new Date(j.data_hora).getTime() <= limite).map((j) => {
    const hoje = new Date(j.data_hora).toDateString() === agora.toDateString();
    const dia = new Date(j.data_hora).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    const quando = hoje ? `Hoje · ${horaDoJogo(j)}` : `${dia} ${formatarData(j.data_hora)} · ${horaDoJogo(j)}`;
    return { classe: hoje ? 'entrada__agora--hoje' : '', html: `<span class="entrada__agora-rotulo">${hoje ? 'Hoje tem jogo' : 'Próximo jogo'} · ${escapar(quando)}</span>${confronto(j, '×')}` };
  });
  return [...vivos, ...proximos].slice(0, MAX_JOGOS);
}

// Carrossel da faixa: troca sozinho, pausa com a aba escondida ou com o dedo/mouse em cima; os pontinhos trocam na mão
function girarFaixa(alvo, slides) {
  alvo.innerHTML = `
    <span class="entrada__slides">${slides.map((s, i) => `<span class="entrada__slide${i ? '' : ' entrada__slide--ativo'}"${i ? ' aria-hidden="true"' : ''}>${s.html}</span>`).join('')}</span>
    ${slides.length > 1 ? `<span class="entrada__pontos" aria-hidden="true">${slides.map((_, i) => `<i data-slide="${i}" class="${i ? '' : 'ativo'}"></i>`).join('')}</span>` : ''}`;
  alvo.className = `entrada__agora ${slides[0].classe}`.trim();
  if (slides.length < 2) return;
  let atual = 0;
  let pausado = false;
  const mostrar = (n) => {
    atual = (n + slides.length) % slides.length;
    alvo.querySelectorAll('.entrada__slide').forEach((s, i) => {
      s.classList.toggle('entrada__slide--ativo', i === atual);
      if (i === atual) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
    });
    alvo.querySelectorAll('[data-slide]').forEach((p, i) => p.classList.toggle('ativo', i === atual));
    alvo.className = `entrada__agora ${slides[atual].classe}`.trim();
  };
  setInterval(() => { if (!pausado && !document.hidden) mostrar(atual + 1); }, TROCA_MS);
  alvo.addEventListener('pointerenter', () => { pausado = true; });
  alvo.addEventListener('pointerleave', () => { pausado = false; });
  alvo.querySelector('.entrada__pontos').addEventListener('click', (e) => {
    const ponto = e.target.closest('[data-slide]');
    if (!ponto) return;
    e.preventDefault(); // o pontinho troca o jogo; o resto da faixa abre o Início
    mostrar(Number(ponto.dataset.slide));
  });
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
    // jogos ao vivo e próximos jogos, girando
    const slides = slidesDosJogos(jogos);
    if (slides.length) girarFaixa(document.getElementById('entrada-agora'), slides);
  } catch { /* sem conexão: a tela segue só com as opções */ }
}

// "Sair" (index.html?sair) encerra o perfil: nenhum botão fica com "Continuar"
if (new URLSearchParams(location.search).has('sair')) {
  definirModo('');
  try { localStorage.removeItem('perfil'); } catch { /* sem armazenamento */ }
  history.replaceState(null, '', location.pathname);
}

lembrarPerfil();
enfeitar();
