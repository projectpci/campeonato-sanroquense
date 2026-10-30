// Mural: fotos com descrição e comentários. Times publicam com o código do time; o organizador modera.
import {
  listarPosts, listarJogos, urlFoto, validarCodigo, publicarPost, comentarPost,
  apagarPost, apagarComentario, buscarSessao, aprovarPost,
} from '../api.js';
import { prepararFoto } from '../imagem.js';
import { assinarMudancas } from '../realtime.js';
import { montarLayout, checarConfiguracao, mostrarCarregando, mostrarAviso, escapar, escudo, icone, toast, tempoRelativo } from '../ui.js';

const app = document.getElementById('app');
const CHAVE_CODIGO = 'mural_codigo';
const CHAVE_NOME = 'mural_nome';
const estado = { posts: [], jogos: [], organizador: false, time: null };

// localStorage pode estar bloqueado (aba anônima): nunca deixa quebrar a página
const guardado = (chave) => { try { return localStorage.getItem(chave) ?? ''; } catch { return ''; } };
const guardar = (chave, valor) => { try { localStorage.setItem(chave, valor); } catch { /* sem armazenamento */ } };
const esquecer = (chave) => { try { localStorage.removeItem(chave); } catch { /* sem armazenamento */ } };

// ---------- Identidade ----------
async function carregarIdentidade() {
  estado.organizador = Boolean(await buscarSessao().catch(() => null));
  const codigo = guardado(CHAVE_CODIGO);
  estado.time = null;
  if (codigo && !estado.organizador) {
    estado.time = await validarCodigo(codigo).catch(() => null);
    if (!estado.time) esquecer(CHAVE_CODIGO); // código trocado pelo organizador
  }
}

// Aprovar e apagar publicação: só o organizador (o time pede ao organizador para remover)
const podeApagar = () => estado.organizador;

// ---------- Renderização ----------
function rotuloJogo(j) {
  const placar = j.status === 'encerrado' ? ` ${j.gols_mandante}×${j.gols_visitante} ` : ' × ';
  return `R${j.rodada?.numero ?? '?'} · ${j.mandante.nome}${placar}${j.visitante.nome}`;
}

function htmlComentario(c) {
  return `
    <p class="comentario"><span><strong>${escapar(c.nome)}</strong> ${escapar(c.texto)}<small>${tempoRelativo(c.criado_em)}</small></span>
      ${estado.organizador ? `<button class="comentario__apagar" data-apagar-comentario="${c.id}" aria-label="Apagar comentário">✕</button>` : ''}</p>`;
}

function htmlPost(p) {
  const comentarios = [...(p.comentarios ?? [])].sort((a, b) => a.criado_em.localeCompare(b.criado_em));
  const avatar = p.time ? escudo(p.time, 32) : `<span class="post__org">${icone('coroa')}</span>`;
  return `
    <article class="card post" data-post="${p.id}">
      <header class="post__topo">${avatar}
        <div><strong>${escapar(p.autor)}</strong><span class="texto-2 texto-pequeno">${tempoRelativo(p.criado_em)}</span></div>
        ${podeApagar() ? `<button class="botao botao--perigo" data-apagar-post="${p.id}">Apagar</button>` : ''}
      </header>
      <a href="${escapar(urlFoto(p.foto_path))}" target="_blank" rel="noopener">
        <img class="post__foto" src="${escapar(urlFoto(p.foto_path))}" loading="lazy" alt="Foto publicada por ${escapar(p.autor)}">
      </a>
      <div class="post__corpo">
        ${p.jogo ? `<span class="post__jogo">${escapar(rotuloJogo(p.jogo))}</span>` : ''}
        ${p.descricao ? `<p class="post__descricao">${escapar(p.descricao)}</p>` : ''}
      </div>
      <section class="post__comentarios" aria-label="Comentários">
        ${comentarios.map(htmlComentario).join('')}
        <form class="post__comentar" data-post="${p.id}">
          <input name="nome" maxlength="30" placeholder="Seu nome" required autocomplete="nickname" value="${escapar(guardado(CHAVE_NOME))}">
          <input name="texto" maxlength="300" placeholder="Escreva um comentário" required autocomplete="off">
          <button class="botao" type="submit">Enviar</button>
        </form>
      </section>
    </article>`;
}

