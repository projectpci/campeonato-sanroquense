// Avisos no celular (Web Push): gols, início e fim de jogo. Sem login; a inscrição fica só neste aparelho.
import { inscreverPush, cancelarPush, inscreverPushOrganizador, cancelarPushOrganizador } from './api.js';
import { escapar, escudo, icone, toast } from './ui.js';
import { meuTime } from './meuTime.js';

// Chave pública do servidor de avisos (a privada fica só no Supabase)
const CHAVE_PUBLICA = 'BB6nmNsK3G3T-UHNyK440ySnLvkMVE4ZPnRwHbDh0MCaF-GKRWsWXKp1Cf3JqPGWiRZY16jYkclZKEkjlFNXMao';
const CHAVE = 'avisos'; // { todos: boolean, times: number[] }

const suportado = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const noIphoneSemApp = () => /iphone|ipad/i.test(navigator.userAgent) && !suportado();

function lerEstado() {
  try { return { todos: false, times: [], ...JSON.parse(localStorage.getItem(CHAVE) ?? '{}') }; } catch { return { todos: false, times: [] }; }
}
function guardarEstado(estado) {
  try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch { /* sem armazenamento */ }
}

const paraBytes = (base64url) => {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
};

async function registroPronto() {
  const pronto = navigator.serviceWorker.ready;
  const limite = new Promise((_, rejeitar) => setTimeout(() => rejeitar(new Error('o app ainda não está pronto neste navegador')), 5000));
  return Promise.race([pronto, limite]);
}

async function obterInscricao() {
  if (Notification.permission === 'denied') throw new Error('as notificações estão bloqueadas neste navegador');
  if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') throw new Error('permissão não concedida');
  const registro = await registroPronto();
  return (await registro.pushManager.getSubscription())
    ?? registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: paraBytes(CHAVE_PUBLICA) });
}

const CHAVE_ORGANIZADOR = 'avisos_organizador';
const avisosDoOrganizador = () => { try { return localStorage.getItem(CHAVE_ORGANIZADOR) === '1'; } catch { return false; } };

async function salvar(estado) {
  if (!estado.todos && !estado.times.length) {
    const registro = await registroPronto().catch(() => null);
    const inscricao = await registro?.pushManager.getSubscription();
    if (inscricao) {
      await cancelarPush(inscricao.endpoint);
      if (!avisosDoOrganizador()) await inscricao.unsubscribe(); // o aparelho ainda recebe os avisos do organizador
    }
  } else {
    const inscricao = await obterInscricao();
    await inscreverPush(inscricao.toJSON(), estado.todos ? [] : estado.times);
  }
  guardarEstado(estado);
}

// `contexto.timeId`: botão de seguir um time · sem timeId: avisos de todos os jogos
export function botaoAvisos(container, contexto = {}) {
  if (!container) return;
  const { timeId, nome } = contexto;
  const desenhar = () => {
    if (noIphoneSemApp()) {
      container.innerHTML = `<p class="texto-2 texto-pequeno avisos">${icone('sino')} No iPhone, para receber avisos instale o app: Compartilhar → Adicionar à Tela de Início.</p>`;
      return;
    }
    if (!suportado()) { container.innerHTML = ''; return; }
    const estado = lerEstado();
    let ativo; let texto; let rotulo;
    if (timeId) {
      ativo = estado.todos || estado.times.includes(timeId);
      texto = estado.todos ? 'Você já recebe avisos de todos os jogos.' : `Avisos de gols e resultados de ${escapar(nome)}.`;
      rotulo = ativo ? 'Seguindo' : 'Seguir time';
    } else {
      ativo = estado.todos;
      texto = 'Receba no celular os gols e resultados em tempo real.';
      rotulo = ativo ? 'Avisos ligados' : 'Ativar avisos';
    }
    container.innerHTML = `<div class="avisos"><span class="texto-2 texto-pequeno">${texto}</span>
      <button class="botao ${ativo ? 'botao--secundario' : ''}" ${timeId && estado.todos ? 'disabled' : ''}>${icone('sino')} ${rotulo}</button></div>`;
    container.querySelector('button').addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      const atual = lerEstado();
      let novo;
      if (timeId) novo = { todos: false, times: atual.times.includes(timeId) ? atual.times.filter((t) => t !== timeId) : [...atual.times, timeId] };
      else novo = { todos: !atual.todos, times: atual.todos ? [] : atual.times };
      try {
        await salvar(novo);
        toast(novo.todos || novo.times.length ? 'Avisos ligados ✔' : 'Avisos desligados');
      } catch (erro) {
        toast(`Não foi possível ativar os avisos: ${erro.message}`, true);
      }
      desenhar();
    });
  };
  desenhar();
}

