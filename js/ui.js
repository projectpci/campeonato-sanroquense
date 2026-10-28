// Helpers de interface: layout (header + nav), escudo, toast, loading, formatação.
import { demo, semConfiguracao } from './supabase.js';
import './pwa.js';

const ICONES = {
  coroa: '<path d="M3 18h18l1-11-5 4-5-7-5 7-5-4z" fill="currentColor"/>',
  inicio: '<path d="M3 11l9-8 9 8v10h-6v-6H9v6H3z" fill="currentColor"/>',
  confrontos: '<path d="M7 2v3M17 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  tabela: '<path d="M7 4h10v5a5 5 0 01-10 0zM7 6H3v2a4 4 0 004 4M17 6h4v2a4 4 0 01-4 4M12 14v4M8 21h8M10 18h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  artilharia: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8l4 3-1.5 4.5h-5L8 11z" fill="currentColor"/>',
  mural: '<path d="M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="10" r="1.8" fill="currentColor"/><path d="M4 17l5-4.5 3.5 3 3-2.5L21 17" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  whatsapp:'<path d="M12 3a9 9 0 00-7.7 13.6L3 21l4.5-1.2A9 9 0 1012 3zm4.5 12.2c-.2.6-1.2 1.1-1.7 1.1-.4 0-1 .2-3.3-.7-2.8-1.2-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 .9-2.3c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2 0 .4-.1.6l-.4.5c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.1 1 2 1.3 2.3 1.4.3.1.4.1.6-.1l.8-1c.2-.2.4-.2.6-.1l1.8.9c.2.1.4.2.5.3.1.2.1.7-.1 1.3z" fill="currentColor"/>',
};

export function icone(nome) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[nome]}</svg>`;
}

const PAGINAS = [
  { id: 'inicio', rotulo: 'Início', href: 'inicio.html', icone: 'inicio' },
  { id: 'confrontos', rotulo: 'Confrontos', href: 'confrontos.html', icone: 'confrontos' },
  { id: 'classificacao', rotulo: 'Tabela', href: 'classificacao.html', icone: 'tabela' },
  { id: 'artilharia', rotulo: 'Artilharia', href: 'artilharia.html', icone: 'artilharia' },
  { id: 'mural', rotulo: 'Mural', href: 'mural.html', icone: 'mural' },
];

function htmlNav(ativa) {
  return PAGINAS.map((p) => `
    <a class="nav__item${p.id === ativa ? ' nav__item--ativo' : ''}" href="${p.href}"
       ${p.id === ativa ? 'aria-current="page"' : ''}>${icone(p.icone)}<span>${p.rotulo}</span></a>`).join('');
}

// Monta header + navegação. `ativa` = id da página (ou null no admin, que não aparece na nav pública).
export function montarLayout(ativa) {
  document.body.insertAdjacentHTML('afterbegin', `
    <header class="header">
      <a class="header__marca" href="${ativa ? 'inicio.html' : 'index.html'}">${icone('coroa')}<span>SAN<em>ROQUENSE</em></span></a>
      <nav class="nav header__nav" aria-label="Principal">${htmlNav(ativa)}</nav>
      <a class="header__sair" id="btn-sair-header" href="index.html">Sair</a>
    </header>`);
  document.body.insertAdjacentHTML('beforeend', `
    <nav class="nav" aria-label="Principal (celular)">${htmlNav(ativa)}</nav>`);
  // No desktop a nav inferior some e usa a do header
  const inferior = document.body.lastElementChild;
  inferior.classList.add('nav--inferior');
}

// Escapa texto vindo do banco antes de colocar em innerHTML
export function escapar(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function escudo(time, tamanho = 32) {
  const src = time?.escudo_url || 'assets/escudo-padrao.svg';
  return `<img class="escudo escudo--${tamanho}" src="${escapar(src)}" alt="Escudo ${escapar(time?.nome ?? '')}"
    loading="lazy" onerror="this.onerror=null;this.src='assets/escudo-padrao.svg'">`;
}

export function mostrarCarregando(elemento, texto = 'Carregando...') {
  // esqueleto: blocos cinza pulsando no lugar do conteúdo
  elemento.innerHTML = `<div class="esqueleto" role="status" aria-label="${escapar(texto)}">${'<span class="esqueleto__bloco"></span>'.repeat(5)}</div>`;
}

export function mostrarAviso(elemento, texto) {
  elemento.innerHTML = `<p class="aviso">${escapar(texto)}</p>`;
}

// Em modo demonstração (sem config.js) mostra uma faixa de aviso e segue com dados fictícios
export function checarConfiguracao(elemento) {
  if (semConfiguracao) {
    mostrarAviso(elemento, 'Site sem configuração do Supabase (js/config.js). Avise o organizador.');
    return false;
  }
  if (demo) {
    elemento.insertAdjacentHTML('beforebegin',
      '<p class="aviso">Modo demonstração: dados fictícios. Configure js/config.js para usar o Supabase.</p>');
  }
  return true;
}

let temporizadorToast;
export function toast(mensagem, erro = false) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = `toast${erro ? ' toast--erro' : ''}`;
  el.setAttribute('role', 'status');
  el.textContent = mensagem;
  document.body.append(el);
  clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(() => el.remove(), 3500);
}

export const formatarData = (iso) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';

export const formatarHora = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';

// Botão flutuante "Compartilhar": roda `aoClicar` mostrando o estado "Gerando imagem..."
export function botaoCompartilhar(aoClicar) {
  const botao = document.createElement('button');
  botao.className = 'botao botao-compartilhar';
  botao.innerHTML = `${icone('whatsapp')}Compartilhar`;
  botao.addEventListener('click', async () => {
    botao.disabled = true;
    toast('Gerando imagem...');
    try {
      await aoClicar();
    } catch (erro) {
      toast(`Não foi possível gerar a imagem: ${erro.message}`, true);
    } finally {
      botao.disabled = false;
    }
  });
  document.body.append(botao);
}

// "há 5 min", "há 3 h", "ontem", ou a data
export function tempoRelativo(iso) {
  const min = Math.round((Date.now() - new Date(iso)) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.floor(min / 60)} h`;
  if (min < 2880) return 'ontem';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
