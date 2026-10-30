// Testes da leitura de elenco enviado por WhatsApp (node tests/elenco.test.mjs)
import assert from 'node:assert/strict';
import { lerMensagens, montarMensagem, modeloEmBranco, reconhecerTime } from '../js/importarElenco.js';

const times = [
  { id: 1, nome: 'RDL', sigla: 'RDL' }, { id: 2, nome: 'Real Barça SR', sigla: 'RBS' }, { id: 3, nome: 'Os Coroas', sigla: 'COR' },
  { id: 4, nome: 'Juventus', sigla: 'JUV' }, { id: 5, nome: 'SR City', sigla: 'SRC' },
];
let ok = 0;
const caso = (nome, fn) => { fn(); ok++; console.log(`✔ ${nome}`); };
const resumo = (c) => c.jogadores.map((j) => `${j.numero ?? '-'}|${j.nome}|${j.posicao ?? '?'}`);

caso('a mensagem do formulário volta igual ao ser lida', () => {
  const dados = { time: 'Real Barça SR', tecnico: 'Zé do Carmo', jogadores: [
    { numero: 1, nome: 'Toninho', posicao: 'GOL' }, { numero: 4, nome: 'Cabeça', posicao: 'ZAG' }, { numero: 6, nome: 'Rafael da Silva', posicao: 'LAT' },
    { numero: 8, nome: 'Marcelo', posicao: 'VOL' }, { numero: 10, nome: 'Lelê', posicao: 'MEI' }, { numero: 9, nome: 'Dudu', posicao: 'ATA' }, { numero: null, nome: 'Reserva Sem Número', posicao: 'ATA' }] };
  const [c] = lerMensagens(montarMensagem(dados), times);
  assert.equal(c.time.id, 2);
  assert.equal(c.tecnico, 'Zé do Carmo');
  assert.deepEqual(resumo(c), ['1|Toninho|GOL', '4|Cabeça|ZAG', '6|Rafael da Silva|LAT', '8|Marcelo|VOL', '10|Lelê|MEI', '9|Dudu|ATA', '-|Reserva Sem Número|ATA']);
  assert.deepEqual(c.avisos, []);
});

caso('formatos diferentes de linha: número antes, depois, com ponto, parêntese e emoji', () => {
  const [c] = lerMensagens('Time: RDL\nGoleiros\n1 - Toninho\n12) Fulano\n13. Beltrano\n14-Ciclano\nZagueiros\nCabeça 4\nPedrão (5)\n1️⃣5️⃣ Zé Carlos\n• 3 - João Pedro\nAtacantes\nDudu #9', times);
  assert.deepEqual(resumo(c), ['1|Toninho|GOL', '12|Fulano|GOL', '13|Beltrano|GOL', '14|Ciclano|GOL', '4|Cabeça|ZAG', '5|Pedrão|ZAG', '15|Zé Carlos|ZAG', '3|João Pedro|ZAG', '9|Dudu|ATA']);
});

caso('sinônimos de posição: defensores, meio-campistas, lateral, ataque', () => {
  const [c] = lerMensagens('Time: RDL\nDEFENSORES (3):\n2 - A Silva\nLATERAL DIREITO\n3 - B Souza\nMeio-campistas\n8 - C Lima\nVOLANTES\n5 - D Cruz\nMEIA\n10 - E Dias\nATAQUE\n9 - F Alves', times);
  assert.deepEqual(c.jogadores.map((j) => j.posicao), ['ZAG', 'LAT', 'MEI', 'VOL', 'MEI', 'ATA']);
});

caso('posição na própria linha (sem títulos): separada por - ou |', () => {
  const [c] = lerMensagens('Time: RDL\nToninho - Goleiro - 1\nDudu | ATA | 9\nCabeça - ZAG\n10 - Lelê - Meia', times);
  assert.deepEqual(resumo(c), ['1|Toninho|GOL', '9|Dudu|ATA', '-|Cabeça|ZAG', '10|Lelê|MEI']);
});

caso('nome em maiúsculas ou minúsculas vira capitalizado; nome já capitalizado fica', () => {
  const [c] = lerMensagens('Time: RDL\nATACANTES\n9 - JOÃO DA SILVA\n10 - pedro dos santos\n11 - McDonald Neto', times);
  assert.deepEqual(c.jogadores.map((j) => j.nome), ['João da Silva', 'Pedro dos Santos', 'McDonald Neto']);
});

caso('várias mensagens coladas de uma vez, com data e hora do WhatsApp', () => {
  const cs = lerMensagens('[30/10/2026 10:32] Carlos RDL: Time: RDL\nTécnico: Mestre Bira\nGoleiros\n1 - Toninho\n\n30/10/2026 11:05 - Marcos: Time: Os Coroas\nAtacantes\n9 - Dudu\n\nSegue o elenco do juventus\nTime: juventus\nMeias\n10 - Lelê', times);
  assert.equal(cs.length, 3);
  assert.deepEqual(cs.map((c) => c.time?.id), [1, 3, 4]);
  assert.equal(cs[0].tecnico, 'Mestre Bira');
  assert.deepEqual(resumo(cs[1]), ['9|Dudu|ATA']);
});

caso('reconhece o time sem acento, por sigla ou por parte do nome; não chuta quando é ambíguo', () => {
  assert.equal(reconhecerTime('real barca sr', times)?.id, 2);
  assert.equal(reconhecerTime('SRC', times)?.id, 5);
  assert.equal(reconhecerTime('coroas', times)?.id, 3);
  assert.equal(reconhecerTime('Time Desconhecido', times), null);
  assert.equal(reconhecerTime('SR', times), null);
});

caso('avisos: time desconhecido, número repetido, nome repetido, sem posição', () => {
  const [c] = lerMensagens('Time: Flamengo\n7 - Zé\nGoleiros\n1 - A Um\n1 - B Dois\n2 - A Um', times);
  assert.equal(c.time, null);
  assert.ok(c.avisos[0].includes('Flamengo'));
  assert.ok(c.jogadores[0].problemas.includes('sem posição'));
  assert.ok(c.jogadores[1].problemas.includes('número 1 repetido') && c.jogadores[2].problemas.includes('número 1 repetido'));
  assert.ok(c.jogadores[3].problemas.includes('nome repetido'));
});

caso('conversa solta antes do elenco não vira jogador; mensagem sem "Time:" ainda é lida', () => {
  const cs = lerMensagens('Boa noite pessoal\nSegue o elenco\nGoleiros\n1 - Toninho', times);
  assert.equal(cs.length, 1);
  assert.equal(cs[0].timeTexto, '');
  assert.equal(cs[0].jogadores.length, 1);
  assert.ok(cs[0].avisos[0].includes('Time'));
});

caso('o modelo em branco, devolvido sem preencher, não cria jogador', () => {
  const cs = lerMensagens(modeloEmBranco(), times);
  assert.equal(cs.reduce((n, c) => n + c.jogadores.length, 0), 0);
});

console.log(`\n${ok} testes passando`);
