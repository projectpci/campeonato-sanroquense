// Quem está online agora (Supabase Realtime Presence): cada aparelho com o app aberto entra no canal
// "online" dizendo o perfil (torcedor, clube ou ADM). Não grava nada no banco e não guarda histórico.
// Torcedor entra só como número; o clube, pelo nome do time (está logado com o código).
// App em segundo plano sai da contagem e volta ao abrir de novo (economiza bateria e conexão).
import { supabase } from './supabase.js';
import { aparelho } from './ui.js';

let canal = null;
let meu = null;       // { perfil, time_id?, time?, escudo_url? }
let conectado = false;
const ouvintes = new Set();

// Resumo do canal: um aparelho conta uma vez (várias abas abertas = mesma chave)
// torcida: { [time_id]: torcedores online com esse time do coração }
function resumo() {
  const r = { total: 0, torcedores: 0, adm: 0, clubes: [], torcida: {} };
  const clubes = new Map();
  for (const metas of Object.values(canal.presenceState())) {
    const m = metas[metas.length - 1];
    r.total++;
    if (m.perfil === 'adm') r.adm++;
    else if (m.perfil === 'clube' && m.time_id) {
      const c = clubes.get(m.time_id) ?? { time_id: m.time_id, nome: m.time, escudo_url: m.escudo_url, aparelhos: 0 };
      c.aparelhos++;
      clubes.set(m.time_id, c);
    } else {
      r.torcedores++;
      if (m.torce) r.torcida[m.torce] = (r.torcida[m.torce] ?? 0) + 1;
    }
  }
  r.clubes = [...clubes.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  return r;
}

// Pico do dia: o aparelho que vê um número maior que o já informado hoje avisa o banco (no máximo 1 vez a cada 30 s)
const CHAVE_PICO = 'pico_informado';
const INTERVALO_PICO = 30000;
let ultimoEnvio = 0;
let maiorVisto = 0;     // maior número visto desde o último envio
let agendado = null;
const hojeNaBahia = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bahia' });
function jaInformado() {
  try { const i = JSON.parse(localStorage.getItem(CHAVE_PICO) ?? '{}'); return i.dia === hojeNaBahia() ? i.pico : 0; } catch { return 0; }
}
function enviarPico() {
  agendado = null;
  const total = maiorVisto;
  maiorVisto = 0; // não carrega o número de um dia para o outro
  if (total < 1 || total <= jaInformado()) return;
  ultimoEnvio = Date.now();
  import('./api.js').then((api) => api.registrarPicoOnline(total)).then(() => {
    try { localStorage.setItem(CHAVE_PICO, JSON.stringify({ dia: hojeNaBahia(), pico: total })); } catch { /* sem armazenamento */ }
  }).catch(() => {});
}
function informarPico(total) {
  if (total < 1 || total <= jaInformado()) return;
  maiorVisto = Math.max(maiorVisto, total);
  if (agendado) return; // já vai enviar o maior número no fim do intervalo
  agendado = setTimeout(enviarPico, Math.max(0, ultimoEnvio + INTERVALO_PICO - Date.now()));
}

const avisar = () => { const r = resumo(); ouvintes.forEach((f) => f(r)); if (meu) informarPico(r.total); };
const entrar = () => { if (conectado && meu && !document.hidden) canal.track(meu).catch(() => {}); };

function conectar() {
  if (canal || !supabase) return;
  canal = supabase.channel('online', { config: { presence: { key: aparelho() } } });
  canal.on('presence', { event: 'sync' }, avisar);
  canal.subscribe((status) => {
    conectado = status === 'SUBSCRIBED';
    if (conectado) { entrar(); avisar(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (!conectado) return;
    if (document.hidden) canal.untrack().catch(() => {}); else entrar();
  });
}

// Chamado pelo selo do perfil (ui.js): diz ao canal quem é este aparelho
export function anunciar({ perfil, time = null }) {
  if (perfil === 'clube' && time?.id) meu = { perfil, time_id: time.id, time: time.nome, escudo_url: time.escudo_url ?? null };
  else if (perfil === 'torcedor' && time?.id) meu = { perfil, torce: time.id }; // time do coração
  else meu = { perfil };
  conectar();
  entrar();
}

// Recebe o resumo sempre que alguém entra ou sai; devolve a função para parar de ouvir.
// Atenção: o servidor só manda a lista para quem também se anunciou (anunciar) — as telas que mostram a contagem já anunciam.
export function aoMudarOnline(funcao) {
  ouvintes.add(funcao);
  conectar();
  if (conectado) funcao(resumo());
  return () => ouvintes.delete(funcao);
}
