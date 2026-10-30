# 12 — Escalação publicada, elenco público, craque do jogo, estatísticas e story

## Escalação publicada no jogo (migração `escalacao_publicada_e_craque`)
- Tabela `escalacoes_jogo` (jogo, time, formação, titulares, reservas) com leitura pública.
- Na área do clube (aba Escalação): **📢 Publicar no jogo contra X** copia a escalação salva para o próximo jogo
  (`clube_publicar_escalacao`); **Atualizar** / **Retirar** (`clube_retirar_escalacao`).
- No card do jogo aparece **📋 Escalações** (abre o campo de cada time que publicou). `js/jogoExtras.js`.

## Elenco na página do time
`time.html` mostra técnico e cartas dos jogadores ativos (só leitura). `htmlCarta`, `LINHAS` e `linhaDe` ficam em `js/escalacao.js`.

## Craque do jogo
- Tabela `votos_craque` (fechada para leitura direta); um voto por jogo por aparelho (`aparelho_id` no localStorage), pode trocar.
- `votar_craque` (jogo encerrado, até 7 dias depois; jogador ativo de um dos times; 30 votos/hora por endereço),
  `craque_resultado` (totais), `ranking_craques` (vezes eleito mais votado, só votações encerradas).
- Card de jogo encerrado tem **⭐ Craque do jogo**: cartas dos dois elencos com barra de votos.

## Estatísticas (página Tabela)
`js/rankings.js`: melhor ataque, defesa menos vazada, jogos sem sofrer gol, maior goleada e craques do jogo.
Fair play entra com a súmula de cartões.

## Story 9:16
Todo "Compartilhar" pergunta **Post** (1080×1350) ou **Story** (1080×1920, classe `arte--story`, com margem para a interface do status).

## Página Elenco (torcedor)
`elenco.html` (6º item do menu): chips com os escudos e o elenco do time escolhido (técnico e cartas). Componente
compartilhado `js/elencoTime.js` (`htmlElenco`, `htmlEscolhaTime`, `elencoAtivo`), usado também no painel e na página do time.

### Visual do elenco (v22)
Seletor de times em escudos circulares (anel neon no escolhido, contador de jogadores), cabeçalho do time com resumo por linha
(goleiros/defesa/meio/ataque), técnico, busca por nome ou número, jogadores agrupados por linha com a cor da posição, gols na carta
e **ficha do jogador** (folha que sobe de baixo: foto grande, número, posição, time e gols). `ligarElenco` liga busca e ficha.

## Chance de vitória (v27)
`js/probabilidade.js`: força de cada time no estilo Elo (todos começam com 1500; a cada resultado o vencedor ganha pontos do adversário, mais contra time forte e em placar largo, com peso `1 + 0,6·ln(|saldo|+1)`; K = 36; mando de campo = +35). A chance de cada lado é a expectativa de resultado (empate conta meio a meio), arredondada e limitada a 5%–95%. A barra aparece nos próximos jogos agendados (até 7 dias depois do primeiro que vem) em Início, Confrontos e na página do time. Testes em `tests/probabilidade.test.mjs`.
