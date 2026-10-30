// Feed do mural (estilo rede social): compositor de texto e/ou foto, filtros, publicações com comentários
// recolhidos, ampliar foto e compartilhar. Usado no Mural (torcedor/time) e no painel do organizador (moderação).
import {
  listarPosts, listarJogos, urlFoto, validarCodigo, publicarPost, comentarPost, apagarPost, apagarComentario, aprovarPost,
} from './api.js';
import { prepararFoto } from './imagem.js';
import { escapar, escudo, icone, toast, tempoRelativo } from './ui.js';

const CHAVE_CODIGO = 'mural_codigo';
const CHAVE_NOME = 'mural_nome';
const LIMITE = 500;
const guardado = (chave) => { try { return localStorage.getItem(chave) ?? ''; } catch { return ''; } };
const guardar = (chave, valor) => { try { localStorage.setItem(chave, valor); } catch { /* sem armazenamento */ } };
const esquecer = (chave) => { try { localStorage.removeItem(chave); } catch { /* sem armazenamento */ } };

const traco = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONES = {
  foto: traco('<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8"/>'),
  bola: traco('<circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 4.5h-5L8 10z"/>'),
  comentario: traco('<path d="M4 5h16v11H9l-5 4z"/>'),
  compartilhar: traco('<path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/>'),
  fechar: traco('<path d="M6 6l12 12M18 6L6 18"/>'),
  lixeira: traco('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
};

function rotuloJogo(j) {
  const placar = j.status === 'encerrado' ? ` ${j.gols_mandante}×${j.gols_visitante} ` : ' × ';
  return `R${j.rodada?.numero ?? '?'} · ${j.mandante.nome}${placar}${j.visitante.nome}`;
}

// `organizador`: publica como Organização, vê a fila de aprovação e pode apagar
export function criarFeed(container, { organizador = false } = {}) {
  const estado = {
    posts: [], jogos: [], time: null, filtro: 'tudo', abertos: new Set(), foto: null, carregou: false,
  };

  async function identificar() {
    estado.time = null;
    const codigo = guardado(CHAVE_CODIGO);
    if (codigo && !organizador) {
      estado.time = await validarCodigo(codigo).catch(() => null);
      if (!estado.time) esquecer(CHAVE_CODIGO); // código trocado pelo organizador
    }
  }

  // ---------- Compositor ----------
  function htmlCompositor() {
    if (!organizador && !estado.time) {
      return `
        <section class="card compositor compositor--entrar">
          <p><strong>Seu time quer postar?</strong> Digite o código do clube (o mesmo da Área do clube).</p>
          <form class="compositor__codigo" data-form-codigo>
            <input name="codigo" required maxlength="12" placeholder="Código do time" autocapitalize="characters" autocomplete="off" aria-label="Código do time">
            <button class="botao" type="submit">Entrar</button>
          </form>
          <p class="texto-2 texto-pequeno">Torcedor: comente nas publicações abaixo. 💬</p>
        </section>`;
    }
    const avatar = organizador ? `<span class="avatar-feed avatar-feed--org">${icone('coroa')}</span>` : `<span class="avatar-feed">${escudo(estado.time, 48)}</span>`;
    const nome = organizador ? 'Organização' : estado.time.nome;
    const jogos = [...estado.jogos].sort((a, b) => (b.rodada?.numero ?? 0) - (a.rodada?.numero ?? 0)).slice(0, 25)
      .map((j) => `<option value="${j.id}">${escapar(rotuloJogo(j))}</option>`).join('');
    return `
      <section class="card compositor" data-compositor>
        <div class="compositor__linha">
          ${avatar}
          <div class="compositor__campo">
            <span class="compositor__quem">${escapar(nome)}${organizador ? '' : ' · <button type="button" class="link-botao" data-trocar-codigo>trocar</button>'}</span>
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
        await publicarPost({ codigo: organizador ? undefined : guardado(CHAVE_CODIGO), descricao: texto.value, foto, jogoId: jogo ? Number(jogo) : null });
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
  function htmlComentarios(p) {
    const todos = [...(p.comentarios ?? [])].sort((a, b) => a.criado_em.localeCompare(b.criado_em));
    const aberto = estado.abertos.has(p.id);
    const lista = aberto ? todos : todos.slice(-2);
    const nome = guardado(CHAVE_NOME);
    return `
      <section class="post__comentarios" aria-label="Comentários">
        ${todos.length > 2 && !aberto ? `<button class="link-botao post__ver-todos" data-ver-todos="${p.id}">Ver os ${todos.length} comentários</button>` : ''}
        ${lista.map((c) => `
          <p class="comentario"><span><strong>${escapar(c.nome)}</strong> ${escapar(c.texto)}<small>${tempoRelativo(c.criado_em)}</small></span>
            ${organizador ? `<button class="comentario__apagar" data-apagar-comentario="${c.id}" aria-label="Apagar comentário">${ICONES.lixeira}</button>` : ''}</p>`).join('')}
        <form class="post__comentar" data-post="${p.id}">
          ${nome ? `<input type="hidden" name="nome" value="${escapar(nome)}">`
            : '<input name="nome" maxlength="30" placeholder="Seu nome" required autocomplete="nickname" aria-label="Seu nome">'}
          <input name="texto" maxlength="300" placeholder="${nome ? `Comente como ${escapar(nome)}` : 'Escreva um comentário'}" required autocomplete="off" aria-label="Comentário">
          <button class="post__enviar" type="submit" aria-label="Enviar comentário">➤</button>
        </form>
      </section>`;
  }

  function htmlPost(p, pendente = false) {
    const avatar = p.time ? `<span class="avatar-feed">${escudo(p.time, 48)}</span>` : `<span class="avatar-feed avatar-feed--org">${icone('coroa')}</span>`;
    const qtd = (p.comentarios ?? []).length;
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
        ${pendente ? `
          <div class="post__moderar">
            <button class="botao botao--perigo" data-apagar-post="${p.id}">Recusar</button>
            <button class="botao" data-aprovar="${p.id}">Aprovar e publicar</button>
          </div>` : `
          <footer class="post__acoes">
            <button class="post__acao" data-ver-todos="${p.id}" aria-label="Comentários">${ICONES.comentario}<span>${qtd || ''}</span></button>
            <button class="post__acao" data-compartilhar-post="${p.id}" aria-label="Compartilhar publicação">${ICONES.compartilhar}</button>
          </footer>
          ${htmlComentarios(p)}`}
      </article>`;
  }

  function desenhar() {
    const rascunho = capturar();
    const visiveis = estado.posts.filter((p) => p.aprovado !== false)
      .filter((p) => estado.filtro === 'tudo' || (estado.filtro === 'fotos' ? p.foto_path : !p.foto_path));
    const pendentes = organizador ? estado.posts.filter((p) => p.aprovado === false) : [];
    const filtros = [['tudo', 'Tudo'], ['fotos', 'Fotos'], ['textos', 'Textos']];
    container.innerHTML = `
      ${htmlCompositor()}
      ${pendentes.length ? `<section class="fila-aprovacao"><h3>Aguardando aprovação · ${pendentes.length}</h3>${pendentes.map((p) => htmlPost(p, true)).join('')}</section>` : ''}
      <div class="segmentos feed__filtros" role="tablist">${filtros.map(([id, rotulo]) =>
        `<button class="segmento${estado.filtro === id ? ' segmento--ativo' : ''}" data-filtro="${id}">${rotulo}</button>`).join('')}</div>
      <div class="feed">${visiveis.map((p) => htmlPost(p)).join('') || `<p class="vazio">${estado.filtro === 'tudo' ? 'Nenhuma publicação ainda. Puxe o assunto! ⚽' : 'Nada por aqui ainda.'}</p>`}</div>`;
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
      const [posts, jogos] = await Promise.all([listarPosts(), listarJogos()]);
      estado.posts = posts;
      estado.jogos = jogos;
      if (!estado.carregou) { await identificar(); estado.carregou = true; }
      desenhar();
    } catch (erro) {
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

  // ---------- Eventos (um só ouvinte para tudo) ----------
  container.addEventListener('click', async (e) => {
    const alvo = e.target.closest('button');
    if (!alvo) return;
    try {
      if (alvo.dataset.filtro) { estado.filtro = alvo.dataset.filtro; desenhar(); }
      else if (alvo.dataset.ampliar) ampliar(alvo.dataset.ampliar);
      else if (alvo.dataset.verTodos) {
        const id = Number(alvo.dataset.verTodos);
        if (estado.abertos.has(id) && alvo.classList.contains('post__acao')) estado.abertos.delete(id); else estado.abertos.add(id);
        desenhar();
        if (estado.abertos.has(id)) container.querySelector(`.post__comentar[data-post="${id}"] [name="texto"]`)?.focus();
      } else if (alvo.dataset.compartilharPost) compartilhar(estado.posts.find((p) => p.id === Number(alvo.dataset.compartilharPost)));
      else if (alvo.hasAttribute('data-trocar-codigo')) { esquecer(CHAVE_CODIGO); estado.time = null; desenhar(); }
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
    const formCodigo = e.target.closest('[data-form-codigo]');
    const formComentario = e.target.closest('.post__comentar');
    if (!formCodigo && !formComentario) return;
    e.preventDefault();
    try {
      if (formCodigo) {
        const codigo = formCodigo.elements.codigo.value.trim().toUpperCase();
        const time = await validarCodigo(codigo);
        if (!time) throw new Error('Código do time inválido. Peça ao organizador.');
        guardar(CHAVE_CODIGO, codigo);
        estado.time = time;
        toast(`Postando como ${time.nome} ✔`);
        desenhar();
        container.querySelector('[data-texto]')?.focus();
        return;
      }
      const nome = formComentario.elements.nome.value.trim();
      const texto = formComentario.elements.texto.value.trim();
      await comentarPost(Number(formComentario.dataset.post), nome, texto);
      guardar(CHAVE_NOME, nome);
      formComentario.elements.texto.value = '';
      estado.abertos.add(Number(formComentario.dataset.post));
      await carregar();
    } catch (erro) { toast(erro.message, true); }
  });

  return { carregar };
}
