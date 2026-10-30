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
function resumo() {
  const r = { total: 0, torcedores: 0, adm: 0, clubes: [] };
  const clubes = new Map();
  for (const metas of Object.values(canal.presenceState())) {
    const m = metas[metas.length - 1];
    r.total++;
    if (m.perfil === 'adm') r.adm++;
    else if (m.perfil === 'clube' && m.time_id) {
      const c = clubes.get(m.time_id) ?? { time_id: m.time_id, nome: m.time, escudo_url: m.escudo_url, aparelhos: 0 };
      c.aparelhos++;
      clubes.set(m.time_id, c);
    } else r.torcedores++;
  }
  r.clubes = [...clubes.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  return r;
}

const avisar = () => { const r = resumo(); ouvintes.forEach((f) => f(r)); };
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
  meu = perfil === 'clube' && time?.id
    ? { perfil, time_id: time.id, time: time.nome, escudo_url: time.escudo_url ?? null }
    : { perfil };
  conectar();
  entrar();
}

// Recebe o resumo sempre que alguém entra ou sai; devolve a função para parar de ouvir
export function aoMudarOnline(funcao) {
  ouvintes.add(funcao);
  conectar();
  if (conectado) funcao(resumo());
  return () => ouvintes.delete(funcao);
}
