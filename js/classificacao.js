// Ordenação da classificação + desempate por confronto direto. Não acessa o Supabase.
// linhas: resultado de v_classificacao | jogos: jogos encerrados
const base = (a, b) => b.pts - a.pts || b.v - a.v || b.sg - a.sg || b.gp - a.gp;

export function ordenarClassificacao(linhas, jogos) {
  const ordenadas = [...linhas].sort((a, b) => base(a, b) || a.nome.localeCompare(b.nome, 'pt-BR'));

  // Confronto direto só vale em grupos empatados de exatamente 2 times
  for (let i = 0; i < ordenadas.length - 1; i++) {
    const a = ordenadas[i];
    const b = ordenadas[i + 1];
    const c = ordenadas[i + 2];
    const empatadoAB = base(a, b) === 0;
    const terceiroEmpatado = c && base(b, c) === 0;
    const anteriorEmpatado = i > 0 && base(ordenadas[i - 1], a) === 0;
    if (empatadoAB && !terceiroEmpatado && !anteriorEmpatado) {
      if (confrontoDireto(b, a, jogos) > 0) [ordenadas[i], ordenadas[i + 1]] = [b, a];
      i++;
    }
  }
  return ordenadas.map((t, i) => ({ ...t, posicao: i + 1 }));
}

// > 0 se x levou vantagem sobre y nos jogos entre eles (pontos, depois saldo)
function confrontoDireto(x, y, jogos) {
  let ptsX = 0;
  let ptsY = 0;
  let sgX = 0;
  for (const j of jogos) {
    const xMandante = j.mandante_id === x.time_id && j.visitante_id === y.time_id;
    const xVisitante = j.visitante_id === x.time_id && j.mandante_id === y.time_id;
    if (!xMandante && !xVisitante) continue;
    const golsX = xMandante ? j.gols_mandante : j.gols_visitante;
    const golsY = xMandante ? j.gols_visitante : j.gols_mandante;
    sgX += golsX - golsY;
    if (golsX > golsY) ptsX += 3;
    else if (golsX < golsY) ptsY += 3;
    else { ptsX++; ptsY++; }
  }
  return (ptsX - ptsY) || sgX;
}

// Posição compartilhada em empates (1º, 1º, 3º) — usada na artilharia
export function posicoesComEmpate(itens, chave = 'gols') {
  return itens.map((item, i) => {
    const primeiro = itens.findIndex((outro) => outro[chave] === item[chave]);
    return { ...item, posicao: primeiro + 1 };
  });
}
