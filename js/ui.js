// Helpers de interface: layout (header + nav), escudo, toast, loading, formatação.
import { demo, semConfiguracao } from './supabase.js';
import './pwa.js';
import { meuTime, declararNoBanco, perguntarNaPrimeiraVez } from './meuTime.js';

const ICONES = {
  coroa: '<path d="M3 18h18l1-11-5 4-5-7-5 7-5-4z" fill="currentColor"/>',
  inicio: '<path d="M3 11l9-8 9 8v10h-6v-6H9v6H3z" fill="currentColor"/>',
  confrontos: '<path d="M7 2v3M17 2v3M3 8h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  tabela: '<path d="M7 4h10v5a5 5 0 01-10 0zM7 6H3v2a4 4 0 004 4M17 6h4v2a4 4 0 01-4 4M12 14v4M8 21h8M10 18h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  artilharia: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8l4 3-1.5 4.5h-5L8 11z" fill="currentColor"/>',
  mural: '<path d="M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="10" r="1.8" fill="currentColor"/><path d="M4 17l5-4.5 3.5 3 3-2.5L21 17" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  elenco: '<circle cx="9" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="17" cy="9" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 14.6c2.6.2 4.6 1.9 5.3 5.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  sino: '<path d="M6 9a6 6 0 0112 0c0 6 2 7 2 7H4s2-1 2-7zM10 20a2 2 0 004 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  engrenagem: '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  torcedor: '<circle cx="12" cy="6.5" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 21v-5.5a6 6 0 0112 0V21M4 4l3 5M20 4l-3 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  escudo: '<path d="M12 3l8 3v6c0 4.6-3.4 8.3-8 9-4.6-.7-8-4.4-8-9V6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8.5 12l2.5 2.5 4.5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  escalacao: '<rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 12h16M9 3v3h6V3M9 21v-3h6v3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/>',
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
  { id: 'elenco', rotulo: 'Elenco', href: 'elenco.html', icone: 'elenco' },
  { id: 'mural', rotulo: 'Mural', href: 'mural.html', icone: 'mural' },
];

function htmlNav(ativa, paginas = PAGINAS) {
  return paginas.map((p) => `
    <a class="nav__item${p.id === ativa ? ' nav__item--ativo' : ''}" href="${p.href}"
       data-nav="${p.id}" ${p.id === ativa ? 'aria-current="page"' : ''}>${icone(p.icone)}<span>${p.rotulo}</span></a>`).join('');
}

// Monta header + navegação. `ativa` = id da página (ou null no admin, que não aparece na nav pública).
// `opcoes.paginas`: menu próprio (painel do organizador) · `opcoes.inicio`: destino da marca · `opcoes.sino`: sino de avisos
export function montarLayout(ativa, { paginas = PAGINAS, inicio = ativa ? 'inicio.html' : 'index.html', sino = Boolean(ativa) && paginas === PAGINAS, torcidometro = false } = {}) {
  document.body.insertAdjacentHTML('afterbegin', `
    <header class="header">
      <a class="header__marca" href="${inicio}">${icone('coroa')}<span>CAMPEONATO <em>SRP</em></span></a>
      <nav class="nav header__nav" aria-label="Principal">${htmlNav(ativa, paginas)}</nav>
      <div class="perfil">
        <button class="perfil__selo" id="btn-perfil" type="button" aria-haspopup="true" aria-expanded="false"></button>
        <div class="perfil__menu" id="menu-perfil" hidden>
          <p class="perfil__quem"></p>
          <div class="perfil__extra" id="perfil-extra"></div>
          <a class="perfil__voltar oculto" href="#"></a>
          <a class="header__sair" id="btn-sair-header" href="index.html?sair">Sair do perfil</a>
        </div>
      </div>
    </header>`);
  document.body.insertAdjacentHTML('beforeend', `
    <nav class="nav" aria-label="Principal (celular)">${htmlNav(ativa, paginas)}</nav>`);
  // No desktop a nav inferior some e usa a do header
  const inferior = document.body.lastElementChild;
  inferior.classList.add('nav--inferior');
  window.__appIniciou = true; // js/resgate.js: a página abriu (não precisa limpar o cache)
  ligarMenuPerfil();
  if (paginas === PAGINAS) {
    if (ativa && !modoAtivo()) definirModo('torcedor');
    perfilNasPaginasPublicas();
    // Páginas do torcedor: "Sair" / "Trocar perfil" encerram o perfil (clube e painel tratam o próprio Sair)
    document.addEventListener('click', (e) => { if (e.target.closest('a[href^="index.html?sair"]')) definirModo(''); });
  }
  // Sino de avisos no cabeçalho das páginas públicas (carregado depois, para não atrasar a tela)
  if (sino) import('./avisos.js').then((m) => m.sinoNoCabecalho()).catch(() => {});
  // Torcidômetro: barra compacta no topo (só onde a página pede: Início e aba Jogos do painel)
  if (torcidometro) import('./torcidometro.js').then((m) => m.montarTorcidometro()).catch(() => {});
}

