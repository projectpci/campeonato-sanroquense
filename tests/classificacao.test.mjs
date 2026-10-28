// Rodar: node tests/classificacao.test.mjs
import assert from 'node:assert/strict';
import { ordenarClassificacao, posicoesComEmpate } from '../js/classificacao.js';

const linha = (time_id, nome, v, e, d, gp, gc) => ({
  time_id, nome, j: v + e + d, v, e, d, gp, gc, sg: gp - gc, pts: 3 * v + e,
});
const nomes = (l) => l.map((t) => t.nome);
let ok = 0;
const teste = (nome, fn) => { fn(); ok++; console.log('✔', nome); };

teste('empate em pontos decidido por vitórias', () => {
  const r = ordenarClassificacao([linha(1, 'A', 0, 3, 0, 3, 3), linha(2, 'B', 1, 0, 2, 3, 3)], []);
  assert.deepEqual(nomes(r), ['B', 'A']);
});

teste('pontos e vitórias iguais: decide saldo (Palmeiras × Real Barça)', () => {
  const r = ordenarClassificacao([linha(1, 'Real Barça SR', 1, 1, 0, 5, 2), linha(2, 'Palmeiras', 1, 1, 0, 7, 3)], []);
  assert.deepEqual(nomes(r), ['Palmeiras', 'Real Barça SR']);
});

teste('empate total entre 2 times: confronto direto', () => {
  // Zeta e Alfa idênticos; Zeta venceu Alfa — alfabética colocaria Alfa na frente
  const jogos = [{ mandante_id: 2, visitante_id: 1, gols_mandante: 1, gols_visitante: 0 }];
  const r = ordenarClassificacao([linha(1, 'Alfa', 1, 0, 1, 2, 2), linha(2, 'Zeta', 1, 0, 1, 2, 2)], jogos);
  assert.deepEqual(nomes(r), ['Zeta', 'Alfa']);
});

teste('empate total entre 3 times: mantém alfabética', () => {
  const jogos = [{ mandante_id: 3, visitante_id: 1, gols_mandante: 2, gols_visitante: 0 }];
  const r = ordenarClassificacao([linha(3, 'Cruz', 1, 0, 1, 2, 2), linha(1, 'Alfa', 1, 0, 1, 2, 2), linha(2, 'Beta', 1, 0, 1, 2, 2)], jogos);
  assert.deepEqual(nomes(r), ['Alfa', 'Beta', 'Cruz']);
});

teste('banner atual: ordem esperada (Fúria à frente de Os Coroas)', () => {
  const r = ordenarClassificacao([
    linha(1, 'RDL', 2, 0, 0, 5, 1), linha(2, 'Palmeiras', 1, 1, 0, 7, 3),
    linha(3, 'Real Barça SR', 1, 1, 0, 5, 2), linha(4, 'Juventus', 1, 0, 0, 2, 0),
    linha(5, 'Malvina', 1, 0, 1, 5, 5), linha(6, 'Os 10', 1, 0, 1, 5, 6),
    linha(7, 'Rua Nova', 0, 0, 1, 2, 3), linha(8, 'Os Coroas', 0, 0, 1, 1, 5),
    linha(9, 'Fúria', 0, 0, 1, 0, 2), linha(10, 'SR City', 0, 0, 2, 0, 5),
  ].reverse(), []);
  assert.deepEqual(nomes(r), ['RDL', 'Palmeiras', 'Real Barça SR', 'Juventus', 'Malvina', 'Os 10', 'Rua Nova', 'Fúria', 'Os Coroas', 'SR City']);
  assert.deepEqual(r.map((t) => t.posicao), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

teste('artilharia: empates compartilham posição (1º, 1º, 3º)', () => {
  const r = posicoesComEmpate([{ gols: 4 }, { gols: 4 }, { gols: 3 }, { gols: 1 }]);
  assert.deepEqual(r.map((x) => x.posicao), [1, 1, 3, 4]);
});

console.log(`\n${ok} testes passando`);
