// Time do coração do torcedor: escolhido uma vez e guardado só neste aparelho.
// Personaliza o Início (jogo do meu time), o selo do topo e a torcida online nos jogos,
// e pode ligar os avisos (push) só dos jogos desse time.
import { escapar, escudo } from './ui.js';

const CHAVE = 'meu_time';
const CHAVE_DISPENSOU = 'meu_time_dispensou';

export function meuTime() {
  try { return JSON.parse(localStorage.getItem(CHAVE) ?? 'null'); } catch { return null; }
}

export function definirMeuTime(time) {
  try {
    if (time) localStorage.setItem(CHAVE, JSON.stringify({ id: time.id, nome: time.nome, sigla: time.sigla ?? null, escudo_url: time.escudo_url ?? null }));
    else localStorage.removeItem(CHAVE);
  } catch { /* sem armazenamento */ }
  document.dispatchEvent(new CustomEvent('meu-time-mudou', { detail: meuTime() }));
}

// "Agora não" no convite do Início: não pergunta de novo (dá para escolher depois pelo selo do topo)
export const dispensouConvite = () => { try { return localStorage.getItem(CHAVE_DISPENSOU) === '1'; } catch { return false; } };
export const dispensarConvite = () => { try { localStorage.setItem(CHAVE_DISPENSOU, '1'); } catch { /* sem armazenamento */ } };

export const htmlEscolhaTimes = (times, atual = null) => times.map((t) => `
  <button class="escolha-time${atual === t.id ? ' escolha-time--ativo' : ''}" type="button" data-meu-time="${t.id}" aria-pressed="${atual === t.id}">
    ${escudo(t, 48)}<span>${escapar(t.nome)}</span></button>`).join('');

// Janela para escolher (ou trocar) o time; resolve com o time escolhido, null (nenhum) ou undefined (fechou)
export function escolherMeuTime(times) {
  return new Promise((resolver) => {
    document.querySelector('dialog.dialogo')?.remove();
    const atual = meuTime()?.id ?? null;
    const d = Object.assign(document.createElement('dialog'), {
      className: 'dialogo',
      innerHTML: `
        <div class="form">
          <h2>Qual é o seu time?</h2>
          <p class="texto-2 texto-pequeno">O Início mostra os jogos dele primeiro e você aparece na torcida online.</p>
          <div class="escolha-times">${htmlEscolhaTimes(times, atual)}</div>
          <div class="form__acoes">
            ${atual ? '<button class="botao botao--secundario" type="button" data-nenhum>Não torcer por nenhum</button>' : ''}
            <button class="botao botao--secundario" type="button" data-fechar>Fechar</button>
          </div>
        </div>`,
    });
    let escolha;
    d.addEventListener('click', (e) => {
      const b = e.target.closest('[data-meu-time]');
      if (b) { escolha = times.find((t) => t.id === Number(b.dataset.meuTime)); d.close(); return; }
      if (e.target.closest('[data-nenhum]')) { escolha = null; d.close(); return; }
      if (e.target === d || e.target.closest('[data-fechar]')) d.close();
    });
    d.addEventListener('close', () => {
      d.remove();
      if (escolha !== undefined) definirMeuTime(escolha);
      resolver(escolha);
    });
    document.body.append(d);
    d.showModal();
  });
}
