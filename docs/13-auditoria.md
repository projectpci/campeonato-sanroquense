# 13 — Auditoria de estabilidade e fluidez (30/10/2026)

## O que foi verificado
- **Sintaxe** de todos os módulos (`node --check`) e **testes** (11 passando: classificação/desempate e rodada padrão). Os dois rodam no GitHub a cada envio.
- **Todas as páginas com os dados reais** (Início, Confrontos, Tabela, Artilharia, Elenco, Mural, Clube, Time, Instalar, tela inicial) em 360 px: sem erro no console, sem erro na tela, sem rolagem lateral.
- **Segurança de conteúdo**: textos do banco entram na tela por `escapar()`; os casos sem escape são `confirm()`, `textContent` ou título da aba (seguros).
- **Banco** (advisors do Supabase): segurança e desempenho.

## Corrigido nesta auditoria
| Problema | Efeito | Correção |
|---|---|---|
| Toda mudança em qualquer tabela recarregava todas as páginas abertas | Num domingo de jogo, cada comentário no mural ou foto de elenco fazia cada torcedor refazer 4–6 consultas | `assinarMudancas(callback, tabelas)`: cada página ouve só o que mostra (ex.: Tabela → `jogos`, `times`; Mural → `posts`, `comentarios`) |
| Aba escondida também recarregava | Consumo de bateria e de consultas com o app em segundo plano | Atualização fica pendente e roda quando a aba volta a ficar visível |
| Escalação publicada não atualizava sozinha | Torcida precisava recarregar | `escalacoes_jogo` entrou no tempo real dos jogos |
| `demo.js` (16 KB) baixado em toda página | Peso inútil no site real | Importado só no modo demonstração |
| Consulta repetida de jogos encerrados (Início, Time, Clube) | 1 consulta a mais por carga | Derivados da lista de jogos que já vem |
| Fotos do mural/elenco num cache sem limite | Ocupação crescente no celular | Cache próprio de imagens com limite de 150 (as mais antigas saem) |
| 6 chaves estrangeiras sem índice | Consultas por time/jogador mais lentas conforme o banco cresce | Índices criados (`indices_chaves_estrangeiras`) |
| `craque_votacao_aberta` sem `search_path` fixo | Aviso de segurança | Corrigido |

## Avisos do Supabase que ficam (intencionais)
- **Funções SECURITY DEFINER executáveis sem login** (clube, mural, votos, avisos): é o desenho do app — o clube entra só com o código, e cada função confere o código / limita tentativas.
- **Tabelas com RLS sem política** (`config_push`, `inscricoes_push`, `tentativas_codigo`, `votos_craque`): fechadas de propósito; só as funções acessam.
- **Políticas permissivas múltiplas** (leitura pública + escrita do organizador): custo desprezível com o volume do campeonato.
- **Proteção de senha vazada desligada**: ligar no painel do Supabase (Authentication → Policies) — ação do organizador.

## Limites a acompanhar (plano gratuito do Supabase)
- **Tempo real: 200 conexões simultâneas.** Cada aparelho com o app aberto usa 1. Se a torcida passar disso num domingo, os aparelhos excedentes ainda veem os dados, mas sem atualizar sozinhos (o cache e a recarga continuam funcionando). Se acontecer, avaliar o plano Pro.
- **Banco 500 MB / Storage 1 GB / 5 GB de tráfego por mês**: folga grande para fotos de 400 KB (elenco) e ~150 KB (mural).
- **Projeto pausa após 7 dias sem uso** no plano gratuito: durante o campeonato o uso é contínuo; na pausa de fim de ano, abrir o site uma vez por semana.

## Pontos de atenção (sem mudança agora)
- **Votos do craque**: um por aparelho (identificador local) + 30/hora por endereço. Dá para burlar limpando o navegador; para um ranking de torcida é aceitável.
- **Envio de fotos do elenco** é aberto a quem tem o código (pasta `fotos/`, JPEG até 400 KB). Fotos trocadas ficam no Storage (limpeza manual eventual).
- **CSS** (`componentes.css`, 63 KB) acumula regras antigas sobrescritas; funciona, mas uma limpeza futura reduz ~10 KB.
- **`assets/banner-referencia.png` (2,2 MB)** não é carregado pelo app; serve só de referência visual no repositório.

## Como manter estável
1. A cada mudança no código: subir `VERSAO` em `sw.js` (o app recarrega sozinho na versão nova).
2. Rodar `node tests/classificacao.test.mjs && node tests/rodadas.test.mjs` antes de enviar.
3. Testar em 360 px (Início, Tabela, Clube e painel) e conferir o console.
