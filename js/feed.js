// Feed do mural (estilo rede social): curtidas, comentários recolhidos, ampliar foto e compartilhar.
// Cada perfil vê o seu: torcedor só curte e comenta (com o nome dele); o clube (área do clube) publica e
// comenta como o time; o organizador (painel) publica e comenta como Organização e modera.
import {
  listarPosts, listarJogos, urlFoto, publicarPost, comentarPost, clubeComentar, comentarComoOrganizacao, curtirPost,
  apagarPost, apagarComentario, aprovarPost, clubeMeusPosts,
} from './api.js';
import { prepararFoto } from './imagem.js';
import { escapar, escudo, icone, toast, tempoRelativo, aparelho } from './ui.js';

const CHAVE_NOME = 'mural_nome';
const CHAVE_CURTIDAS = 'mural_curtidas';
const LIMITE = 500;
const guardado = (chave) => { try { return localStorage.getItem(chave) ?? ''; } catch { return ''; } };
const guardar = (chave, valor) => { try { localStorage.setItem(chave, valor); } catch { /* sem armazenamento */ } };
const esquecer = (chave) => { try { localStorage.removeItem(chave); } catch { /* sem armazenamento */ } };
const minhasCurtidas = () => { try { return new Set(JSON.parse(localStorage.getItem(CHAVE_CURTIDAS) ?? '[]')); } catch { return new Set(); } };

