// Qual rodada mostrar por padrão: a mais recente pelo calendário.
// 1) se há jogo ao vivo, a rodada dele; 2) senão, a última rodada que já começou (primeiro jogo até hoje);
// 3) antes do campeonato começar (ou sem datas), a primeira rodada com jogo pendente.

function inicioDaRodada(rodada, jogos) {
  const datas = jogos.filter((j) => j.rodada_id === rodada.id && j.data_hora).map((j) => new Date(j.data_hora).getTime());
  if (datas.length) return Math.min(...datas);
  return rodada.data ? new Date(`${rodada.data}T00:00:00`).getTime() : null;
}

export function rodadaAtual(rodadas, jogos, agora = new Date()) {
  if (!rodadas.length) return null;
  const aoVivo = jogos.find((j) => j.status === 'ao_vivo');
  if (aoVivo) return aoVivo.rodada_id;
  const fimDeHoje = new Date(agora);
  fimDeHoje.setHours(23, 59, 59, 999);
  const ordenadas = [...rodadas].sort((a, b) => a.numero - b.numero);
  const comecaram = ordenadas.filter((r) => {
    const inicio = inicioDaRodada(r, jogos);
    return inicio != null && inicio <= fimDeHoje.getTime();
  });
  if (comecaram.length) return comecaram.at(-1).id;
  return (ordenadas.find((r) => jogos.some((j) => j.rodada_id === r.id && j.status !== 'encerrado')) ?? ordenadas[0]).id;
}

// Rodada do próximo jogo que ainda vai acontecer (para "Próxima rodada" no início)
export function rodadaDoProximoJogo(jogos, agora = new Date()) {
  return jogos
    .filter((j) => j.status === 'agendado' && j.data_hora && new Date(j.data_hora) > agora)
    .sort((a, b) => a.data_hora.localeCompare(b.data_hora))[0]?.rodada_id ?? null;
}
