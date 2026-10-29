# ⚽ Campeonato SRP

Sistema de tabela do campeonato regional de **São Roque do Paraguaçu – BA**.
Local: Campo Maicon Santos · Organização: Pebinha e Duduzete.

## Funcionalidades
- Cadastro de times (nome + escudo)
- Confrontos por rodada definidos manualmente
- Lançamento de placar com autores dos gols
- Classificação automática (critérios do Brasileirão)
- Artilharia automática
- Atualização em tempo real (Supabase Realtime)
- Botão **Compartilhar** → gera imagem PNG para o WhatsApp
- Layout responsivo para celular

## Como rodar
1. Crie um projeto no [Supabase](https://supabase.com) e execute o SQL de `docs/03-banco-de-dados.md` no **SQL Editor**.
2. Em *Authentication → Sign In / Providers*, **desligue o cadastro público** ("Allow new users to sign up"). Depois, em *Authentication → Users*, crie o(s) usuário(s) organizador(es) (e-mail + senha).
3. Copie `js/config.example.js` para `js/config.js` e preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` (e, se quiser, `CANAL_WHATSAPP_URL`). Para o GitHub Pages o `config.js` precisa estar publicado: remova a linha `js/config.js` do `.gitignore` e faça o commit (a anon key é pública). Sem `config.js` o site só funciona em modo demonstração em `localhost`.
4. Rode local: `npx serve .`
5. Publique: GitHub → *Settings → Pages* → branch `main`, pasta `/root`.

## Documentação
Toda a especificação está em [`docs/`](docs/). Instruções para o Claude Code em [`CLAUDE.md`](CLAUDE.md).