// Perfil em uso (torcedor, clube ou organizador): o app abre direto nele até a pessoa tocar em "Sair"
const CHAVE_MODO = 'modo_ativo';
export const DESTINO_DO_MODO = { torcedor: 'inicio.html', clube: 'clube.html', adm: 'admin.html' };
export const modoAtivo = () => { try { return localStorage.getItem(CHAVE_MODO) ?? ''; } catch { return ''; } };
export function definirModo(modo) {
  try { if (modo) localStorage.setItem(CHAVE_MODO, modo); else localStorage.removeItem(CHAVE_MODO); } catch { /* sem armazenamento */ }
}

// ---------- Selo "quem está logado" (topo) ----------
// tipo: 'torcedor' | 'clube' | 'adm' · rotulo: texto curto do selo · quem: frase do menu · time: escudo do clube
// voltar: { href, texto } quando a pessoa está numa página pública mas o perfil é clube ou organizador
const CHAVE_CLUBE_SELO = 'clube_selo';
// contar: entra na contagem de "online agora" (falso nas telas de entrada, antes do código/senha)
export function mostrarPerfil({ tipo, rotulo, quem, time = null, voltar = null, contar = true }) {
  const selo = document.getElementById('btn-perfil');
  if (!selo) return;
  // clube: escudo do clube · torcedor com time do coração: escudo do time dele
  const simbolo = time ? escudo(time, 32) : icone({ torcedor: 'torcedor', clube: 'escudo', adm: 'coroa' }[tipo]);
  selo.className = `perfil__selo perfil__selo--${tipo}`;
  selo.innerHTML = `${simbolo}<span>${escapar(rotulo)}</span>`;
  selo.setAttribute('aria-label', `${quem}. Abrir menu do perfil`);
  document.querySelector('.perfil__quem').innerHTML = `<small>Você está como</small><strong>${escapar(quem)}</strong>`;
  const link = document.querySelector('.perfil__voltar');
  link.classList.toggle('oculto', !voltar);
  if (voltar) { link.href = voltar.href; link.textContent = voltar.texto; }
  // o clube guarda nome e escudo para o selo aparecer certo também nas páginas públicas
  if (tipo === 'clube' && time) { try { localStorage.setItem(CHAVE_CLUBE_SELO, JSON.stringify({ id: time.id, nome: time.nome, sigla: time.sigla, escudo_url: time.escudo_url })); } catch { /* sem armazenamento */ } }
  if (contar) import('./presenca.js').then((m) => m.anunciar({ perfil: tipo, time })).catch(() => {});
  if (contar) import('./acessos.js').then((m) => m.registrarVisita({ perfil: tipo })).catch(() => {}); // acessos por dia (anônimo)
}

const rotuloDoClube = (time) => time?.sigla || (time?.nome?.length > 10 ? `${time.nome.slice(0, 9)}…` : time?.nome) || 'Clube';