function htmlBarra() {
  const quem = estado.organizador
    ? 'Publicando como <strong>Organização</strong>'
    : estado.time
      ? `Publicando como <strong>${escapar(estado.time.nome)}</strong> · <button class="link-botao" data-trocar-codigo>trocar código</button>`
      : 'Para publicar, use o código do seu time.';
  return `<div class="mural__barra"><span class="mural__quem">${quem}</span>
    <button class="botao" data-publicar>+ Publicar foto</button></div>`;
}

// Realtime recarrega o feed: preserva o que o usuário estava digitando nos comentários
function capturarRascunhos() {
  const textos = {};
  app.querySelectorAll('.post__comentar').forEach((f) => { textos[f.dataset.post] = f.elements.texto.value; });
  const ativo = document.activeElement;
  const form = ativo?.closest?.('.post__comentar');
  const foco = form ? { post: form.dataset.post, campo: ativo.name, pos: ativo.selectionStart } : null;
  return { textos, foco };
}

function restaurarRascunhos({ textos, foco }) {
  for (const [id, texto] of Object.entries(textos)) {
    const campo = app.querySelector(`.post__comentar[data-post="${id}"] [name="texto"]`);
    if (campo && texto) campo.value = texto;
  }
  if (foco) {
    const campo = app.querySelector(`.post__comentar[data-post="${foco.post}"] [name="${foco.campo}"]`);
    campo?.focus();
    if (campo && foco.pos != null) campo.setSelectionRange(foco.pos, foco.pos);
  }
}

// Fila de aprovação (só o organizador vê): publicações de time aguardando
function htmlPendente(p) {
  return `
    <article class="card post post--pendente">
      <header class="post__topo">${p.time ? escudo(p.time, 32) : ''}
        <div><strong>${escapar(p.autor)}</strong><span class="texto-2 texto-pequeno">${tempoRelativo(p.criado_em)} · aguardando aprovação</span></div>
      </header>
      <img class="post__foto" src="${escapar(urlFoto(p.foto_path))}" loading="lazy" alt="Foto enviada por ${escapar(p.autor)}">
      ${p.descricao ? `<p class="post__descricao post__corpo">${escapar(p.descricao)}</p>` : ''}
      <div class="form__acoes post__corpo">
        <button class="botao botao--perigo" data-apagar-post="${p.id}">Recusar</button>
        <button class="botao" data-aprovar="${p.id}">Aprovar e publicar</button>
      </div>
    </article>`;
}

function renderizar() {
  const rascunhos = capturarRascunhos();
  const visiveis = estado.posts.filter((p) => p.aprovado !== false);
  const pendentes = estado.organizador ? estado.posts.filter((p) => p.aprovado === false) : [];
  app.innerHTML = `${htmlBarra()}
    ${pendentes.length ? `<section class="secao fila-aprovacao"><h3>Aguardando aprovação (${pendentes.length})</h3>${pendentes.map(htmlPendente).join('')}</section>` : ''}
    ${visiveis.length ? visiveis.map(htmlPost).join('')
      : '<p class="carregando">Nenhuma publicação ainda. Seja o primeiro a postar uma foto!</p>'}`;
  restaurarRascunhos(rascunhos);
}

async function carregar() {
  try {
    const [posts, jogos] = await Promise.all([listarPosts(), listarJogos()]);
    estado.posts = posts;
    estado.jogos = jogos;
    await carregarIdentidade();
    renderizar();
  } catch (erro) {
    mostrarAviso(app, `Não foi possível carregar o mural: ${erro.message}`);
  }
}

