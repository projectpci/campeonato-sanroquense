# 04 — Regras de Classificação (padrão Brasileirão)

## Pontuação
| Resultado | Pontos |
|---|---|
| Vitória | 3 |
| Empate | 1 |
| Derrota | 0 |

Só entram no cálculo jogos com `status = 'encerrado'`.

## Critérios de desempate (nesta ordem)
1. **Pontos**
2. **Número de vitórias**
3. **Saldo de gols** (GP − GC)
4. **Gols pró**
5. **Confronto direto** — só quando o empate é entre **exatamente 2 times**; vence quem tem mais pontos nos jogos entre eles (se houver ida e volta, somar; persistindo, saldo nesses jogos)
6. ~~Menos cartões vermelhos / amarelos~~ — fora do escopo v1 (sem súmula de cartões)
7. **Ordem alfabética** — provisório, substitui o sorteio. O organizador pode decidir manualmente se necessário.

> Os critérios 1–4 já vêm ordenados na view `v_classificacao`. O critério 5 é aplicado em `js/classificacao.js`.

## Algoritmo (`js/classificacao.js`)
```js
/**
 * @param {Array} linhas  - resultado de v_classificacao
 * @param {Array} jogos   - jogos encerrados {mandante_id, visitante_id, gols_mandante, gols_visitante}
 * @returns {Array} linhas ordenadas com campo `posicao`
 */
export function ordenarClassificacao(linhas, jogos) {
  const base = (a, b) =>
    b.pts - a.pts || b.v - a.v || b.sg - a.sg || b.gp - a.gp;

  const ordenadas = [...linhas].sort((a, b) => base(a, b) || a.nome.localeCompare(b.nome, 'pt-BR'));

  // Aplica confronto direto apenas em grupos empatados de 2 times
  for (let i = 0; i < ordenadas.length - 1; i++) {
    const a = ordenadas[i], b = ordenadas[i + 1];
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

// > 0 se x levou vantagem sobre y nos jogos entre eles
function confrontoDireto(x, y, jogos) {
  let ptsX = 0, ptsY = 0, sgX = 0;
  for (const j of jogos) {
    const xMandante = j.mandante_id === x.time_id && j.visitante_id === y.time_id;
    const xVisitante = j.visitante_id === x.time_id && j.mandante_id === y.time_id;
    if (!xMandante && !xVisitante) continue;
    const gx = xMandante ? j.gols_mandante : j.gols_visitante;
    const gy = xMandante ? j.gols_visitante : j.gols_mandante;
    sgX += gx - gy;
    if (gx > gy) ptsX += 3; else if (gx < gy) ptsY += 3; else { ptsX++; ptsY++; }
  }
  return (ptsX - ptsY) || sgX;
}
```

## Casos de teste (validar antes de publicar)
Dados do banner atual — **ordem esperada que o sistema deve gerar**:

| Pos | Time | J | V | E | D | GP | GC | SG | PTS |
|---|---|---|---|---|---|---|---|---|---|
| 1 | RDL | 2 | 2 | 0 | 0 | 5 | 1 | +4 | 6 |
| 2 | Palmeiras | 2 | 1 | 1 | 0 | 7 | 3 | +4 | 4 |
| 3 | Real Barça SR | 2 | 1 | 1 | 0 | 5 | 2 | +3 | 4 |
| 4 | Juventus | 1 | 1 | 0 | 0 | 2 | 0 | +2 | 3 |
| 5 | Malvina | 2 | 1 | 0 | 1 | 5 | 5 | 0 | 3 |
| 6 | Os 10 | 2 | 1 | 0 | 1 | 5 | 6 | −1 | 3 |
| 7 | Rua Nova | 1 | 0 | 0 | 1 | 2 | 3 | −1 | 0 |
| 8 | Fúria | 1 | 0 | 0 | 1 | 0 | 2 | −2 | 0 |
| 9 | Os Coroas | 1 | 0 | 0 | 1 | 1 | 5 | −4 | 0 |
| 10 | SR City | 2 | 0 | 0 | 2 | 0 | 5 | −5 | 0 |

> ⚠️ No banner manual, **Os Coroas (SG −4) aparece à frente de Fúria (SG −2)**. Pelo critério de saldo, Fúria fica em 8º. O sistema corrige isso automaticamente.

Testes mínimos:
- [ ] Empate em pontos decidido por vitórias
- [ ] Empate em pontos e vitórias decidido por saldo (Palmeiras × Real Barça)
- [ ] Empate total entre 2 times decidido por confronto direto
- [ ] Empate total entre 3 times → mantém alfabética (sem confronto direto)
- [ ] Gol contra entra no placar e não na artilharia
- [ ] Corrigir placar substitui os gols antigos
