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