const traco = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONES = {
  foto: traco('<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8"/>'),
  bola: traco('<circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 4.5h-5L8 10z"/>'),
  comentario: traco('<path d="M4 5h16v11H9l-5 4z"/>'),
  coracao: traco('<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>'),
  compartilhar: traco('<path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/>'),
  fechar: traco('<path d="M6 6l12 12M18 6L6 18"/>'),
  lixeira: traco('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
};

function rotuloJogo(j) {
  const placar = j.status === 'encerrado' ? ` ${j.gols_mandante}×${j.gols_visitante} ` : ' × ';
  return `R${j.rodada?.numero ?? '?'} · ${j.mandante.nome}${placar}${j.visitante.nome}`;
}

// `organizador`: painel do organizador · `clube`: { codigo, time } da área do clube · sem nenhum: torcedor
export function criarFeed(container, { organizador = false, clube = null } = {}) {
  const perfil = organizador ? 'organizador' : clube ? 'clube' : 'torcedor';
  const estado = { posts: [], meusPendentes: [], jogos: [], filtro: 'tudo', abertos: new Set(), foto: null, curtidas: minhasCurtidas() };

  // ---------- Compositor (só clube e organizador publicam) ----------
  function htmlCompositor() {
    if (perfil === 'torcedor') {
      const nome = guardado(CHAVE_NOME);
      return nome ? `<p class="texto-2 texto-pequeno feed__quem">Você comenta como <strong>${escapar(nome)}</strong> · <button type="button" class="link-botao" data-trocar-nome>trocar nome</button></p>` : '';
    }
    const avatar = organizador ? `<span class="avatar-feed avatar-feed--org">${icone('coroa')}</span>` : `<span class="avatar-feed">${escudo(clube.time, 48)}</span>`;
    const nome = organizador ? 'Organização' : clube.time.nome;
    const jogos = [...estado.jogos].sort((a, b) => (b.rodada?.numero ?? 0) - (a.rodada?.numero ?? 0)).slice(0, 25)
      .map((j) => `<option value="${j.id}">${escapar(rotuloJogo(j))}</option>`).join('');
    return `
      <section class="card compositor" data-compositor>
        <div class="compositor__linha">
          ${avatar}
          <div class="compositor__campo">
            <span class="compositor__quem">${escapar(nome)}</span>
            <textarea data-texto rows="2" maxlength="${LIMITE}" placeholder="O que está rolando no campeonato?" aria-label="Escreva uma publicação"></textarea>
            <div class="compositor__previa oculto" data-previa><img alt="Prévia da foto"><button type="button" class="compositor__tirar" data-tirar-foto aria-label="Tirar foto">${ICONES.fechar}</button></div>
          </div>
        </div>
        <div class="compositor__barra">
          <label class="compositor__ferramenta" title="Adicionar foto">${ICONES.foto}<input type="file" accept="image/*" class="sr-only" data-arquivo><span class="sr-only">Adicionar foto</span></label>
          <label class="compositor__ferramenta compositor__jogo" title="Marcar jogo">${ICONES.bola}
            <select data-jogo aria-label="Marcar um jogo"><option value="">Jogo</option>${jogos}</select></label>
          <span class="compositor__contador" data-contador>${LIMITE}</span>
          <button class="botao" type="button" data-publicar disabled>Publicar</button>
        </div>
        ${organizador ? '' : '<p class="texto-2 texto-pequeno compositor__nota">Aparece para todos depois da aprovação do organizador.</p>'}
      </section>`;
  }

  function ligarCompositor() {
    const caixa = container.querySelector('[data-compositor]');
    if (!caixa) return;
    const texto = caixa.querySelector('[data-texto]');
    const publicar = caixa.querySelector('[data-publicar]');
    const contador = caixa.querySelector('[data-contador]');
    const atualizar = () => {
      texto.style.height = 'auto';
      texto.style.height = `${Math.min(texto.scrollHeight, 240)}px`;
      const resto = LIMITE - texto.value.length;
      contador.textContent = resto;
      contador.classList.toggle('compositor__contador--pouco', resto < 40);
      publicar.disabled = !texto.value.trim() && !estado.foto;
    };
    texto.addEventListener('input', atualizar);
    caixa.querySelector('[data-arquivo]').addEventListener('change', (e) => {
      estado.foto = e.target.files[0] ?? null;
      const previa = caixa.querySelector('[data-previa]');
      previa.classList.toggle('oculto', !estado.foto);
      if (estado.foto) previa.querySelector('img').src = URL.createObjectURL(estado.foto);
      atualizar();
    });
    caixa.querySelector('[data-tirar-foto]').addEventListener('click', () => {
      estado.foto = null;
      caixa.querySelector('[data-arquivo]').value = '';
      caixa.querySelector('[data-previa]').classList.add('oculto');
      atualizar();
    });
    publicar.addEventListener('click', async () => {
      publicar.disabled = true;
      try {
        toast(estado.foto ? 'Enviando foto...' : 'Publicando...');
        const foto = estado.foto ? await prepararFoto(estado.foto) : null;
        const jogo = caixa.querySelector('[data-jogo]').value;
        await publicarPost({ codigo: clube?.codigo, descricao: texto.value, foto, jogoId: jogo ? Number(jogo) : null });
        texto.value = '';
        estado.foto = null;
        toast(organizador ? 'Publicado ✔' : 'Enviado! Aparece no mural depois da aprovação do organizador.');
        await carregar();
      } catch (erro) {
        toast(erro.message, true);
        publicar.disabled = false;
      }
    });
    atualizar();
  }

  // ---------- Publicações ----------
  function htmlAutorComentario(c) {
    if (c.oficial) return `<strong class="comentario__autor comentario__autor--org">Organização <i class="comentario__selo">oficial</i></strong>`;
    if (c.time_id) return `<strong class="comentario__autor comentario__autor--time">${escapar(c.nome)} <i class="comentario__selo comentario__selo--time">time</i></strong>`;
    return `<strong class="comentario__autor">${escapar(c.nome)}</strong>`;
  }
  function htmlAvatarComentario(c) {
    if (c.oficial) return `<span class="avatar-feed avatar-feed--org avatar-feed--mini">${icone('coroa')}</span>`;
    if (c.time_id) return `<span class="avatar-feed avatar-feed--mini">${escudo({ escudo_url: c.time?.escudo_url, nome: c.nome }, 32)}</span>`;
    return `<span class="avatar-feed avatar-feed--mini avatar-feed--letra" aria-hidden="true">${escapar((c.nome ?? '?').trim().slice(0, 1).toUpperCase())}</span>`;
  }

  function htmlComentarios(p) {
    const todos = [...(p.comentarios ?? [])].sort((a, b) => a.criado_em.localeCompare(b.criado_em));
    const aberto = estado.abertos.has(p.id);
    const lista = aberto ? todos : todos.slice(-2);
    const nome = guardado(CHAVE_NOME);
    const quem = organizador ? 'Organização' : clube ? clube.time.nome : nome;
    const pedirNome = perfil === 'torcedor' && !nome;
    return `
      <section class="post__comentarios" aria-label="Comentários">
        ${todos.length > 2 && !aberto ? `<button class="link-botao post__ver-todos" data-ver-todos="${p.id}">Ver os ${todos.length} comentários</button>` : ''}
        ${lista.map((c) => `
          <div class="comentario">
            ${htmlAvatarComentario(c)}
            <div class="comentario__corpo">
              <div class="comentario__balao">${htmlAutorComentario(c)}<p>${escapar(c.texto)}</p></div>
              <small>${tempoRelativo(c.criado_em)}</small>
            </div>
            ${organizador ? `<button class="comentario__apagar" data-apagar-comentario="${c.id}" aria-label="Apagar comentário">${ICONES.lixeira}</button>` : ''}
          </div>`).join('')}
        <form class="post__comentar" data-post="${p.id}">
          ${pedirNome ? '<input name="nome" maxlength="30" placeholder="Seu nome" required autocomplete="nickname" aria-label="Seu nome">' : ''}
          <input name="texto" maxlength="300" placeholder="${quem ? `Comente como ${escapar(quem)}` : 'Escreva um comentário'}" required autocomplete="off" aria-label="Comentário">
          <button class="post__enviar" type="submit" aria-label="Enviar comentário">➤</button>
        </form>
      </section>`;
  }

  function htmlPost(p, pendente = false) {
    const avatar = p.time ? `<span class="avatar-feed">${escudo(p.time, 48)}</span>` : `<span class="avatar-feed avatar-feed--org">${icone('coroa')}</span>`;
    const qtd = (p.comentarios ?? []).length;
    const curti = estado.curtidas.has(p.id);
    const moderar = pendente && organizador;
    return `
      <article class="card post${pendente ? ' post--pendente' : ''}${p.foto_path ? '' : ' post--texto'}" id="post-${p.id}" data-post="${p.id}">
        <header class="post__topo">
          ${avatar}
          <div class="post__autor"><strong>${escapar(p.autor)}</strong>
            <span class="texto-2 texto-pequeno">${p.time ? '' : '<span class="post__oficial">Oficial</span> · '}${tempoRelativo(p.criado_em)}${pendente ? ' · aguardando aprovação' : ''}</span></div>
          ${organizador && !pendente ? `<button class="post__menu" data-apagar-post="${p.id}" aria-label="Apagar publicação" title="Apagar">${ICONES.lixeira}</button>` : ''}
        </header>
        ${p.descricao ? `<p class="post__descricao${!p.foto_path && p.descricao.length < 120 ? ' post__descricao--destaque' : ''}">${escapar(p.descricao)}</p>` : ''}
        ${p.foto_path ? `<button class="post__midia" data-ampliar="${escapar(urlFoto(p.foto_path))}" aria-label="Ampliar foto">
          <img class="post__foto" src="${escapar(urlFoto(p.foto_path))}" loading="lazy" alt="Foto publicada por ${escapar(p.autor)}"></button>` : ''}
        ${p.jogo ? `<span class="post__jogo">${ICONES.bola} ${escapar(rotuloJogo(p.jogo))}</span>` : ''}
        ${moderar ? `
          <div class="post__moderar">
            <button class="botao botao--perigo" data-apagar-post="${p.id}">Recusar</button>
            <button class="botao" data-aprovar="${p.id}">Aprovar e publicar</button>
          </div>` : pendente ? '' : `
          <footer class="post__acoes">
            <button class="post__acao post__curtir${curti ? ' post__curtir--ativo' : ''}" data-curtir="${p.id}" aria-pressed="${curti}" aria-label="${curti ? 'Descurtir' : 'Curtir'}">${ICONES.coracao}<b class="post__rotulo">Curtir</b><span>${p.curtidas || ''}</span></button>
            <button class="post__acao" data-ver-todos="${p.id}" aria-label="Comentários">${ICONES.comentario}<b class="post__rotulo">Comentar</b><span>${qtd || ''}</span></button>
            <button class="post__acao post__acao--icone" data-compartilhar-post="${p.id}" aria-label="Compartilhar publicação">${ICONES.compartilhar}</button>
          </footer>
          ${htmlComentarios(p)}`}
      </article>`;
  }

  function desenhar() {
    const rascunho = capturar();
    const visiveis = estado.posts.filter((p) => p.aprovado !== false)
      .filter((p) => estado.filtro === 'tudo' || (estado.filtro === 'fotos' ? p.foto_path : !p.foto_path));
    // organizador: fila de aprovação · clube: as publicações dele que ainda esperam o organizador
    const pendentes = organizador ? estado.posts.filter((p) => p.aprovado === false) : estado.meusPendentes;
    const filtros = [['tudo', 'Tudo'], ['fotos', 'Fotos'], ['textos', 'Textos']];
    container.innerHTML = `
      ${htmlCompositor()}
      ${pendentes.length ? `<section class="fila-aprovacao"><h3>${organizador ? 'Aguardando aprovação' : 'Em análise pelo organizador'} · ${pendentes.length}</h3>${pendentes.map((p) => htmlPost(p, true)).join('')}</section>` : ''}
      <div class="segmentos feed__filtros" role="tablist">${filtros.map(([id, rotulo]) =>
        `<button class="segmento${estado.filtro === id ? ' segmento--ativo' : ''}" data-filtro="${id}">${rotulo}</button>`).join('')}</div>
      <div class="feed">${visiveis.map((p) => htmlPost(p)).join('') || `<p class="vazio">${estado.filtro === 'tudo' ? 'Nenhuma publicação ainda. ⚽' : 'Nada por aqui ainda.'}</p>`}</div>`;
    ligarCompositor();
    restaurar(rascunho);
  }

  // O tempo real recarrega o feed: preserva o que estava sendo digitado (publicação e comentários)
  function capturar() {
    const comentarios = {};
    container.querySelectorAll('.post__comentar').forEach((f) => { comentarios[f.dataset.post] = f.elements.texto.value; });
    const ativo = document.activeElement;
    return {
      texto: container.querySelector('[data-texto]')?.value ?? '',
      jogo: container.querySelector('[data-jogo]')?.value ?? '',
      comentarios,
      foco: ativo?.closest?.('.post__comentar')?.dataset.post ?? (ativo?.matches?.('[data-texto]') ? 'compositor' : null),
    };
  }
  function restaurar({ texto, jogo, comentarios, foco }) {
    const campo = container.querySelector('[data-texto]');
    if (campo && texto) { campo.value = texto; campo.dispatchEvent(new Event('input')); }
    if (estado.foto) {
      const previa = container.querySelector('[data-previa]');
      if (previa) { previa.classList.remove('oculto'); previa.querySelector('img').src = URL.createObjectURL(estado.foto); campo?.dispatchEvent(new Event('input')); }
    }
    const seletor = container.querySelector('[data-jogo]');
    if (seletor && jogo) seletor.value = jogo;
    for (const [id, valor] of Object.entries(comentarios)) {
      const c = container.querySelector(`.post__comentar[data-post="${id}"] [name="texto"]`);
      if (c && valor) c.value = valor;
    }
    if (foco === 'compositor') campo?.focus();
    else if (foco) container.querySelector(`.post__comentar[data-post="${foco}"] [name="texto"]`)?.focus();
  }

  async function carregar() {
    try {
      const [posts, jogos, meus] = await Promise.all([
        listarPosts(), perfil === 'torcedor' ? [] : listarJogos(), clube ? clubeMeusPosts(clube.codigo) : [],
      ]);
      estado.posts = posts;
      estado.jogos = jogos;
      // os pendentes do clube vêm da função do clube (a leitura pública só mostra os aprovados)
      estado.meusPendentes = meus.filter((p) => p.aprovado === false).map((p) => ({ ...p, time: clube.time, comentarios: [] }));
      desenhar();
    } catch (erro) {
      if (erro.codigoInvalido) throw erro; // a área do clube trata (volta para a entrada)
      container.innerHTML = `<p class="aviso">Não foi possível carregar o mural: ${escapar(erro.message)}</p>`;
    }
  }

  function ampliar(src) {
    document.querySelector('dialog.foto-cheia')?.remove();
    const d = Object.assign(document.createElement('dialog'), { className: 'foto-cheia' });
    d.innerHTML = `<img src="${escapar(src)}" alt="Foto ampliada"><button class="foto-cheia__fechar" aria-label="Fechar">${ICONES.fechar}</button>`;
    d.addEventListener('click', () => d.close());
    d.addEventListener('close', () => d.remove());
    document.body.append(d);
    d.showModal();
  }

  async function compartilhar(post) {
    const url = `${new URL('mural.html', location.href).href}#post-${post.id}`;
    const texto = `${post.autor} no mural do Campeonato SRP${post.descricao ? `: "${post.descricao.slice(0, 100)}"` : ''}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Mural · Campeonato SRP', text: texto, url });
      else { await navigator.clipboard.writeText(`${texto}\n${url}`); toast('Link copiado ✔'); }
    } catch (erro) { if (erro.name !== 'AbortError') toast('Não foi possível compartilhar.', true); }
  }

  // Curtida aparece na hora; se o banco recusar, volta como estava
  async function curtir(botao, id) {
    const post = estado.posts.find((p) => p.id === id);
    const curtir = !estado.curtidas.has(id);
    const anterior = post.curtidas ?? 0;
    const pintar = (ativo, total) => {
      if (ativo) estado.curtidas.add(id); else estado.curtidas.delete(id);
      post.curtidas = total;
      guardar(CHAVE_CURTIDAS, JSON.stringify([...estado.curtidas].slice(-500)));
      botao.classList.toggle('post__curtir--ativo', ativo);
      botao.classList.toggle('post__curtir--pop', ativo && total > anterior); // animação só no toque, não ao redesenhar
      botao.setAttribute('aria-pressed', String(ativo));
      botao.setAttribute('aria-label', ativo ? 'Descurtir' : 'Curtir');
      botao.querySelector('span').textContent = total || '';
    };
    pintar(curtir, Math.max(0, anterior + (curtir ? 1 : -1)));
    try {
      pintar(curtir, await curtirPost(id, aparelho(), curtir));
    } catch (erro) {
      pintar(!curtir, anterior);
      throw erro;
    }
  }

  async function comentar(form) {
    const postId = Number(form.dataset.post);
    const texto = form.elements.texto.value.trim();
    if (organizador) await comentarComoOrganizacao(postId, texto);
    else if (clube) await clubeComentar(clube.codigo, postId, texto);
    else {
      const nome = (form.elements.nome?.value ?? guardado(CHAVE_NOME)).trim();
      await comentarPost(postId, nome, texto);
      guardar(CHAVE_NOME, nome);
    }
    form.elements.texto.value = '';
    estado.abertos.add(postId);
    await carregar();
  }

  // ---------- Eventos (um só ouvinte para tudo) ----------
  container.addEventListener('click', async (e) => {
    const alvo = e.target.closest('button');
    if (!alvo) return;
    try {
      if (alvo.dataset.filtro) { estado.filtro = alvo.dataset.filtro; desenhar(); }
      else if (alvo.dataset.ampliar) ampliar(alvo.dataset.ampliar);
      else if (alvo.dataset.curtir) await curtir(alvo, Number(alvo.dataset.curtir));
      else if (alvo.dataset.verTodos) {
        const id = Number(alvo.dataset.verTodos);
        if (estado.abertos.has(id) && alvo.classList.contains('post__acao')) estado.abertos.delete(id); else estado.abertos.add(id);
        desenhar();
        if (estado.abertos.has(id)) container.querySelector(`.post__comentar[data-post="${id}"] [name="texto"]`)?.focus();
      } else if (alvo.dataset.compartilharPost) compartilhar(estado.posts.find((p) => p.id === Number(alvo.dataset.compartilharPost)));
      else if (alvo.hasAttribute('data-trocar-nome')) { esquecer(CHAVE_NOME); desenhar(); }
      else if (alvo.dataset.aprovar && organizador) { await aprovarPost(Number(alvo.dataset.aprovar)); toast('Publicação aprovada ✔'); await carregar(); }
      else if (alvo.dataset.apagarPost && organizador) {
        if (!confirm('Apagar esta publicação e os comentários dela?')) return;
        await apagarPost(estado.posts.find((p) => p.id === Number(alvo.dataset.apagarPost)));
        toast('Publicação apagada');
        await carregar();
      } else if (alvo.dataset.apagarComentario && organizador) {
        if (!confirm('Apagar este comentário?')) return;
        await apagarComentario(Number(alvo.dataset.apagarComentario));
        await carregar();
      }
    } catch (erro) { toast(erro.message, true); }
  });

  container.addEventListener('submit', async (e) => {
    const form = e.target.closest('.post__comentar');
    if (!form) return;
    e.preventDefault();
    const enviar = form.querySelector('[type=submit]');
    enviar.disabled = true;
    try { await comentar(form); } catch (erro) { toast(erro.message, true); enviar.disabled = false; }
  });

  return { carregar };
}
