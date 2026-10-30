# 08 — Roadmap e Checklist

> Executar uma fase por vez no Claude Code. Ao concluir cada item, marcar `[x]`.

## Fase 0 — Preparação (manual, fora do Claude Code)
- [ ] Criar repositório `campeonato-sanroquense` no GitHub
- [x] Criar projeto no Supabase (região São Paulo) — `campeonato-sanroquense` (`hwwnwdhfakwhocqfozro`)
- [x] Executar SQL de `03-banco-de-dados.md` (e `09-mural.md`)
- [ ] Criar usuário(s) organizador(es) em *Authentication → Users*
- [x] Copiar URL e anon key (já em `js/config.js`) (*Project Settings → API*)
- [x] Escudos em `assets/escudos/` (recortes do banner; `escudo_url` já aponta para eles)

## Fase 1 — Base do projeto
- [x] Estrutura de pastas conforme `02-arquitetura.md`
- [x] `css/tokens.css`, `base.css`, `componentes.css`
- [x] `js/config.example.js`, `supabase.js`, `api.js`, `realtime.js`, `ui.js`
- [x] Header + navegação inferior funcionando nas 4 páginas
- [x] `.gitignore`
- [x] Tela de entrada (`index.html`): Torcedor → `inicio.html` · Organizador → `admin.html`

## Fase 2 — Páginas públicas (leitura)
- [x] Classificação lendo `v_classificacao` + `ordenarClassificacao()`
- [x] Testes de desempate (`04-regras-classificacao.md`) passando — `node tests/classificacao.test.mjs`
- [x] Artilharia lendo `v_artilharia` (falta validar com dados reais)
- [x] Confrontos com seletor (falta validar com dados reais) de rodada
- [x] Tela inicial com resumo (falta validar com dados reais)
- [x] Realtime atualizando as 4 páginas (ligado; falta validar com Supabase)

## Fase 3 — Área do organizador
- [x] Login / logout (testado só em modo demo)
- [x] CRUD de times + upload de escudo (Storage ainda não testado)
- [x] Criar rodada e confrontos manuais
- [x] Formulário de resultado com autores dos gols e validação de soma
- [x] Reabrir / corrigir resultado

## Fase 4 — Compartilhar
- [x] Arte da classificação (inspirada no banner; ajustar detalhes)
- [x] Arte da rodada
- [x] Arte da artilharia
- [ ] Teste de envio real no WhatsApp (Android e iPhone)

## Fase 5 — Publicação
- [ ] GitHub Pages ativo
- [ ] URL do Pages configurada no Supabase Auth
- [ ] Carga dos jogos já realizados (rodadas 1 e 2)
- [ ] Conferir tabela com o banner atual
- [ ] Teste em 360px, 414px e desktop

## Fase 6 — Melhorias (feitas)
- [x] `supabase-js` com versão fixa; SRI no html2canvas/qrcode; modo demo só em localhost
- [x] Cadastro público desligado + escrita restrita (instruções em `03-banco-de-dados.md`)
- [x] PWA instalável (`manifest.webmanifest`, `sw.js`, ícones) e esqueleto de carregamento
- [x] QR code do site na arte; texto no compartilhamento; metadados Open Graph
- [x] Botão do canal do WhatsApp (`CANAL_WHATSAPP_URL`)
- [x] Placar ao vivo (`ao_vivo`, botões +/− no admin, selo AO VIVO)
- [x] Exportação CSV (backup) e CI de testes no GitHub Actions
- [ ] Página do time · fila offline do organizador · histórico de alterações · aba Jogadores · `og:image` (precisa da URL final) · story 9:16

## Fase 7 — Mural
- [x] SQL do mural em `09-mural.md` (tabelas, funções, Storage) — **ainda não executado no Supabase**
- [x] `mural.html`: feed, publicar foto com código do time, comentar, apagar
- [x] Organizador: publica como "Organização", modera posts/comentários, vê/gera códigos dos times
- [ ] Testar upload real (Storage), limites anti-spam e Realtime
- [ ] Distribuir os códigos aos times

## Ideias futuras (v2)
- Cartões amarelos/vermelhos e suspensões (completa critérios de desempate)
- Fase mata-mata
- Galeria de fotos por rodada
- PWA (instalar na tela inicial do celular)
- Vários campeonatos / temporadas

---

## Prompts sugeridos para o Claude Code
1. `Leia o CLAUDE.md e a pasta docs. Execute a Fase 1 do roadmap.`
2. `Execute a Fase 2. Comece pela classificação e rode os testes de desempate.`
3. `Execute a Fase 3 (admin.html), começando pelo login e cadastro de times.`
4. `Execute a Fase 4: arte da classificação idêntica ao banner em assets/banner-referencia.png.`

- [x] Calendario oficial carregado no Supabase (10 rodadas, 45 jogos, 13/09/2026 a 14/02/2027; Jogo 1 13h30, Jogo 2 15h40; rodada = jogos ate um time repetir)

- [x] Fase 8: cache da última visita, destaque do início (jogos de hoje/próximo dia), página do time (time.html), avisos Web Push (Edge Function avisar-push), engrenagem de ações no painel — ver docs/10-avisos-e-time.md

- [x] Fase 9: área do clube (clube.html) com calendário, resultados, tabela, artilharia, mural, elenco com foto e escalação compartilhável; freio contra códigos errados; painel abre direto após o login; app recarrega sozinho quando sai versão nova — ver docs/11-area-do-clube.md
- [x] Correções urgentes: códigos fortes, freio no mural, limite de escudos, prévia og:image, autor do gol ligado ao elenco
- [x] Mural com aprovação do organizador; área do clube com visual de app de jogo (cartas, folha de escolha, auto-escalar, pódio)
- [x] Rodada padrão = a mais recente pelo calendário (js/rodadas.js + tests/rodadas.test.mjs) em Confrontos, painel e Início
- [x] Horário a definir (jogos.horario_definido): Real Barça SR × Rua Nova remarcado para 01/11; painel tem Data, Hora e 'Horário a definir'
- [x] Avisos de foto para aprovar (organizador), painel em tempo real, arte de cada jogo para compartilhar
- [x] Itens 5, 6, 8, 9, 10: escalação publicada no jogo, elenco na página do time, craque do jogo, estatísticas na Tabela e story 9:16 — ver docs/12
- [x] Só o Adm aprova/apaga posts; aba Elenco no painel; entrada do clube em 2 passos
- [x] Mural: moderação só no modo organizador (?moderar=1); página Elenco no menu do torcedor
- [x] Elenco redesenhado: seletor de escudos, resumo por linha, busca, grupos por posição e ficha do jogador
- [x] Tela inicial redesenhada (marca, jogo de agora, escolha com ícones novos, organizador destacado, escudos em faixa)
- [x] Auditoria: tempo real por página, pausa em segundo plano, demo sob demanda, cache de imagens com limite, índices — ver docs/13
- [x] Painel com menu próprio (Jogos, Elenco, Mural, Ajustes, Ver site); Exportar CSV e Times em Ajustes; compartilhar só com ícone
- [x] Painel 100%% interno (Mural dentro do painel); cartões de times com Copiar; mural estilo feed com post só de texto