// Painel do organizador: avisa no celular quando um time manda foto para aprovar
export function botaoAvisosOrganizador(container) {
  if (!container) return;
  if (!suportado()) {
    container.innerHTML = noIphoneSemApp() ? '<p class="texto-2 texto-pequeno">No iPhone, instale o app para receber o aviso de fotos para aprovar.</p>' : '';
    return;
  }
  const desenhar = () => {
    const ativo = avisosDoOrganizador();
    container.innerHTML = `<button class="botao botao--secundario${ativo ? ' botao--ligado' : ''}" aria-pressed="${ativo}">
      ${icone('sino')} ${ativo ? 'Avisos de fotos ligados' : 'Avisar fotos para aprovar'}</button>`;
    container.querySelector('button').addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      try {
        if (ativo) {
          if (!confirm('Parar de receber o aviso de fotos para aprovar neste aparelho?')) { desenhar(); return; }
          const registro = await registroPronto().catch(() => null);
          const inscricao = await registro?.pushManager.getSubscription();
          if (inscricao) {
            await cancelarPushOrganizador(inscricao.endpoint);
            const torcedor = lerEstado();
            if (!torcedor.todos && !torcedor.times.length) await inscricao.unsubscribe();
          }
          try { localStorage.removeItem(CHAVE_ORGANIZADOR); } catch { /* sem armazenamento */ }
          toast('Avisos de fotos desligados');
        } else {
          await inscreverPushOrganizador((await obterInscricao()).toJSON());
          try { localStorage.setItem(CHAVE_ORGANIZADOR, '1'); } catch { /* sem armazenamento */ }
          toast('Pronto! Você vai receber um aviso quando chegar foto para aprovar ✔');
        }
      } catch (erro) {
        toast(`Não foi possível ativar os avisos: ${erro.message}`, true);
      }
      desenhar();
    });
  };
  desenhar();
}

// "Avisar de quê?": só os jogos do time do coração ou todos. Resolve 'meu', 'todos' ou null (fechou)
function escolherAlcance(time) {
  return new Promise((resolver) => {
    document.querySelector('dialog.dialogo')?.remove();
    const d = Object.assign(document.createElement('dialog'), {
      className: 'dialogo',
      innerHTML: `
        <div class="form">
          <h2>Avisos no celular</h2>
          <p class="texto-2 texto-pequeno">Gols, início e fim de jogo, na hora.</p>
          <button class="botao" type="button" data-alcance="meu">${escudo(time, 32)} Só os jogos do ${escapar(time.nome)}</button>
          <button class="botao botao--secundario" type="button" data-alcance="todos">Todos os jogos</button>
          <button class="link-botao centro" type="button" data-fechar>Agora não</button>
        </div>`,
    });
    let escolha = null;
    d.addEventListener('click', (e) => {
      const b = e.target.closest('[data-alcance]');
      if (b) escolha = b.dataset.alcance;
      if (b || e.target === d || e.target.closest('[data-fechar]')) d.close();
    });
    d.addEventListener('close', () => { d.remove(); resolver(escolha); });
    document.body.append(d);
    d.showModal();
  });
}

// Sino no canto do cabeçalho (todas as páginas públicas): liga/desliga os avisos (todos os jogos ou só os do meu time)
export function sinoNoCabecalho() {
  const sair = document.querySelector('.header .perfil');
  if (!sair || document.getElementById('btn-sino')) return;
  const semApp = noIphoneSemApp();
  if (!suportado() && !semApp) return;

  const botao = document.createElement('button');
  botao.id = 'btn-sino';
  botao.className = 'header__sino';
  sair.before(botao);

  const pintar = () => {
    const estado = lerEstado();
    const ativo = estado.todos || estado.times.length > 0;
    botao.classList.toggle('header__sino--ativo', ativo);
    botao.innerHTML = icone('sino');
    botao.setAttribute('aria-label', ativo ? 'Avisos ligados (toque para desligar)' : 'Ativar avisos de gols');
    botao.title = ativo ? 'Avisos ligados' : 'Ativar avisos de gols';
  };

  botao.addEventListener('click', async () => {
    if (semApp) { location.href = 'instalar.html'; return; } // iPhone: precisa instalar o app primeiro
    const estado = lerEstado();
    const ativo = estado.todos || estado.times.length > 0;
    if (ativo && !confirm('Desligar os avisos de gols neste aparelho?')) return;
    // com time do coração: escolhe entre só os jogos dele ou todos
    const time = meuTime();
    const escolha = ativo ? 'nenhum' : time ? await escolherAlcance(time) : 'todos';
    if (!escolha) return;
    botao.disabled = true;
    try {
      await salvar(escolha === 'nenhum' ? { todos: false, times: [] } : escolha === 'meu' ? { todos: false, times: [time.id] } : { todos: true, times: [] });
      toast(escolha === 'nenhum' ? 'Avisos desligados' : escolha === 'meu' ? `Avisos dos jogos do ${time.nome} ligados ✔` : 'Avisos ligados ✔');
    } catch (erro) {
      toast(`Não foi possível ativar os avisos: ${erro.message}`, true);
    }
    botao.disabled = false;
    pintar();
    document.dispatchEvent(new CustomEvent('avisos-mudou'));
  });
  pintar();
}
