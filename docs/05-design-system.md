# 05 — Design System

Baseado no banner oficial do campeonato: **fundo escuro de estádio + verde neon**, tipografia esportiva, coroas para o pódio.

## Paleta (`css/tokens.css`)
```css
:root {
  /* Fundos */
  --cor-fundo:            #050B07;  /* quase preto esverdeado */
  --cor-fundo-2:          #0B1A10;  /* cards / linhas da tabela */
  --cor-fundo-3:          #12281A;  /* hover / linha destacada */
  --cor-cabecalho-tabela: #08140C;

  /* Verde neon (identidade) */
  --cor-primaria:         #39FF14;  /* verde neon – títulos, PTS */
  --cor-primaria-forte:   #00E33A;  /* botões */
  --cor-primaria-clara:   #A6FF4D;  /* lima – destaques, gradiente */
  --cor-brilho:           0 0 12px rgba(57, 255, 20, .55); /* glow */

  /* Bordas */
  --cor-borda:            #1F5C2E;
  --cor-borda-neon:       #2BD94F;

  /* Texto */
  --cor-texto:            #FFFFFF;
  --cor-texto-2:          #B9C7BC;
  --cor-texto-inverso:    #04140A;  /* texto sobre faixa verde */

  /* Pódio (coroas) */
  --cor-ouro:             #FFC93C;
  --cor-prata:            #D9DEE3;
  --cor-bronze:           #F08A3E;

  /* Estados */
  --cor-positivo:         #39FF14;
  --cor-negativo:         #FF4D4D;
  --cor-neutro:           #B9C7BC;

  /* Tipografia */
  --fonte-titulo:   'Permanent Marker', 'Bangers', cursive;   /* estilo pincel do banner */
  --fonte-destaque: 'Anton', 'Bebas Neue', sans-serif;        /* faixas e cabeçalhos */
  --fonte-corpo:    'Barlow Condensed', 'Oswald', sans-serif; /* tabela, textos */

  /* Espaçamento e forma */
  --raio:        10px;
  --raio-grande: 16px;
  --esp-1: 4px; --esp-2: 8px; --esp-3: 12px; --esp-4: 16px; --esp-5: 24px; --esp-6: 32px;
}
```

Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:wght@500;700;800&family=Permanent+Marker&display=swap" rel="stylesheet">
```

## Elementos visuais do banner a reproduzir
| Elemento | Como fazer |
|---|---|
| Título "1º CAMPEONATO / SANROQUENSE" | `--fonte-titulo`, branco + verde com `text-shadow: var(--cor-brilho)`, leve inclinação `-4deg` |
| Faixa "TABELA DE CLASSIFICAÇÃO" | Fundo verde com borda irregular (efeito pincel) via `clip-path` ou SVG; texto preto `--fonte-destaque` em itálico |
| Info "Local / Organização" | Card com borda `--cor-borda-neon`, ícone verde, label verde pequeno + valor branco grande |
| Fundo | Gradiente radial escuro + `assets/fundo-estadio.jpg` com overlay 85% |
| Tabela | Linhas `--cor-fundo-2`, bordas finas `--cor-borda`, coluna PTS em verde neon grande |
| Pódio | 1º coroa ouro, 2º prata, 3º bronze; linha do 1º com borda dourada |
| Frases de rodapé | "Respeito é a base do jogo!" / "Futebol é união!" em `--fonte-titulo` |

## Componentes
- **Header**: logo/título compacto (no celular só "SANROQUENSE" + coroa).
- **Navegação inferior fixa (mobile)**: 4 ícones — Início · Confrontos · Tabela · Artilharia. Item ativo em verde neon. No desktop vira menu no topo.
- **Card de jogo**: escudo mandante · placar (ou "×" + horário) · escudo visitante; abaixo, nomes dos autores dos gols (⚽ Pedro 2', etc.). Selo de status: `AGENDADO` (cinza), `ENCERRADO` (verde).
- **Tabela de classificação**: colunas `POS · TIME · PTS · J · V · E · D · GP · GC · SG`. No celular ≤ 400px ocultar GP/GC (mostrar via toque na linha).
- **Linha de artilheiro**: posição · nome (grande) · escudo + nome do time (pequeno) · gols em verde neon.
- **Botão primário**: fundo `--cor-primaria-forte`, texto `--cor-texto-inverso`, `--fonte-destaque`, maiúsculo.
- **Botão compartilhar**: ícone WhatsApp + "COMPARTILHAR", flutuante no canto inferior direito acima da nav.
- **Toast**: feedback "Resultado salvo ✔" / erros.
- **Escudo**: `<img>` circular 32px (tabela) / 48px (cards); fallback `assets/escudo-padrao.svg` com a sigla.

## Acessibilidade
- Contraste mínimo 4.5:1 (branco e verde neon sobre fundo escuro passam).
- Área de toque ≥ 44px.
- Não usar só cor para resultado: SG mostra sinal (+/−).
