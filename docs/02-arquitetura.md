# 02 — Arquitetura

## Visão geral
```
[Navegador (celular/PC)]
   │  HTML/CSS/JS estático (GitHub Pages)
   │
   ├── supabase-js ──► Supabase
   │                    ├─ Postgres (tabelas + views + RPC salvar_resultado)
   │                    ├─ Auth (login do organizador)
   │                    ├─ Realtime (mudanças em jogos/gols/times)
   │                    └─ Storage (bucket "escudos")
   │
   └── html2canvas ──► PNG ──► Web Share API / WhatsApp
```

## Estrutura de pastas
```
campeonato-sanroquense/
├── CLAUDE.md
├── README.md
├── .gitignore                 # contém js/config.js
├── index.html                 # Tela inicial
├── confrontos.html            # Rodadas e jogos
├── classificacao.html         # Tabela
├── artilharia.html            # Artilheiros
├── admin.html                 # Área do organizador (login + cadastros + placar)
├── css/
│   ├── tokens.css             # Variáveis de cor, fonte, espaçamento
│   ├── base.css               # Reset, tipografia, layout geral
│   ├── componentes.css        # Header, nav, cards, tabela, botões, modal
│   └── compartilhar.css       # Layout fixo da arte exportada (1080px)
├── js/
│   ├── config.example.js      # Modelo (vai pro Git)
│   ├── config.js              # URL + anon key (NÃO vai pro Git)
│   ├── supabase.js            # Cria e exporta o client
│   ├── api.js                 # Funções de leitura/escrita (única porta para o banco)
│   ├── realtime.js            # assinarMudancas(callback)
│   ├── classificacao.js       # Ordenação + desempate por confronto direto
│   ├── ui.js                  # Helpers: renderizar escudo, toast, loading, nav ativa
│   ├── compartilhar.js        # gerarImagem(elemento) + compartilharWhatsApp()
│   └── paginas/
│       ├── inicio.js
│       ├── confrontos.js
│       ├── classificacao.js
│       ├── artilharia.js
│       └── admin.js
├── assets/
│   ├── logo.png               # Logo do campeonato
│   ├── fundo-estadio.jpg      # Fundo (opcional, leve: < 200 KB)
│   └── escudo-padrao.svg      # Usado quando o time não tem escudo
└── docs/                      # Especificação (este conjunto de .md)
```

## Responsabilidades dos módulos
| Módulo | Faz | Não faz |
|---|---|---|
| `api.js` | `listarTimes()`, `listarRodadas()`, `listarJogos(rodadaId?)`, `buscarClassificacao()`, `buscarArtilharia()`, `salvarResultado()`, CRUD de times/rodadas/jogos | Manipular DOM |
| `realtime.js` | Um canal `campeonato` ouvindo `jogos`, `gols`, `times`, `rodadas`; chama callback com debounce de 300 ms | Buscar dados |
| `classificacao.js` | Recebe linhas da view + jogos encerrados, devolve lista ordenada com posição | Acessar o Supabase |
| `paginas/*.js` | Busca via `api.js`, renderiza, assina realtime | Regras de negócio |

## Fluxo — lançar resultado
1. Organizador abre o jogo em `admin.html` → informa placar 2 × 1.
2. Formulário gera 2 linhas de gol para o mandante e 1 para o visitante (nome com autocomplete + quantidade, checkbox "gol contra").
3. Front valida soma; chama `rpc('salvar_resultado', {...})`.
4. Função no banco valida de novo, cria jogadores novos, apaga gols antigos do jogo, grava gols e placar, marca `encerrado`.
5. Realtime dispara → todas as páginas abertas recarregam classificação/artilharia.

## Configuração (`js/config.example.js`)
```js
// Copie para js/config.js e preencha. A anon key é pública; a segurança vem das políticas RLS.
export const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
export const SUPABASE_ANON_KEY = 'sua-anon-key';
export const CAMPEONATO_ID = 1;
```

> **GitHub Pages:** como o site é estático, `config.js` precisa estar publicado. Opção simples: commitar `config.js` (a anon key é pública por design). Se preferir não commitar, usar GitHub Actions para gerar o arquivo a partir de *Secrets* no deploy.

## Deploy
1. Repositório `campeonato-sanroquense` no GitHub.
2. *Settings → Pages* → *Deploy from branch* → `main` / `root`.
3. No Supabase: *Authentication → URL Configuration* → adicionar a URL do GitHub Pages em *Site URL* e *Redirect URLs*.
