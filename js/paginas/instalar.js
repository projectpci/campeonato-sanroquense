// Tutorial visual: instalar o app e ativar os avisos (iPhone e Android).
import { montarLayout, icone } from '../ui.js';

const app = document.getElementById('app');

const traco = (caminho) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${caminho}</svg>`;
const ICONES = {
  compartilhar: traco('<path d="M12 15V4M8 8l4-4 4 4M7 11H6a1 1 0 00-1 1v7a1 1 0 001 1h12a1 1 0 001-1v-7a1 1 0 00-1-1h-1"/>'),
  mais: traco('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>'),
  pontos: traco('<circle cx="12" cy="5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="19" r="1.2" fill="currentColor"/>'),
  navegador: traco('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'),
  ok: traco('<path d="M5 12l5 5 9-10"/>'),
  baixar: traco('<path d="M12 4v11M8 11l4 4 4-4M5 20h14"/>'),
};

// [ícone, título, detalhe]
const PASSOS = {
  iphone: [
    [ICONES.navegador, 'Abra no <b>Safari</b>', 'Use o Safari. Dentro do WhatsApp ou do Instagram não funciona: toque em "Abrir no Safari".'],
    [ICONES.compartilhar, 'Toque em <b>Compartilhar</b>', 'O quadrado com a seta para cima, na barra de baixo.'],
    [ICONES.mais, '<b>Adicionar à Tela de Início</b>', 'Role a lista para baixo até achar essa opção.'],
    [ICONES.ok, 'Toque em <b>Adicionar</b>', 'Canto superior direito. O ícone Campeonato SRP aparece na sua tela.'],
    [icone('coroa'), 'Abra <b>pelo ícone</b>', 'Saia do Safari e abra o app pelo ícone novo. Escolha <b>Torcedor</b>.'],
    [icone('sino'), 'Toque em <b>Ativar avisos</b>', 'Na tela Início. Quando o iPhone perguntar, toque em <b>Permitir</b>.'],
  ],
  android: [
    [ICONES.navegador, 'Abra no <b>Chrome</b>', 'Se o link veio pelo WhatsApp, toque nos 3 pontinhos e em "Abrir no Chrome".'],
    [ICONES.pontos, 'Toque nos <b>3 pontinhos</b>', 'Canto superior direito do Chrome.'],
    [ICONES.baixar, '<b>Instalar app</b>', 'Ou "Adicionar à tela inicial". Confirme em <b>Instalar</b>.'],
    [icone('coroa'), 'Abra <b>pelo ícone</b>', 'O ícone Campeonato SRP está na sua tela. Escolha <b>Torcedor</b>.'],
    [icone('sino'), 'Toque em <b>Ativar avisos</b>', 'Na tela Início. Quando o celular perguntar, toque em <b>Permitir</b>.'],
  ],
};

const REQUISITOS = {
  iphone: 'Precisa do iOS 16.4 ou mais novo. Sem instalar o app, o iPhone não recebe avisos.',
  android: 'Funciona no Chrome. Se o botão "Instalar app" não aparecer, use "Adicionar à tela inicial".',
};

const AJUDA = `
  <details class="ajuda"><summary>Os avisos não chegam?</summary>
    <ul>
      <li>Abra o app <b>pelo ícone</b> e confira se o botão mostra <b>Avisos ligados</b>.</li>
      <li><b>iPhone:</b> Ajustes → Notificações → Campeonato SRP → ligar <b>Permitir notificações</b>.</li>
      <li><b>Android:</b> toque no cadeado ao lado do endereço → Permissões → Notificações → <b>Permitir</b>.</li>
      <li>Modo "Não perturbe" ou "Foco" silencia os avisos.</li>
    </ul>
  </details>`;

const ehIphone = /iphone|ipad|ipod/i.test(navigator.userAgent);
let aba = ehIphone ? 'iphone' : 'android';

function desenhar() {
  const passos = PASSOS[aba].map(([figura, titulo, detalhe], n) => `
    <li class="passo">
      <span class="passo__numero">${n + 1}</span>
      <span class="passo__figura">${figura}</span>
      <div><strong>${titulo}</strong><p class="texto-2">${detalhe}</p></div>
    </li>`).join('');
  const link = new URL('instalar.html', location.href).href;
  const texto = `Instale o app do Campeonato SRP e receba os gols no celular: ${link}`;
  app.innerHTML = `
    <div class="chips" role="tablist">
      ${[['iphone', 'iPhone'], ['android', 'Android']].map(([id, rotulo]) =>
        `<button class="chip${aba === id ? ' chip--ativo' : ''}" data-aba="${id}">${rotulo}</button>`).join('')}
    </div>
    <p class="texto-2 texto-pequeno">${REQUISITOS[aba]}</p>
    <ol class="passos">${passos}</ol>
    ${AJUDA}
    <p class="centro"><a class="botao" href="https://wa.me/?text=${encodeURIComponent(texto)}" target="_blank" rel="noopener">${icone('whatsapp')} Enviar este tutorial no WhatsApp</a></p>
    <p class="centro texto-pequeno"><a class="texto-2" href="inicio.html">← Voltar ao início</a></p>`;
  app.querySelectorAll('[data-aba]').forEach((b) => b.addEventListener('click', () => { aba = b.dataset.aba; desenhar(); }));
}

montarLayout('inicio');
document.querySelector('.faixa')?.remove();
desenhar();
