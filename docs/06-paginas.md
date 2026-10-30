# 06 — Páginas

Todas as páginas públicas: header + conteúdo + navegação inferior + botão Compartilhar. Todas assinam o Realtime.

---

## 1. Tela Inicial — `index.html`
**Objetivo:** resumo rápido do campeonato.

Blocos (de cima para baixo):
1. **Hero**: título do campeonato, Local e Organização (dados da tabela `campeonato`).
2. **Próxima rodada / rodada atual**: cards dos jogos (rodada com jogos `agendado` de menor número; se não houver, a última).
3. **Últimos resultados**: jogos da última rodada encerrada, com autores dos gols.
4. **Top 4 da classificação** (mini-tabela: POS, TIME, PTS) + link "Ver tabela completa".
5. **Artilheiro(s) líder(es)**: card de destaque com nome, time e gols + link "Ver artilharia".
6. Frases do rodapé ("Juntos pelo futebol de nossa comunidade!").

---

## 2. Confrontos — `confrontos.html`
**Objetivo:** ver todos os jogos por rodada.

- Seletor de rodada no topo (chips roláveis horizontais: `R1 R2 R3 …`), abre na rodada atual.
- Cabeçalho da rodada: "RODADA 3 · 02/11".
- Lista de **cards de jogo** (ver design system).
- Jogo encerrado: placar grande + lista de gols por time (`⚽ Nome (2)` / `⚽ Nome (contra)`).
- Botão Compartilhar → imagem **da rodada** (resultados ou agenda).

---

## 3. Classificação — `classificacao.html`
**Objetivo:** tabela completa, igual ao banner.

- Faixa "TABELA DE CLASSIFICAÇÃO".
- Tabela com `ordenarClassificacao()` (ver `04-regras-classificacao.md`).
- Coroas no top 3; coluna PTS destacada.
- Legenda no rodapé (J = Jogos, V = Vitórias, ...).
- Texto pequeno: "Atualizado em dd/mm às hh:mm" (maior `atualizado_em` dos jogos).
- Botão Compartilhar → imagem da **classificação** (layout igual ao banner).

---

## 4. Artilharia — `artilharia.html`
**Objetivo:** ranking de goleadores.

- Faixa "ARTILHARIA".
- Lista da view `v_artilharia`: posição (empates compartilham posição: 1º, 1º, 3º), nome do jogador, escudo + time, gols.
- Top 3 com coroas.
- Filtro opcional por time (select).
- Gols contra **não** contam (já filtrado na view).
- Botão Compartilhar → imagem do **top 10 artilheiros**.

---

## 5. Área do Organizador — `admin.html` (não aparece na navegação pública)
Acesso por link direto. Sem sessão → tela de login (e-mail + senha, `supabase.auth.signInWithPassword`).

Abas:

### a) Times
- Lista com escudo, nome, sigla, ativo.
- Formulário: nome*, sigla, upload de escudo (Storage `escudos/{time_id}.png`, redimensionar para 256px no front antes de subir).
- Desativar (não excluir) time que já jogou.

### b) Rodadas e Confrontos
- Criar rodada: número (sugere próximo), data, observação.
- Dentro da rodada: **"+ Adicionar confronto"** → select Mandante, select Visitante (lista só times ativos e sem jogo naquela rodada), data/hora opcional.
- Editar/excluir confronto agendado. Excluir encerrado pede confirmação.

### c) Lançar Resultado
- Lista de jogos por rodada; toque no jogo abre o **formulário de placar**:
```
 [Escudo] RDL      [ 2 ]  ×  [ 1 ]      PALMEIRAS [Escudo]

 Gols RDL (2)                       Gols PALMEIRAS (1)
 [Nome jogador ▾] [qtd 2] [☐ contra] [Nome jogador ▾] [qtd 1] [☐ contra]
 + adicionar autor                  + adicionar autor

 Soma: 2/2 ✔                         Soma: 1/1 ✔
                [ SALVAR RESULTADO ]
```
- Campo nome com `<datalist>` dos jogadores já cadastrados do time (gol normal) ou do adversário (gol contra).
- Botão Salvar só habilita quando as somas batem com o placar.
- Chama `api.salvarResultado(jogoId, golsMandante, golsVisitante, listaGols)` → RPC.
- Botão "Reabrir jogo" volta status para `agendado` e limpa gols (confirmação).

### d) Jogadores (opcional v1)
- Lista por time para corrigir nome duplicado/grafia. Mesclar dois jogadores = mover gols e excluir o duplicado.

---

## Navegação
| Ícone | Rótulo | Página |
|---|---|---|
| 🏠 | Início | `index.html` |
| 📅 | Confrontos | `confrontos.html` |
| 🏆 | Tabela | `classificacao.html` |
| ⚽ | Artilharia | `artilharia.html` |

Usar ícones SVG inline (não emoji) na versão final.

## Tela inicial (index.html) — v23
Ordem pensada como história: **marca** (coroa, nome, local, "10 times · 45 jogos · 1 campeão") → **agora** (cartão com o jogo
ao vivo, "Hoje tem jogo" ou o próximo jogo, que leva ao Início) → **escolha** ("Como você quer entrar?": Torcedor com ícone de
torcida e Clube com ícone de camisa; o último perfil usado ganha o selo "Continuar") → **Área do organizador** (botão dourado
com cadeado) → escudos dos 10 times correndo em faixa → instalar o app. Entrada em cascata e respeito a "reduzir movimento".
Dados de `js/paginas/entrada.js`; se o banco não responder, a tela funciona só com os botões.

## Painel do organizador (v25)
Menu próprio (embaixo no celular, em cima no computador): **Jogos** (rodadas e cards com a engrenagem de lançar/editar), **Elenco**, **Mural** (modo moderação, com contador de fotos pendentes), **Ajustes** (avisos no celular, exportar CSV, times e códigos, sair) e **Ver site**. Navega por `#jogos`, `#elenco`, `#ajustes`; o menu só aparece depois do login. O botão flutuante de compartilhar das páginas públicas é só o ícone do WhatsApp.