// ---------- Publicar ----------
function abrirDialogoPublicar() {
  document.querySelector('dialog.dialogo')?.remove();
  const jogos = [...estado.jogos]
    .sort((a, b) => (b.rodada?.numero ?? 0) - (a.rodada?.numero ?? 0)).slice(0, 25)
    .map((j) => `<option value="${j.id}">${escapar(rotuloJogo(j))}</option>`).join('');
  const d = document.createElement('dialog');
  d.className = 'dialogo';
  d.innerHTML = `
    <form class="form" id="form-post">
      <h2>Publicar foto</h2>
      ${estado.organizador ? '<p class="texto-2">Publicando como Organização.</p>' : `
        <label class="campo">Código do time*
          <input name="codigo" required autocapitalize="characters" autocomplete="off" value="${escapar(guardado(CHAVE_CODIGO))}"></label>`}
      <label class="campo">Foto*<input type="file" name="foto" accept="image/*" required></label>
      <img class="post__previa oculto" alt="Prévia da foto">
      <label class="campo">Descrição<textarea name="descricao" maxlength="500" placeholder="Conte como foi o jogo..."></textarea></label>
      <label class="campo">Jogo (opcional)<select name="jogo"><option value="">Nenhum</option>${jogos}</select></label>
      <p class="texto-2 texto-pequeno">${estado.organizador ? 'Publique só fotos do campeonato.'
        : 'A foto entra no mural depois que o organizador aprovar. No painel do clube ela aparece na hora.'}</p>
      <div class="form__acoes">
        <button class="botao botao--secundario" type="button" data-fechar>Cancelar</button>
        <button class="botao" type="submit">Publicar</button>
      </div>
    </form>`;
  d.addEventListener('close', () => d.remove());
  document.body.append(d);
  d.showModal();

  d.querySelector('[data-fechar]').addEventListener('click', () => d.close());
  d.querySelector('[name=foto]').addEventListener('change', (e) => {
    const previa = d.querySelector('.post__previa');
    const arquivo = e.target.files[0];
    previa.classList.toggle('oculto', !arquivo);
    if (arquivo) previa.src = URL.createObjectURL(arquivo);
  });
  d.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = new FormData(e.target);
    const enviar = d.querySelector('[type=submit]');
    enviar.disabled = true;
    try {
      let codigo;
      if (!estado.organizador) {
        codigo = dados.get('codigo').trim().toUpperCase();
        if (!(await validarCodigo(codigo))) throw new Error('Código do time inválido. Peça ao organizador.');
      }
      toast('Enviando foto...');
      const foto = await prepararFoto(dados.get('foto'));
      await publicarPost({ codigo, descricao: dados.get('descricao'), foto, jogoId: dados.get('jogo') ? Number(dados.get('jogo')) : null });
      if (codigo) guardar(CHAVE_CODIGO, codigo);
      d.close();
      toast(codigo ? 'Foto enviada! Ela entra no mural depois da aprovação do organizador.' : 'Foto publicada ✔');
      await carregar();
    } catch (erro) {
      toast(erro.message, true);
      enviar.disabled = false;
    }
  });
}

// ---------- Ações no feed ----------
app.addEventListener('click', async (e) => {
  const botao = e.target.closest('button');
  if (!botao) return;
  try {
    if (botao.hasAttribute('data-publicar')) abrirDialogoPublicar();
    else if (botao.dataset.aprovar) { await aprovarPost(Number(botao.dataset.aprovar)); toast('Publicação aprovada ✔'); await carregar(); }
    else if (botao.hasAttribute('data-trocar-codigo')) { esquecer(CHAVE_CODIGO); estado.time = null; renderizar(); abrirDialogoPublicar(); }
    else if (botao.dataset.apagarPost) {
      const post = estado.posts.find((p) => p.id === Number(botao.dataset.apagarPost));
      if (!estado.organizador || !confirm('Apagar esta publicação e os comentários dela?')) return;
      await apagarPost(post);
      toast('Publicação apagada');
      await carregar();
    } else if (botao.dataset.apagarComentario) {
      if (!confirm('Apagar este comentário?')) return;
      await apagarComentario(Number(botao.dataset.apagarComentario));
      await carregar();
    }
  } catch (erro) {
    toast(erro.message, true);
  }
});

app.addEventListener('submit', async (e) => {
  const form = e.target.closest('.post__comentar');
  if (!form) return;
  e.preventDefault();
  const nome = form.elements.nome.value.trim();
  const texto = form.elements.texto.value.trim();
  try {
    await comentarPost(Number(form.dataset.post), nome, texto);
    guardar(CHAVE_NOME, nome);
    form.elements.texto.value = '';
    await carregar();
  } catch (erro) {
    toast(erro.message, true);
  }
});

montarLayout('mural');
if (checarConfiguracao(app)) {
  mostrarCarregando(app);
  carregar();
  assinarMudancas(carregar);
}
