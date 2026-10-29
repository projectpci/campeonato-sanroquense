// Testes da rodada padrão (node tests/rodadas.test.mjs)
import assert from 'node:assert/strict';
import { rodadaAtual, rodadaDoProximoJogo } from '../js/rodadas.js';

const rodadas = [1, 2, 3].map((n) => ({ id: n * 10, numero: n }));
const jogo = (id, rodada, data, status = 'agendado') => ({ id, rodada_id: rodada, data_hora: `${data}T16:30:00Z`, status });
const jogos = [
  jogo(1, 10, '2026-09-13'), jogo(2, 10, '2026-09-20'),
  jogo(3, 20, '2026-09-27'), jogo(4, 20, '2026-10-04'),
  jogo(5, 30, '2026-10-11'), jogo(6, 30, '2026-10-18'),
];
let ok = 0;
const caso = (nome, fn) => { fn(); ok++; console.log(`✔ ${nome}`); };

caso('antes do campeonato: primeira rodada', () =>
  assert.equal(rodadaAtual(rodadas, jogos, new Date('2026-09-01T12:00:00')), 10));
caso('no meio da rodada 2 (sem resultados lançados): rodada 2', () =>
  assert.equal(rodadaAtual(rodadas, jogos, new Date('2026-09-30T12:00:00')), 20));
caso('no dia do primeiro jogo da rodada 3: rodada 3', () =>
  assert.equal(rodadaAtual(rodadas, jogos, new Date('2026-10-11T08:00:00')), 30));
caso('jogo ao vivo manda', () =>
  assert.equal(rodadaAtual(rodadas, jogos.map((j) => (j.id === 3 ? { ...j, status: 'ao_vivo' } : j)), new Date('2026-10-12T12:00:00')), 20));
caso('próximo jogo pelo calendário', () =>
  assert.equal(rodadaDoProximoJogo(jogos, new Date('2026-09-30T12:00:00')), 20));

console.log(`\n${ok} testes passando`);