// Página pública: selo pelo perfil ativo (um clube ou o organizador pode abrir um link do torcedor)
function perfilNasPaginasPublicas() {
  const modo = modoAtivo();
  if (modo === 'clube') {
    let time = null;
    try { time = JSON.parse(localStorage.getItem(CHAVE_CLUBE_SELO) ?? 'null'); } catch { /* sem armazenamento */ }
    mostrarPerfil({ tipo: 'clube', rotulo: rotuloDoClube(time), quem: time ? `Clube ${time.nome}` : 'Clube', time, voltar: { href: 'clube.html', texto: 'Voltar para a área do clube' } });
  } else if (modo === 'adm') {
    mostrarPerfil({ tipo: 'adm', rotulo: 'ADM', quem: 'Organizador (ADM)', voltar: { href: 'admin.html', texto: 'Voltar para o painel' } });
  } else {
    perfilDoTorcedor();
    document.addEventListener('meu-time-mudou', perfilDoTorcedor);
    declararNoBanco();                                // aparelho que já tinha time entra na contagem
    setTimeout(() => perguntarNaPrimeiraVez().catch(() => {}), 1200); // depois da tela carregar
  }
}

// Torcedor: o selo leva o escudo do time do coração; o menu mostra "Meu time" e as Configurações
function perfilDoTorcedor() {
  const time = meuTime();
  mostrarPerfil({ tipo: 'torcedor', rotulo: 'Torcedor', quem: time ? `Torcedor do ${time.nome}` : 'Torcedor', time });
  const extra = document.getElementById('perfil-extra');
  extra.innerHTML = `
    ${time ? `<div class="meu-time">${escudo(time, 32)}<span><small>Meu time</small><strong>${escapar(time.nome)}</strong></span></div>` : ''}
    <button class="botao botao--secundario" type="button" data-configurar>${icone('engrenagem')} Configurações</button>`;
  extra.querySelector('[data-configurar]').addEventListener('click', () => {
    document.getElementById('menu-perfil').hidden = true;
    import('./configTorcedor.js').then((m) => m.abrirConfiguracoes()).catch(() => {});
  });
}
export const perfilDoClube = (time) => mostrarPerfil({ tipo: 'clube', rotulo: rotuloDoClube(time), quem: `Clube ${time.nome}`, time });

function ligarMenuPerfil() {
  const selo = document.getElementById('btn-perfil');
  const menu = document.getElementById('menu-perfil');
  const abrir = (sim) => { menu.hidden = !sim; selo.setAttribute('aria-expanded', String(sim)); };
  selo.addEventListener('click', () => abrir(menu.hidden));
  document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('.perfil')) abrir(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { abrir(false); selo.focus(); } });
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

// Hora do jogo, ou "A definir" quando só a data está marcada (horario_definido = false)
export const horaDoJogo = (jogo) => (jogo.horario_definido === false ? 'A definir' : formatarHora(jogo.data_hora));

// Botão flutuante "Compartilhar": roda `aoClicar` mostrando o estado "Gerando imagem..."
export function botaoCompartilhar(aoClicar) {
  const botao = document.createElement('button');
  botao.className = 'botao botao-compartilhar';
  botao.innerHTML = icone('whatsapp');
  botao.setAttribute('aria-label', 'Compartilhar imagem');
  botao.title = 'Compartilhar';
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

// Troca o item ativo do menu sem redesenhar (painel do organizador, que navega por #aba)
export function marcarNav(id) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const ativo = a.dataset.nav === id;
    a.classList.toggle('nav__item--ativo', ativo);
    if (ativo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

// Identificador anônimo deste aparelho (um voto no craque por jogo, uma curtida por publicação)
export function aparelho() {
  try {
    let id = localStorage.getItem('aparelho_id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('aparelho_id', id); }
    return id;
  } catch { return crypto.randomUUID(); }
}
