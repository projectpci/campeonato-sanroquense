# 10 — Cache local, destaque do início, página do time e avisos (Web Push)

## Cache da última visita (`js/cache.js`)
`carregarComCache(chave, buscar, desenhar)`: na primeira carga da página desenha o que ficou salvo em `localStorage`
(`sr_cache_<campeonato>_<chave>`), busca os dados novos, redesenha e salva. Se a rede falhar, mantém os dados salvos e avisa.
Desligado em modo demonstração. Usado em início, confrontos, classificação, artilharia e página do time.

## Início
`htmlDestaque` (em `js/paginas/inicio.js`): jogos de hoje (ao vivo primeiro); sem jogo hoje, mostra o próximo dia de jogos com a contagem ("em 3 dias").

## Página do time (`time.html?id=<time_id>`)
Posição e pontos, V/E/D dos últimos 5 jogos, estatísticas, próximos jogos, resultados e artilheiros do time.
Os nomes na tabela da classificação e do início levam para ela.

## Avisos no celular (Web Push)
- Cliente: `js/avisos.js` (botão "Ativar avisos" no início e "Seguir time" na página do time) + handlers `push` e `notificationclick` em `sw.js`.
  No iPhone só funciona com o app instalado (Compartilhar → Adicionar à Tela de Início).
- Banco: `inscricoes_push` (sem acesso direto; só as funções `inscrever_push` / `cancelar_push`), `config_push` (chaves VAPID e segredo; fechada para a API pública), coluna `jogos.ultimo_aviso` (evita avisar o mesmo placar duas vezes).
- Gatilho `jogos_avisar` (após atualizar jogos com status/placar novo, em `ao_vivo` ou `encerrado`) → `pg_net` chama a Edge Function `avisar-push` com o cabeçalho `x-segredo`.
- Edge Function `avisar-push` (`verify_jwt = false`, autentica pelo segredo): monta a mensagem ("Bola rolando!", "GOL!", "Fim de jogo" com autores), envia com `web-push` e remove inscrições mortas (404/410).
- A chave VAPID pública está em `js/avisos.js`; a privada só existe no banco (`config_push`). Para trocar as chaves, gere novas, atualize `config_push` e `CHAVE_PUBLICA` e peça aos torcedores para ativarem de novo.

## Avisos do organizador (migração `avisos_organizador`)
- `inscricoes_push.torcedor` / `inscricoes_push.organizador`: um aparelho pode receber gols, fotos para aprovar ou os dois.
- `inscrever_push_organizador` / `cancelar_push_organizador` só funcionam logado (`auth.uid()`); botão "Avisar fotos para aprovar" no painel.
- Gatilho `posts_avisar` (nova publicação com `aprovado = false`) chama `avisar-push` com `{ post_id }`: "Foto para aprovar 📸 — <time> enviou uma foto".
- Os avisos de jogo vão só para quem tem `torcedor = true`.

## Painel em tempo real
O painel assina o Realtime (jogos, gols, posts...) e recarrega sozinho, exceto com uma janela aberta.

## Arte de cada jogo
Ícone do WhatsApp em todo card de jogo (Início, Confrontos, página do time, painel) → `arteJogo`: "Próximo jogo" / "Hoje tem jogo"
(data, hora e chamada para o campo), "Ao vivo" ou "Resultado final" (placar e autores). `js/compartilharJogo.js` guarda o último estado de cada card.
