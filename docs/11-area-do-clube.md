# 11 — Área do clube (`clube.html`)

Terceira opção da tela inicial. O responsável do time escolhe o time e digita o **código de acesso**
(o mesmo código do mural, gerado em Organizador → Times). Não há conta nem senha: o código fica salvo no
aparelho (`localStorage`, chave `mural_codigo`), então o clube também já publica no mural como o time.

## Seções
Calendário · Resultados · Tabela (linha do clube destacada) · Artilharia do clube · Elenco · Escalação · Mural (atalho).

- **Elenco:** técnico (nome e foto) e jogadores (nome, número, posição, foto). Fotos recortadas em quadrado de 400 px no
  aparelho (`prepararFoto(arquivo, { lado: 400, quadrada: true })`) e enviadas ao bucket `elenco` (`fotos/<time_id>/…`).
  Remover um jogador que já fez gol só o desativa (`ativo = false`), para a artilharia não mudar.
- **Escalação:** formações 4-4-2, 4-3-3, 4-2-3-1, 3-5-2, 5-3-2, 4-1-4-1 (`js/escalacao.js`). Toque na posição e escolha o
  jogador; reservas por toque. "Salvar" grava no banco; "Compartilhar imagem" gera a arte 1080×1350 (`arteEscalacao`)
  com o próximo jogo, o campo, as reservas, o técnico e o QR code.

## Banco (migração `area_do_clube`)
- `jogadores`: + `numero`, `posicao` (GOL/ZAG/LAT/VOL/MEI/ATA), `foto_url`, `ativo`.
- `times`: + `tecnico_nome`, `tecnico_foto_url`.
- `escalacoes` (uma por time; só o clube, pela função, e o organizador leem).
- `tentativas_codigo` + `codigo_do_time(codigo)`: 20 códigos errados a cada 10 min por endereço, depois bloqueia.
  `validar_codigo` passou a usar esse freio.
- Funções (SECURITY DEFINER, conferem o código): `clube_salvar_jogador`, `clube_apagar_jogador`, `clube_salvar_tecnico`,
  `clube_buscar_escalacao`, `clube_salvar_escalacao`. Código inválido devolve `{ "erro": "codigo" }` (o app volta para a entrada).
- Bucket `elenco`: leitura pública, envio só em `fotos/` (JPEG até 400 KB), organizador apaga.

## Trocar o código de um clube
Organizador → Times → "gerar novo". O código antigo para de funcionar na hora (no clube e no mural).

## Correções de segurança e qualidade (migração `mural_com_freio_de_codigo`)
- Códigos de todos os times trocados por códigos fortes (6 caracteres, sem 0/O, 1/I/L). Os antigos deixaram de valer.
- `publicar_post` e `apagar_post_time` passam pelo mesmo freio (`codigo_do_time`) e devolvem `{ "erro": "codigo" }`.
- Bucket `escudos`: só PNG/JPEG/WebP até 500 KB.
- Prévia dos links no WhatsApp: `assets/compartilhar.jpg` (1200×630) em `og:image` de todas as páginas.
- Lançar resultado: o nome do autor é padronizado pelo elenco do clube ("dudú" vira "Dudu"); nome fora do elenco mostra aviso.

## Visual (estilo app de jogo)
Topo com escudo, forma (V/E/D), posição, pontos, jogos, elenco e próximo jogo com contagem; abas com ícone fixas ao rolar;
Jogos com controle Calendário/Resultados; artilharia em pódio; elenco em cartas (cor por linha: goleiro, defesa, meio, ataque)
com filtro; escolha de jogador numa folha que sobe de baixo, com busca e filtro "da posição"/"todos" (tocar em quem já está no
campo troca os dois de lugar); botão "Auto" escala pelas posições; banco em avatares; barra fixa Salvar/Compartilhar;
posição do jogador escolhida por botões; foto com prévia em círculo. Aviso ao sair com escalação não salva.

## Entrada em 2 passos e aba Elenco do painel
- Entrada: 1) grade de escudos; 2) o time escolhido fica em destaque, com o campo do código e "← Escolher outro time".
  Se o aparelho já entrou antes, abre direto no passo 2 daquele time.
- Painel do organizador: aba **Elenco** com os times em chips (com a quantidade de jogadores) e o elenco do time escolhido (só leitura).
