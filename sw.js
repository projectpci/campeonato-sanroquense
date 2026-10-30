// Service worker: abre rápido e mostra a última tabela conhecida quando o celular está sem sinal.
// Suba VERSAO a cada deploy para limpar o cache antigo.
const VERSAO = 'v18';
const CACHE = `sanroquense-${VERSAO}`;

const NUCLEO = [
  './', 'index.html', 'inicio.html', 'confrontos.html', 'classificacao.html', 'artilharia.html', 'admin.html', 'time.html', 'instalar.html', 'clube.html',
  'css/tokens.css', 'css/base.css', 'css/componentes.css', 'css/compartilhar.css',
  'mural.html', 'assets/escudo-padrao.svg', 'manifest.webmanifest', 'assets/compartilhar.jpg',
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

// Dados (REST do Supabase) e código do site: rede primeiro, cache como reserva. Imagens, fontes e bibliotecas: cache primeiro.
self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.pathname.includes('/auth/') || url.pathname.includes('/realtime/')) return;

  // Dados e o código do próprio site: rede primeiro (sempre a versão nova); imagens, fontes e bibliotecas: cache primeiro
  const ehDados = url.hostname.endsWith('.supabase.co') && url.pathname.includes('/rest/');
  const ehCodigo = url.origin === location.origin && /(\.(html|js|css|webmanifest)|\/)$/.test(url.pathname);
  evento.respondWith(ehDados || ehCodigo ? redePrimeiro(request, ehCodigo) : cachePrimeiro(request));
});

// `revalidar`: o GitHub Pages deixa o navegador guardar os arquivos por 10 min; aqui sempre pergunta se mudou (304 é barato)
async function redePrimeiro(request, revalidar = false) {
  const cache = await caches.open(CACHE);
  // Sinal fraco: se a rede não responde em 4 s e há cópia guardada, usa a cópia
  const limite = new Promise((resolve) => setTimeout(() => resolve(null), 4000));
  try {
    const rede = fetch(revalidar ? new Request(request, { cache: 'no-cache' }) : request).then((resposta) => {
      if (resposta.status === 200) cache.put(request, resposta.clone());
      return resposta;
    });
    const resposta = await Promise.race([rede, limite.then(async () => (await cache.match(request)) ?? rede)]);
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

// Avisos (Web Push): mostra a notificação e, ao tocar, abre o app
self.addEventListener('push', (evento) => {
  let d = {};
  try { d = evento.data.json(); } catch { /* sem conteúdo */ }
  evento.waitUntil(self.registration.showNotification(d.titulo || 'Campeonato SRP', {
    body: d.corpo || '', icon: 'assets/icones/icone-192.png', badge: 'assets/icones/icone-192.png',
    tag: d.tag, renotify: true, data: { url: d.url || 'inicio.html' },
  }));
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const alvo = new URL(evento.notification.data?.url || 'inicio.html', self.registration.scope).href;
  evento.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
    const aberta = janelas.find((j) => j.url.startsWith(self.registration.scope));
    return aberta ? aberta.focus().then((j) => j.navigate(alvo)) : self.clients.openWindow(alvo);
  }));
});
