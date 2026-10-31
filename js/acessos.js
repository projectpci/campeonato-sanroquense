// Contagem anônima de acessos e instalações: cada aparelho avisa o banco no máximo 1 vez por dia (e de novo se virar
// clube/organizador ou se for instalado). Só o identificador anônimo do aparelho é enviado: sem nome, sem telefone.
// O organizador vê o resumo em Ajustes → Acessos e instalações (js/painelAcessos.js).
import { registrarAcesso } from './api.js';
import { aparelho } from './ui.js';

const CHAVE = 'acesso_registrado';
const emDesenvolvimento = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && !location.search.includes('acesso');

const hojeNaBahia = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bahia' });
// Aberto pelo ícone da tela inicial (app instalado) e não pelo navegador
export const abertoInstalado = () => Boolean(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true);
const plataforma = () => (/iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : /Android/i.test(navigator.userAgent) ? 'android' : 'outro');

const lido = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) ?? {}; } catch { return {}; } };

export function registrarVisita({ perfil = 'torcedor', instalado = abertoInstalado() } = {}) {
  if (emDesenvolvimento) return;
  const estado = { dia: hojeNaBahia(), perfil, instalado };
  const antes = lido();
  if (antes.dia === estado.dia && antes.perfil === estado.perfil && antes.instalado === estado.instalado) return; // já avisou hoje
  registrarAcesso({ aparelho: aparelho(), perfil, instalado, plataforma: plataforma() })
    .then(() => { try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch { /* sem armazenamento */ } })
    .catch(() => {}); // sem conexão: tenta de novo na próxima página
}

// O navegador avisa quando o app é instalado (Android/Chrome); no iPhone vale a primeira abertura pelo ícone
window.addEventListener('appinstalled', () => registrarVisita({ perfil: lido().perfil ?? 'torcedor', instalado: true }));
