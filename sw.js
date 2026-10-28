// Service worker: abre rápido e mostra a última tabela conhecida quando o celular está sem sinal.
// Suba VERSAO a cada deploy para limpar o cache antigo.
const VERSAO = 'v1';
const CACHE = `sanroquense-${VERSAO}`;

const NUCLEO = [
  './', 'index.html', 'inicio.html', 'confrontos.html', 'classificacao.html', 'artilharia.html', 'admin.html',
  'css/tokens.css', 'css/base.css', 'css/componentes.css', 'css/compartilhar.css',
  'mural.html', 'assets/escudo-padrao.svg', 'manifest.webmanifest',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((cache) => Promise.all(NUCLEO.map((url) => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

// Dados (REST do Supabase): rede primeiro, cache como reserva. Resto: usa o cache e atualiza ao fundo.
self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.pathname.includes('/auth/') || url.pathname.includes('/realtime/')) return;

  const ehDados = url.hostname.endsWith('.supabase.co') && url.pathname.includes('/rest/');
  evento.respondWith(ehDados ? redePrimeiro(request) : cachePrimeiro(request));
});

async function redePrimeiro(request) {
  const cache = await caches.open(CACHE);
  try {
    const resposta = await fetch(request);
    if (resposta.status === 200) cache.put(request, resposta.clone());
    return resposta;
  } catch (erro) {
    const guardada = await cache.match(request);
    if (guardada) return guardada;
    throw erro;
  }
}

async function cachePrimeiro(request) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(request);
  const atualizar = fetch(request)
    .then((resposta) => {
      if (resposta.status === 200 || resposta.type === 'opaque') cache.put(request, resposta.clone());
      return resposta;
    })
    .catch(() => guardada);
  return guardada ?? atualizar;
}
