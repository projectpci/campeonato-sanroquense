// Testes da chance de vitória (node tests/probabilidade.test.mjs)
import assert from 'node:assert/strict';
import { calcularForcas, chanceDeVitoria, proximosJogos } from '../js/probabilidade.js';

let ok = 0;
const caso = (nome, fn) => { fn(); ok++; console.log(`✔ ${nome}`); };
const jogo = (id, m, v, gm, gv, data, status = 'encerrado') => ({ id, mandante_id: m, visitante_id: v, gols_mandante: gm, gols_visitante: gv, data_hora: `${data}T16:30:00Z`, status });

caso('sem jogos: 50/50 com leve vantagem do mandante', () => {
  const c = chanceDeVitoria({ mandante_id: 1, visitante_id: 2 }, new Map());
  assert.equal(c.mandante + c.visitante, 100);
  assert.ok(c.mandante > 50 && c.mandante < 56);
});

caso('quem vence mais e por mais gols fica favorito', () => {
  const jogos = [jogo(1, 1, 3, 4, 0, '2026-09-01'), jogo(2, 2, 3, 1, 1, '2026-09-08'), jogo(3, 1, 4, 3, 1, '2026-09-15')];
  const f = calcularForcas(jogos);
  const c = chanceDeVitoria({ mandante_id: 2, visitante_id: 1 }, f);
  assert.ok(c.visitante > c.mandante, `time 1 deveria ser favorito (${c.visitante}% x ${c.mandante}%)`);
});

caso('goleada pesa mais que vitória simples', () => {
  const simples = calcularForcas([jogo(1, 1, 2, 1, 0, '2026-09-01')]).get(1);
  const goleada = calcularForcas([jogo(1, 1, 2, 5, 0, '2026-09-01')]).get(1);
  assert.ok(goleada > simples);
});

caso('chance fica entre 5% e 95%', () => {
  const jogos = Array.from({ length: 30 }, (_, i) => jogo(i, 1, 2, 9, 0, `2026-09-${String((i % 28) + 1).padStart(2, '0')}`));
  const c = chanceDeVitoria({ mandante_id: 1, visitante_id: 2 }, calcularForcas(jogos));
  assert.ok(c.mandante <= 95 && c.visitante >= 5, `${c.mandante}% x ${c.visitante}%`);
});

caso('próximos jogos: só os agendados até 7 dias depois do primeiro', () => {
  const jogos = [jogo(1, 1, 2, null, null, '2026-11-01', 'agendado'), jogo(2, 3, 4, null, null, '2026-11-08', 'agendado'),
    jogo(3, 5, 6, null, null, '2026-11-15', 'agendado'), jogo(4, 7, 8, 1, 0, '2026-10-25')];
  assert.deepEqual([...proximosJogos(jogos, new Date('2026-10-29T12:00:00'))], [1, 2]);
});

console.log(`\n${ok} testes passando`);
