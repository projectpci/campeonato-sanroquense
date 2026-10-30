// Configurações do torcedor (menu do selo → Configurações): time do coração, avisos no celular
// e o nome usado nos comentários do mural. Tudo fica guardado só neste aparelho.
import { listarTimes } from './api.js';
import { meuTime, escolherMeuTime } from './meuTime.js';
import { opcoesAvisos, acompanharTrocaDeTime } from './avisos.js';
import { escapar, escudo, toast } from './ui.js';

const CHAVE_NOME = 'mural_nome'; // o mesmo do mural (js/feed.js)
const nomeGuardado = () => { try { return localStorage.getItem(CHAVE_NOME) ?? ''; } catch { return ''; } };

export function abrirConfiguracoes() {
  document.querySelector('dialog.dialogo')?.remove();
  const d = Object.assign(document.createElement('dialog'), { className: 'dialogo configuracoes' });
  const desenhar = () => {
    const time = meuTime();
    d.innerHTML = `
      <div class="form">
        <div class="folha__topo"><h2>Configurações</h2><button class="botao botao--secundario" type="button" data-fechar>Fechar</button></div>
        <section class="config">
          <h3>Meu time do coração</h3>
          <div class="config__time">
            ${time ? `${escudo(time, 48)}<strong>${escapar(time.nome)}</strong>` : '<span class="texto-2">Nenhum time escolhido</span>'}
            <button class="botao botao--secundario" type="button" data-trocar>${time ? 'Trocar' : 'Escolher'}</button>
          </div>
        </section>
        <section class="config">
          <h3>Avisos no celular</h3>
          <p class="texto-2 texto-pequeno">Gols, início e fim de jogo, na hora.</p>
          <div data-avisos></div>
        </section>
        <section class="config">
          <h3>Nome nos comentários</h3>
          <form class="config__nome" data-nome>
            <input name="nome" maxlength="30" placeholder="Seu nome" autocomplete="nickname" value="${escapar(nomeGuardado())}" aria-label="Seu nome nos comentários">
            <button class="botao botao--secundario" type="submit">Salvar</button>
          </form>
        </section>
      </div>`;
    opcoesAvisos(d.querySelector('[data-avisos]'));
    d.querySelector('[data-trocar]').addEventListener('click', async () => {
      const anterior = meuTime();
      const times = (await listarTimes()).filter((t) => t.ativo !== false);
      d.close();
      const escolha = await escolherMeuTime(times);
      if (escolha !== undefined) {
        await acompanharTrocaDeTime(anterior, escolha);
        toast(escolha ? `Agora você torce pelo ${escolha.nome} ⚽` : 'Sem time do coração');
      }
      abrirConfiguracoes(); // volta para as configurações
    });
    d.querySelector('[data-nome]').addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = e.target.elements.nome.value.trim();
      try { if (nome) localStorage.setItem(CHAVE_NOME, nome); else localStorage.removeItem(CHAVE_NOME); } catch { /* sem armazenamento */ }
      toast(nome ? `Você comenta como ${nome} ✔` : 'Nome apagado');
    });
  };
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-fechar]')) d.close(); });
  d.addEventListener('close', () => d.remove());
  desenhar();
  document.body.append(d);
  d.showModal();
}
