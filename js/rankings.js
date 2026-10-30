// Rankings extras da Tabela: melhor ataque, defesa menos vazada, jogos sem sofrer gol, maior goleada e craques do jogo.
// Tudo calculado com o que já existe (classificação + jogos encerrados + votos do craque).
import { escapar, escudo } from './ui.js';
import { avatarJogador } from './escalacao.js';

const top = (lista, n = 3) => lista.slice(0, n);

function bloco(titulo, itens, vazio = 'Ainda sem jogos.') {
  return `
    <article class="card ranking">
      <h4>${titulo}</h4>
      ${itens.length ? `<ol class="ranking__lista">${itens.join('')}</ol>` : `<p class="texto-2 texto-pequeno">${vazio}</p>`}
    </article>`;
}

const linhaTime = (t, valor, detalhe = '') => `
  <li><span class="ranking__time">${escudo(t, 32)} <span>${escapar(t.nome)}</span></span>
    <span class="ranking__valor">${valor}${detalhe ? `<small>${detalhe}</small>` : ''}</span></li>`;

export function htmlRankings(ordenadas, encerrados, craques = []) {
  const jogaram = ordenadas.filter((t) => t.j > 0);
  const porId = new Map(ordenadas.map((t) => [t.time_id, t]));

  const ataque = top([...jogaram].sort((a, b) => b.gp - a.gp || a.j - b.j))
    .map((t) => linhaTime(t, t.gp, `${(t.gp / t.j).toFixed(1).replace('.', ',')} por jogo`));
  const defesa = top([...jogaram].sort((a, b) => a.gc - b.gc || b.j - a.j))
    .map((t) => linhaTime(t, t.gc, `${(t.gc / t.j).toFixed(1).replace('.', ',')} por jogo`));

  // jogos sem sofrer gol
  const zerados = new Map();
  for (const j of encerrados) {
    if (j.gols_visitante === 0) zerados.set(j.mandante_id, (zerados.get(j.mandante_id) ?? 0) + 1);
    if (j.gols_mandante === 0) zerados.set(j.visitante_id, (zerados.get(j.visitante_id) ?? 0) + 1);
  }
  const semSofrer = top([...zerados].sort((a, b) => b[1] - a[1]))
    .map(([id, n]) => linhaTime(porId.get(id), n, `jogo${n === 1 ? '' : 's'}`));

  // maior goleada
  const goleadas = top([...encerrados]
    .filter((j) => j.gols_mandante !== j.gols_visitante)
    .sort((a, b) => Math.abs(b.gols_mandante - b.gols_visitante) - Math.abs(a.gols_mandante - a.gols_visitante)
      || (b.gols_mandante + b.gols_visitante) - (a.gols_mandante + a.gols_visitante)), 2)
    .map((j) => {
      const venceu = j.gols_mandante > j.gols_visitante;
      const vencedor = porId.get(venceu ? j.mandante_id : j.visitante_id);
      const perdedor = porId.get(venceu ? j.visitante_id : j.mandante_id);
      const placar = venceu ? `${j.gols_mandante} × ${j.gols_visitante}` : `${j.gols_visitante} × ${j.gols_mandante}`;
      return linhaTime(vencedor, placar, `contra ${escapar(perdedor.nome)}`);
    });

  const craquesHtml = top(craques, 5).map((c) => `
    <li><span class="ranking__time">${avatarJogador({ foto_url: c.foto_url, numero: '⭐' }, 'avatar')}
      <span>${escapar(c.jogador)}<small class="texto-2"> · ${escapar(c.nome_time)}</small></span></span>
      <span class="ranking__valor">${c.vezes}×<small>craque</small></span></li>`);

  return `
    <section class="secao rankings">
      <h3>Estatísticas</h3>
      <div class="rankings__grade">
        ${bloco('Melhor ataque', ataque)}
        ${bloco('Defesa menos vazada', defesa)}
        ${bloco('Jogos sem sofrer gol', semSofrer, 'Ninguém zerou o adversário ainda.')}
        ${bloco('Maior goleada', goleadas)}
        ${bloco('Craques do jogo ⭐', craquesHtml, 'A torcida vota no craque de cada jogo (botão no card do jogo). O ranking aparece quando as votações encerram.')}
      </div>
      <p class="texto-2 texto-pequeno">Fair play entra quando a súmula com cartões estiver no app.</p>
    </section>`;
}
