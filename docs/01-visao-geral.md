# 01 — Visão Geral

## Contexto
Campeonato regional amador em São Roque do Paraguaçu – BA. Os times se enfrentam **semanalmente**,
em rodadas definidas pela organização. Hoje a tabela é feita manualmente como arte para WhatsApp.

## Objetivo
Um sistema simples onde o organizador:
1. Cadastra os times;
2. Monta os confrontos de cada rodada;
3. Lança o placar e quem fez os gols;
4. E o sistema calcula **classificação** e **artilharia** sozinho, publicando para todos em tempo real
   e gerando a imagem pronta para o WhatsApp.

## Usuários
| Perfil | Acesso | O que faz |
|---|---|---|
| **Público** (jogadores, torcida) | Sem login | Consulta início, confrontos, classificação, artilharia; compartilha imagens |
| **Organizador** | Login (e-mail/senha – Supabase Auth) | Cadastra times/jogadores, cria rodadas e confrontos, lança/corrige placares |

## Requisitos funcionais
| ID | Requisito |
|---|---|
| RF01 | Cadastrar, editar e desativar times (nome, sigla, escudo) |
| RF02 | Criar rodadas (número, data, observação) |
| RF03 | Inserir confrontos manualmente na rodada, escolhendo mandante × visitante entre os times cadastrados |
| RF04 | Impedir confronto de um time contra ele mesmo e avisar se o time já joga na mesma rodada |
| RF05 | Lançar placar e, no mesmo formulário, informar os autores dos gols de cada time (nome + quantidade) |
| RF06 | Permitir gol contra (conta para o placar, não conta para artilharia) |
| RF07 | Validar: soma dos gols informados por time = placar do time |
| RF08 | Corrigir resultado já lançado (substitui gols anteriores) |
| RF09 | Calcular classificação automaticamente (J, V, E, D, GP, GC, SG, PTS, %) |
| RF10 | Calcular artilharia automaticamente (jogador, time, gols) |
| RF11 | Atualizar todas as telas em tempo real |
| RF12 | Gerar imagem PNG (classificação, rodada, artilharia) e compartilhar no WhatsApp |
| RF13 | Autocompletar nome de jogador já cadastrado no time (evita "Joao" vs "João") |

## Requisitos não funcionais
- Responsivo, priorizando celular (360px+).
- Carregamento rápido em 4G (sem framework, sem build).
- Custo zero: Supabase Free + GitHub Pages.
- Identidade visual igual ao banner oficial (ver `05-design-system.md`).

## Fora do escopo (v1)
- Cartões, súmula completa, escalações.
- Fase eliminatória (mata-mata).
- Múltiplos campeonatos (estrutura já preparada com tabela `campeonato`, mas UI para um só).
