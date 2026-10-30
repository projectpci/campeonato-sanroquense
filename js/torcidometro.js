// Torcidômetro: ranking das torcidas (torcedores que escolheram o time do coração) e quantos estão online agora.
// Fica numa barra compacta no topo de todas as páginas (torcedor, clube e organizador); toque para abrir a lista completa.
import { listarTimes, torcidaDeclarada } from './api.js';
import { aoMudarOnline } from './presenca.js';
import { meuTime } from './meuTime.js';
import { escapar, escudo } from './ui.js';

const CHAVE = 'torcidometro_cache';
const VALIDADE_MS = 60 * 1000; // trocar de página não repete a consulta

const lerCache = () => { try { const c = JSON.parse(sessionStorage.getItem(CHAVE)); return c && Date.now() - c.em < VALIDADE_MS ? c : null; } catch { return null; } };
const guardarCache = (dados) => { try { sessionStorage.setItem(CHAVE, JSON.stringify({ ...dados, em: Date.now() })); } catch { /* sem armazenamento */ } };

// Time "da casa" para destacar: o do coração (torcedor) ou o clube logado
function meuTimeId() {
  const doTorcedor = meuTime()?.id;
  if (doTorcedor) return doTorcedor;
  try { return JSON.parse(localStorage.getItem('clube_selo'))?.id ?? null; } catch { return null; }
}

function linhasDoRanking(times, declarados, online) {
  return times.filter((t) => t.ativo !== false)
    .map((t) => ({ t, n: declarados[t.id] ?? 0, on: online?.torcida?.[t.id] ?? 0 }))
    .sort((a, b) => b.n - a.n || a.t.nome.localeCompare(b.t.nome));
}

function htmlBarra(linhas, total, online, aberto) {
  const lider = linhas[0];
  const resumo = total && lider.n
    ? `${escudo(lider.t, 32)}<b>${escapar(lider.t.nome)}</b><em>${lider.n}</em>`
    : '<span class="texto-2">Escolha seu time do coração</span>';
  return `
    <button class="torcidometro__barra" type="button" aria-expanded="${aberto}" aria-controls="torcidometro-lista">
      <span class="torcidometro__titulo">❤️ Torcidômetro</span>
      <span class="torcidometro__lider">${resumo}</span>
      <span class="torcidometro__online" title="Torcedores com o app aberto agora"><span class="ponto-online" aria-hidden="true"></span>${online?.torcedores ?? 0}</span>
      <span class="torcidometro__seta" aria-hidden="true">▾</span>
    </button>`;
}

function htmlLista(linhas, total, online, meu) {
  const maior = Math.max(1, ...linhas.map((l) => l.n));
  return `
    <p class="torcidometro__total"><strong>${total}</strong> ${total === 1 ? 'torcedor declarou' : 'torcedores declararam'} um time do coração</p>
    <ol class="torcidas">${linhas.map(({ t, n, on }, i) => `
      <li class="torcidas__linha${t.id === meu ? ' torcidas__linha--meu' : ''}">
        <span class="torcidas__pos">${i + 1}º</span>${escudo(t, 32)}
        <span class="torcidas__nome">${escapar(t.nome)}<i style="width:${Math.round((n / maior) * 100)}%"></i></span>
        <span class="torcidas__n"><strong>${n}</strong>${total ? `<small>${Math.round((n / total) * 100)}%</small>` : ''}</span>
        <span class="torcidas__on${on ? '' : ' torcidas__on--zero'}" title="Online agora">● ${on}</span>
      </li>`).join('')}</ol>
    <p class="texto-2 texto-pequeno">Cada aparelho que escolheu o time do coração conta 1. ● = torcedores desse time com o app aberto agora.</p>`;
}

export function montarTorcidometro() {
  if (document.getElementById('torcidometro')) return;
  const app = document.getElementById('app');
  if (!app) return;
  const caixa = document.createElement('section');
  caixa.id = 'torcidometro';
  caixa.className = 'torcidometro';
  caixa.setAttribute('aria-label', 'Torcidômetro');
  app.before(caixa);

  let dados = lerCache(); // { times, declarados }
  let online = null;
  let aberto = false;

  const desenhar = () => {
    if (!dados) return;
    const linhas = linhasDoRanking(dados.times, dados.declarados, online);
    const total = Object.values(dados.declarados).reduce((a, b) => a + b, 0);
    caixa.innerHTML = `${htmlBarra(linhas, total, online, aberto)}
      <div class="torcidometro__lista" id="torcidometro-lista"${aberto ? '' : ' hidden'}>${aberto ? htmlLista(linhas, total, online, meuTimeId()) : ''}</div>`;
  };

  const carregar = async () => {
    try {
      const [times, declarados] = await Promise.all([listarTimes(), torcidaDeclarada().catch(() => ({}))]);
      dados = { times: times.map(({ id, nome, escudo_url, ativo }) => ({ id, nome, escudo_url, ativo })), declarados };
      guardarCache(dados);
      desenhar();
    } catch { /* sem conexão: a barra simplesmente não aparece */ }
  };

  caixa.addEventListener('click', (e) => {
    if (!e.target.closest('.torcidometro__barra')) return;
    aberto = !aberto;
    desenhar();
    if (aberto && !lerCache()) carregar(); // abriu depois de um tempo: atualiza os números
  });

  desenhar();
  if (!dados) carregar();
  aoMudarOnline((r) => { online = r; desenhar(); });
}
