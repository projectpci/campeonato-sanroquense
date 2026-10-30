# Elenco por WhatsApp (cadastro em massa)

Objetivo: os clubes informam o elenco por um formulário no celular, enviam pelo WhatsApp e o organizador importa tudo de uma vez.

## Fluxo
1. **Organizador** abre `#elenco` → **📲 Elenco por WhatsApp** → aba **Enviar** e manda o link (geral ou um por time: `cadastro-elenco.html?time=ID&clube=nome`, que abre já com o time escolhido e o nome em destaque). **Copiar** e **WhatsApp** levam a mensagem pronta, personalizada com o nome do time ("Olá, responsável pelo *Palmeiras*!…") e o link.
2. **Clube** abre o link, escolhe o time, informa o técnico e os jogadores por posição (**Goleiros, Zagueiros, Laterais, Volantes, Meias, Atacantes** = GOL, ZAG, LAT, VOL, MEI, ATA do sistema) e toca em **Enviar** (abre o WhatsApp com a mensagem pronta) ou **Copiar**. O rascunho fica salvo no aparelho.
3. **Organizador** cola as mensagens recebidas (pode colar várias, de vários times) em **Importar** → **Ler mensagens**, confere (time reconhecido, posição, número, repetidos) e toca em **Importar N jogadores**.

## Formato da mensagem (gerado pelo formulário)
```
📋 *ELENCO · CAMPEONATO SRP*
Time: Real Barça SR
Técnico: Zé do Carmo

🧤 *Goleiros*
1 - Toninho

🛡️ *Zagueiros*
4 - Cabeça
```
O leitor (`js/importarElenco.js`) também aceita mensagens digitadas à mão: `10 - Nome`, `Nome 10`, `10) Nome`, `Nome | MEI | 10`, títulos com sinônimos (defensores, meio-campistas, ataque…), emojis, negrito do WhatsApp e o cabeçalho `[30/10/2026 10:32] Fulano:`. Nomes TODOS EM MAIÚSCULAS ou minúsculas viram "Nome Capitalizado". Conversa solta ("Segue o elenco", "Obrigado") é ignorada.

## Regras da importação
- Time reconhecido por nome ou sigla (sem acento/maiúscula); se não tiver certeza, o organizador escolhe na lista.
- Jogador que **já existe** no time (mesmo nome, ignorando acento e maiúscula) só recebe número e posição; os outros são criados. **Ninguém é apagado.**
- Antes de importar dá para corrigir nome/número/posição e desmarcar linhas. Nome com menos de 2 ou mais de 40 letras não é importado.
- Técnico: caixa "Técnico" marcada atualiza o nome do técnico do time.
- Escrita direta nas tabelas `jogadores` e `times` pelo organizador autenticado (política RLS "escrita organizador"); função `importarElenco` em `js/api.js`.

## Opcional: número que recebe os elencos
Em `js/config.js` (público, não é segredo): `export const WHATSAPP_ELENCO = '5575999999999';` — o botão Enviar abre direto a conversa com esse número. Vazio = o clube escolhe o contato.

## Testes
`node tests/elenco.test.mjs` (leitor, formatos, vários times, avisos).
