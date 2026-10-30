# CLAUDE.md — Campeonato SRP

> Instruções permanentes para o Claude Code neste repositório. Leia este arquivo e a pasta `docs/` antes de qualquer tarefa.

## O projeto
Sistema web simples para gerenciar o **Campeonato SRP** (São Roque do Paraguaçu – BA):
cadastro de times, confrontos por rodada (manuais), lançamento de placar com autores dos gols,
classificação automática (critérios do Brasileirão) e artilharia. Tudo salvo em tempo real no **Supabase**,
código versionado no **GitHub** e publicado no **GitHub Pages**.

## Stack (não trocar sem pedir)
- **HTML + CSS + JavaScript puro (ES Modules)** — sem framework, sem etapa de build.
- **Supabase** (`@supabase/supabase-js@2` via CDN) — Postgres, Auth, Realtime e Storage.
- **html2canvas** e **qrcode-generator** (via CDN, versão fixa + SRI) — imagem JPEG para o WhatsApp e QR code do site.
- **PWA**: `manifest.webmanifest` + `sw.js` (suba `VERSAO` em `sw.js` a cada deploy).
- **GitHub Pages** — hospedagem estática.

## Mapa da documentação
| Arquivo | Conteúdo |
|---|---|
| `docs/01-visao-geral.md` | Objetivo, escopo, usuários, requisitos |
| `docs/02-arquitetura.md` | Estrutura de pastas, módulos JS, fluxo de dados, deploy |
| `docs/03-banco-de-dados.md` | SQL completo: tabelas, views, função, RLS, Realtime, Storage |
| `docs/04-regras-classificacao.md` | Pontuação e critérios de desempate |
| `docs/05-design-system.md` | Cores, fontes e componentes (baseado no banner oficial) |
| `docs/06-paginas.md` | Especificação das 4 páginas + área do organizador |
| `docs/07-compartilhar-imagem.md` | Geração de imagem e envio pelo WhatsApp |
| `docs/08-roadmap.md` | Fases de desenvolvimento e checklist |
| `docs/09-mural.md` | Mural: fotos, descrição e comentários (SQL, regras, segurança) |
| `docs/10-avisos-e-time.md` | Cache da última visita, destaque do início, página do time e avisos (Web Push) |
| `docs/11-area-do-clube.md` | Área do clube: acesso por código, elenco com foto, escalação e arte |
| `docs/12-craque-escalacao-estatisticas.md` | Escalação publicada, elenco público, craque do jogo, estatísticas e story 9:16 |
| `docs/13-auditoria.md` | Auditoria de estabilidade/fluidez, limites do plano gratuito e como manter |

## Regras de código
1. **Mobile-first.** Testar sempre em 360px de largura. Nada de rolagem horizontal na página (só dentro da tabela, se inevitável).
2. **Idioma:** interface, nomes de tabelas/colunas e comentários em **português**. Variáveis JS em português, camelCase (`golsMandante`).
3. **Nunca** colocar a `service_role key` no código. Só a `anon key` (pública, protegida por RLS) em `js/config.js`.
4. Toda escrita no banco passa por usuário autenticado (organizador). Leitura é pública.
5. Classificação e artilharia vêm das **views** do Supabase; o desempate fino (confronto direto) é aplicado em `js/classificacao.js`.
6. Salvar resultado sempre pela função `salvar_resultado` (RPC) — garante atomicidade e valida soma dos gols.
7. Toda página assina o **Realtime** (só as tabelas que mostra: `assinarMudancas(callback, tabelas)`) e re-renderiza ao receber mudança.
8. Cores e fontes só via variáveis CSS de `css/tokens.css`. Não usar cor "solta".
9. Funções pequenas, um módulo por responsabilidade. Sem dependências além das listadas.
10. Antes de concluir uma tarefa: checar console sem erros, layout em celular e desktop, e atualizar o checklist em `docs/08-roadmap.md`.

## Comandos úteis
- Rodar local: `npx serve .` (ou extensão Live Server) e abrir `http://localhost:3000`.
- Deploy: `git push` na branch `main` → GitHub Pages publica automaticamente.
