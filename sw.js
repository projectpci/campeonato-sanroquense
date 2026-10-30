// Service worker: abre rápido e mostra a última tabela conhecida quando o celular está sem sinal.
// Suba VERSAO a cada deploy: o código (html, js, css) fica guardado por versão e só muda quando ela sobe.
const VERSAO = 'v44';
const CACHE = `sanroquense-${VERSAO}`;
// Fotos do mural e do elenco (Storage): cache à parte, com limite, para não encher o celular
const CACHE_IMAGENS = 'sanroquense-imagens';
const LIMITE_IMAGENS = 150;

const NUCLEO = [
  './', 'index.html', 'inicio.html', 'confrontos.html', 'classificacao.html', 'artilharia.html', 'admin.html', 'time.html', 'instalar.html', 'clube.html', 'elenco.html',
  'css/tokens.css', 'css/base.css', 'css/componentes.css', 'css/compartilhar.css',
  'mural.html', 'cadastro-elenco.html', 'assets/escudo-padrao.svg', 'manifest.webmanifest', 'assets/compartilhar.jpg',
  // todos os módulos: a versão nova chega inteira de uma vez (nunca mistura arquivo novo com velho)
  ...['api', 'artes', 'avisos', 'cache', 'cartaoJogo', 'classificacao', 'compartilhar', 'compartilharJogo', 'config',
    'configTorcedor', 'elencoTime', 'escalacao', 'feed', 'golsDoJogo', 'imagem', 'importacaoElenco', 'importarElenco', 'jogoExtras', 'meuTime', 'presenca', 'probabilidade',
    'pwa', 'rankings', 'realtime', 'resgate', 'rodadas', 'sumula', 'supabase', 'tabelas', 'torcidaOnline', 'torcidometro', 'ui'].map((m) => `js/${m}.js`),
  ...['admin', 'artilharia', 'cadastroElenco', 'classificacao', 'clube', 'confrontos', 'elenco', 'entrada', 'inicio', 'instalar', 'mural', 'time']
    .map((p) => `js/paginas/${p}.js`),
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    // cache: 'reload' busca no servidor (não na cópia do navegador): a versão nova nunca nasce com arquivo velho
    caches.open(CACHE).then((cache) => Promise.all(NUCLEO.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE && c !== CACHE_IMAGENS).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

// Dados (REST do Supabase): rede primeiro, cache como reserva. Código do site: o da versão guardada.
// Imagens, fontes e bibliotecas: cache primeiro.
self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.pathname.includes('/auth/') || url.pathname.includes('/realtime/')) return;

  const ehDados = url.hostname.endsWith('.supabase.co') && url.pathname.includes('/rest/');
  const ehCodigo = url.origin === location.origin && /(\.(html|js|css|webmanifest)|\/)$/.test(url.pathname);
  const ehFoto = url.hostname.endsWith('.supabase.co') && url.pathname.includes('/storage/');
  if (ehDados) evento.respondWith(redePrimeiro(request));
  else if (ehCodigo) evento.respondWith(codigoDaVersao(request, url));
  else evento.respondWith(cachePrimeiro(request, ehFoto ? CACHE_IMAGENS : CACHE));
});

// Código: sai direto do cache desta versão, sem perguntar ao servidor arquivo por arquivo
// (antes cada página esperava ~7 idas e voltas em cascata, uma por nível de import: era a lentidão ao navegar).
// O que não estiver guardado vem da rede e fica guardado nesta versão.
async function codigoDaVersao(request, url) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(request, { ignoreSearch: true });
  if (guardada && !guardada.redirected) return guardada;
  const resposta = await fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' });
  if (resposta.status === 200 && !resposta.redirected) cache.put(url.origin + url.pathname, resposta.clone());
  return resposta;
}

async function redePrimeiro(request) {
  const cache = await caches.open(CACHE);
  // Sinal fraco: se a rede não responde em 4 s e há cópia guardada, usa a cópia
  const limite = new Promise((resolve) => setTimeout(() => resolve(null), 4000));
  try {
    const rede = fetch(request).then((resposta) => {
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

async function cachePrimeiro(request, nomeCache = CACHE) {
  const cache = await caches.open(nomeCache);
  const guardada = await cache.match(request);
  const atualizar = fetch(request)
    .then((resposta) => {
      if (resposta.status === 200 || resposta.type === 'opaque') {
        cache.put(request, resposta.clone()).then(() => { if (nomeCache === CACHE_IMAGENS) aparar(cache); });
      }
      return resposta;
    })
    .catch(() => guardada);
  return guardada ?? atualizar;
}

// Mantém só as fotos mais recentes (as mais antigas saem primeiro)
async function aparar(cache) {
  const chaves = await cache.keys();
  await Promise.all(chaves.slice(0, Math.max(0, chaves.length - LIMITE_IMAGENS)).map((k) => cache.delete(k)));
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
