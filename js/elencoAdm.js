// Painel do organizador: cadastrar, editar e remover jogadores e o técnico de um time (sem precisar do código do clube).
import { salvarJogadorAdm, removerJogadorAdm, salvarTecnicoAdm } from './api.js';
import { POSICOES, linhaDe } from './escalacao.js';
import { escapar, escudo } from './ui.js';
import { criarFolha } from './sumula.js';

// `jogador`: o que já existe (edição) ou { posicao } sugerida para um novo
export function dialogoJogadorAdm({ time, jogador = {}, executar }) {
  const d = criarFolha(`
    <form class="form">
      <div class="folha__topo"><div><span class="sumula__status">${escapar(time.nome)}</span><h2>${jogador.id ? 'Editar jogador' : 'Novo jogador'}</h2></div>
        <button class="link-botao" type="button" data-fechar aria-label="Fechar">✕</button></div>
      <label class="campo">Nome*<input name="nome" required minlength="2" maxlength="40" autocomplete="off" autocapitalize="words" value="${escapar(jogador.nome ?? '')}"></label>
      <label class="campo campo--curto">Número<input name="numero" type="number" min="0" max="99" inputmode="numeric" value="${jogador.numero ?? ''}"></label>
      <fieldset class="opcoes"><legend>Posição</legend>${POSICOES.map(([p, nome]) => `
        <label class="opcao opcao--${linhaDe(p)}"><input type="radio" name="posicao" value="${p}"${jogador.posicao === p ? ' checked' : ''}><span>${nome}</span></label>`).join('')}
      </fieldset>
      <div class="form__acoes">
        ${jogador.id ? '<button class="botao botao--perigo" type="button" data-remover>Remover do elenco</button>' : ''}
        <button class="botao botao--secundario" type="button" data-fechar>Cancelar</button>
        <button class="botao" type="submit">Salvar</button>
      </div>
    </form>`, 'elenco-adm-folha');
  d.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', () => d.close()));
  d.querySelector('[data-remover]')?.addEventListener('click', () => {
    if (!confirm(`Remover ${jogador.nome} do elenco? Se já tiver gols, ele só sai da lista e continua na artilharia.`)) return;
    executar(async () => { await removerJogadorAdm(jogador.id); d.close(); }, 'Jogador removido');
  });
  d.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const dados = new FormData(e.target);
    executar(async () => {
      await salvarJogadorAdm({
        id: jogador.id ?? null, time_id: time.id, nome: dados.get('nome'),
        numero: dados.get('numero') === '' ? null : Number(dados.get('numero')), posicao: dados.get('posicao') ?? '',
      });
      d.close();
    }, 'Jogador salvo ✔');
  });
  return d;
}

export function dialogoTecnicoAdm({ time, executar }) {
  const d = criarFolha(`
    <form class="form">
      <div class="folha__topo"><div><span class="sumula__status">${escapar(time.nome)}</span><h2>Técnico</h2></div>
        <button class="link-botao" type="button" data-fechar aria-label="Fechar">✕</button></div>
      <div class="elenco__topo-mini">${escudo(time, 48)}</div>
      <label class="campo">Nome do técnico<input name="tecnico" maxlength="40" autocomplete="off" autocapitalize="words" value="${escapar(time.tecnico_nome ?? '')}"></label>
      <div class="form__acoes">
        <button class="botao botao--secundario" type="button" data-fechar>Cancelar</button>
        <button class="botao" type="submit">Salvar</button>
      </div>
    </form>`, 'elenco-adm-folha');
  d.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', () => d.close()));
  d.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    executar(async () => { await salvarTecnicoAdm(time.id, new FormData(e.target).get('tecnico')); d.close(); }, 'Técnico salvo ✔');
  });
  return d;
}
