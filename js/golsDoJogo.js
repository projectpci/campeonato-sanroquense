// Gols de um jogo na ordem em que aconteceram e o texto de cada autor, no estilo da súmula do Brasileirão:
// "Fulano", "Fulano (2)", "Fulano (p)" para pênalti e "Fulano (contra)" para gol contra.
export const golsOrdenados = (jogo) => [...(jogo.gols ?? [])].sort((a, b) => a.id - b.id);

export const tipoDoGol = (g) => (g.contra ? 'contra' : g.penalti ? 'penalti' : 'gol');

// Linhas de um time: junta o mesmo autor no mesmo tipo de gol, na ordem do primeiro gol dele
export function resumoDosGols(jogo, timeId) {
  const linhas = new Map();
  for (const g of golsOrdenados(jogo).filter((x) => x.time_id === timeId)) {
    const tipo = tipoDoGol(g);
    const nome = g.jogador?.nome ?? '';
    const chave = `${tipo}|${nome.toLowerCase()}`;
    const linha = linhas.get(chave) ?? { nome, tipo, quantidade: 0 };
    linha.quantidade += g.quantidade ?? 1;
    linhas.set(chave, linha);
  }
  return [...linhas.values()];
}

export function textoDoGol({ nome, tipo, quantidade }) {
  const base = nome || (tipo === 'contra' ? 'Gol contra' : 'Autor não informado');
  const detalhe = [quantidade > 1 ? quantidade : '', tipo === 'penalti' ? 'p' : '', tipo === 'contra' && nome ? 'contra' : ''].filter(Boolean).join(' ');
  return detalhe ? `${base} (${detalhe})` : base;
}
