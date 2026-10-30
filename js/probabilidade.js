// Chance de vitória nos próximos jogos.
// Modelo de força estilo Elo (o mesmo princípio dos rankings de seleções da FIFA e do xadrez):
// todo time começa com 1500; a cada resultado, quem vence ganha pontos do adversário — mais quando vence
// um time forte, quando o placar é largo (saldo de gols) e menos quando já era favorito. O mando de campo
// soma uma pequena vantagem. A chance é a expectativa de resultado de cada lado (empate conta meio a meio).

const BASE = 1500;
const K = 36;        // quanto um jogo mexe na força
const MANDO = 35;    // vantagem de quem joga como mandante
const JANELA_DIAS = 7;

const dataDe = (j) => (j.data_hora ? new Date(j.data_hora).getTime() : 0);

export function calcularForcas(jogos) {
  const forca = new Map();
  const de = (id) => forca.get(id) ?? BASE;
  const encerrados = jogos
    .filter((j) => j.status === 'encerrado' && j.gols_mandante != null && j.gols_visitante != null)
    .sort((a, b) => dataDe(a) - dataDe(b));
  for (const j of encerrados) {
    const fm = de(j.mandante_id);
    const fv = de(j.visitante_id);
    const esperado = 1 / (1 + 10 ** ((fv - fm - MANDO) / 400));
    const saldo = j.gols_mandante - j.gols_visitante;
    const real = saldo > 0 ? 1 : saldo < 0 ? 0 : 0.5;
    const peso = 1 + Math.log(Math.abs(saldo) + 1) * 0.6; // goleada pesa mais, sem exagero
    const delta = K * peso * (real - esperado);
    forca.set(j.mandante_id, fm + delta);
    forca.set(j.visitante_id, fv - delta);
  }
  return forca;
}

// { mandante, visitante } em % inteiros que somam 100
export function chanceDeVitoria(jogo, forca) {
  const fm = forca.get(jogo.mandante_id) ?? BASE;
  const fv = forca.get(jogo.visitante_id) ?? BASE;
  const mandante = Math.round(100 / (1 + 10 ** ((fv - fm - MANDO) / 400)));
  const limitado = Math.min(95, Math.max(5, mandante)); // nunca 0% ou 100%: futebol é futebol
  return { mandante: limitado, visitante: 100 - limitado };
}

// Jogos que recebem a barra: os próximos agendados (até 7 dias depois do primeiro que vem)
export function proximosJogos(jogos, agora = new Date()) {
  const hoje = new Date(agora.toDateString()).getTime();
  const futuros = jogos.filter((j) => j.status === 'agendado' && j.data_hora && dataDe(j) >= hoje).sort((a, b) => dataDe(a) - dataDe(b));
  if (!futuros.length) return new Set();
  const limite = dataDe(futuros[0]) + JANELA_DIAS * 86400000;
  return new Set(futuros.filter((j) => dataDe(j) <= limite).map((j) => j.id));
}

// Estado da página: as telas chamam prepararChances(jogos) antes de desenhar os cards
let forcas = new Map();
let elegiveis = new Set();
export function prepararChances(jogos) {
  forcas = calcularForcas(jogos);
  elegiveis = proximosJogos(jogos);
}
export const chanceDoCard = (jogo) => (elegiveis.has(jogo.id) ? chanceDeVitoria(jogo, forcas) : null);
