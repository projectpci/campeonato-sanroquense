// Dados de demonstração (rodadas 1 e 2 do banner + rodada 3 agendada).
// Usado só quando js/config.js não existe; imita as respostas do Supabase.
const nomesTimes = ['RDL', 'Palmeiras', 'Real Barça SR', 'Juventus', 'Malvina', 'Os 10', 'Rua Nova', 'Os Coroas', 'Fúria', 'SR City'];
const times = nomesTimes.map((nome, i) => ({
  id: i + 1, campeonato_id: 1, nome, sigla: nome.slice(0, 3).toUpperCase(), ativo: true,
  escudo_url: `assets/escudos/${nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`,
}));
const idDe = (nome) => times.find((t) => t.nome === nome).id;
const timePorId = (id) => times.find((t) => t.id === id);

const campeonato = { id: 1, nome: 'Campeonato SRP', local: 'Campo Maicon Santos', organizacao: 'Pebinha e Duduzete' };

const rodadas = [
  { id: 1, campeonato_id: 1, numero: 1, data: '2026-10-18' },
  { id: 2, campeonato_id: 1, numero: 2, data: '2026-10-25' },
  { id: 3, campeonato_id: 1, numero: 3, data: '2026-11-01' },
];

// [rodada, mandante, visitante, golsM, golsV, gols: [nomeTimeQueRecebe, jogador, qtd, contra?]]
const definicao = [
  [1, 'Real Barça SR', 'SR City', 3, 0, [['Real Barça SR', 'Neto', 2], ['Real Barça SR', 'Caio', 1]]],
  [1, 'Palmeiras', 'Os Coroas', 5, 1, [['Palmeiras', 'Pedro', 3], ['Palmeiras', 'Léo', 2], ['Os Coroas', 'Beto', 1]]],
  [1, 'RDL', 'Malvina', 3, 1, [['RDL', 'Dudu', 2], ['RDL', 'Rafa', 1], ['Malvina', 'Jão', 1]]],
  [1, 'Os 10', 'Rua Nova', 3, 2, [['Os 10', 'Ale', 2], ['Os 10', 'Kiko', 1], ['Rua Nova', 'Tito', 2]]],
  [1, 'Juventus', 'Fúria', 2, 0, [['Juventus', 'Davi', 2]]],
  [2, 'RDL', 'SR City', 2, 0, [['RDL', 'Dudu', 1], ['RDL', 'Rafa', 1]]],
  [2, 'Palmeiras', 'Real Barça SR', 2, 2, [['Palmeiras', 'Pedro', 2], ['Real Barça SR', 'Neto', 1], ['Real Barça SR', 'Léo', 1, true]]],
  [2, 'Malvina', 'Os 10', 4, 2, [['Malvina', 'Jão', 3], ['Malvina', 'Mateus', 1], ['Os 10', 'Ale', 2]]],
  [3, 'Fúria', 'Rua Nova'], [3, 'Juventus', 'Os Coroas'], [3, 'RDL', 'Palmeiras'],
  [3, 'Real Barça SR', 'Malvina'], [3, 'SR City', 'Os 10'],
];

// Autor de gol contra pertence ao adversário de quem recebe o gol
function timeDoAutor(timeRecebe, mandante, visitante, contra) {
  return contra ? (timeRecebe === mandante ? visitante : mandante) : timeRecebe;
}

const jogadores = [];
function jogadorId(timeId, nome) {
  let j = jogadores.find((x) => x.time_id === timeId && x.nome === nome);
  if (!j) { j = { id: jogadores.length + 1, time_id: timeId, nome }; jogadores.push(j); }
  return j;
}

function montarJogo([rodadaId, nomeM, nomeV, gm, gv, lista], i) {
  const mandante_id = idDe(nomeM);
  const visitante_id = idDe(nomeV);
  const encerrado = gm !== undefined;
  const gols = (lista ?? []).map(([nomeTime, nome, quantidade, contra = false], k) => {
    const time_id = idDe(nomeTime);
    const jogador = jogadorId(timeDoAutor(time_id, mandante_id, visitante_id, contra), nome);
    return { id: i * 10 + k, time_id, quantidade, contra, jogador };
  });
  return {
    id: i + 1, rodada_id: rodadaId, mandante_id, visitante_id,
    data_hora: `${rodadas[rodadaId - 1].data}T16:00:00`,
    gols_mandante: encerrado ? gm : null, gols_visitante: encerrado ? gv : null,
    status: encerrado ? 'encerrado' : 'agendado',
    atualizado_em: `${rodadas[rodadaId - 1].data}T19:00:00`,
    mandante: timePorId(mandante_id), visitante: timePorId(visitante_id),
    rodada: rodadas[rodadaId - 1], gols,
  };
}
const jogos = definicao.map(montarJogo);

function classificacao() {
  return times.map((t) => {
    const l = { time_id: t.id, campeonato_id: 1, nome: t.nome, sigla: t.sigla, escudo_url: t.escudo_url, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 };
    for (const jo of jogos.filter((x) => x.status === 'encerrado')) {
      const mandante = jo.mandante_id === t.id;
      if (!mandante && jo.visitante_id !== t.id) continue;
      const gp = mandante ? jo.gols_mandante : jo.gols_visitante;
      const gc = mandante ? jo.gols_visitante : jo.gols_mandante;
      l.j++; l.gp += gp; l.gc += gc;
      if (gp > gc) l.v++; else if (gp === gc) l.e++; else l.d++;
    }
    l.sg = l.gp - l.gc;
    l.pts = 3 * l.v + l.e;
    l.aproveitamento = l.j ? Math.round((1000 * l.pts) / (3 * l.j)) / 10 : 0;
    return l;
  });
}

function artilharia(timeId) {
  const porJogador = new Map();
  for (const jo of jogos.filter((x) => x.status === 'encerrado')) {
    for (const g of jo.gols.filter((x) => !x.contra)) {
      porJogador.set(g.jogador.id, (porJogador.get(g.jogador.id) ?? 0) + g.quantidade);
    }
  }
  return [...porJogador].map(([id, gols]) => {
    const j = jogadores.find((x) => x.id === id);
    const t = timePorId(j.time_id);
    return { jogador_id: id, jogador: j.nome, time_id: t.id, time: t.nome, escudo_url: t.escudo_url, campeonato_id: 1, gols };
  })
    .filter((a) => !timeId || a.time_id === Number(timeId))
    .sort((a, b) => b.gols - a.gols || a.jogador.localeCompare(b.jogador, 'pt-BR'));
}

// ---------- Escrita em memória (some ao recarregar a página) ----------
const proximoId = (lista) => Math.max(0, ...lista.map((x) => x.id)) + 1;

function religar(jogo) {
  jogo.mandante = timePorId(jogo.mandante_id);
  jogo.visitante = timePorId(jogo.visitante_id);
  jogo.rodada = rodadas.find((r) => r.id === jogo.rodada_id);
  return jogo;
}

function salvarTime(time) {
  if (time.id) return Object.assign(timePorId(time.id), time);
  const novo = { ativo: true, escudo_url: null, campeonato_id: 1, ...time, id: proximoId(times) };
  times.push(novo);
  return novo;
}

function salvarRodada(rodada) {
  if (rodada.id) return Object.assign(rodadas.find((r) => r.id === rodada.id), rodada);
  const nova = { campeonato_id: 1, ...rodada, id: proximoId(rodadas) };
  rodadas.push(nova);
  return nova;
}

function salvarJogo(jogo) {
  const conflito = jogos.some((x) => x.rodada_id === jogo.rodada_id && x.id !== jogo.id
    && [x.mandante_id, x.visitante_id].some((t) => [jogo.mandante_id, jogo.visitante_id].includes(t)));
  if (conflito) throw new Error('Um dos times já tem jogo nesta rodada.');
  if (jogo.mandante_id !== undefined && jogo.mandante_id === jogo.visitante_id) throw new Error('Mandante e visitante devem ser diferentes.');
  if (jogo.id) return religar(Object.assign(jogos.find((x) => x.id === jogo.id), jogo));
  const novo = religar({ status: 'agendado', gols_mandante: null, gols_visitante: null, gols: [], atualizado_em: new Date().toISOString(), ...jogo, id: proximoId(jogos) });
  jogos.push(novo);
  return novo;
}

function excluirTime(id) {
  if (jogos.some((j) => j.mandante_id === id || j.visitante_id === id)) {
    throw new Error('Este time já tem jogos. Desative-o em vez de excluir.');
  }
  times.splice(times.findIndex((x) => x.id === id), 1);
}

function excluirRodada(id) {
  for (let i = jogos.length - 1; i >= 0; i--) if (jogos[i].rodada_id === id) jogos.splice(i, 1);
  rodadas.splice(rodadas.findIndex((r) => r.id === id), 1);
}

function excluirJogo(id) {
  jogos.splice(jogos.findIndex((x) => x.id === id), 1);
}

function salvarResultado(jogoId, gm, gv, lista) {
  const jogo = jogos.find((x) => x.id === jogoId);
  const soma = (timeId) => lista.filter((g) => g.time_id === timeId).reduce((s, g) => s + g.quantidade, 0);
  if (soma(jogo.mandante_id) !== gm || soma(jogo.visitante_id) !== gv) throw new Error('Soma dos gols não confere com o placar.');
  jogo.gols = lista.map((g, k) => ({
    id: jogoId * 100 + k, time_id: g.time_id, quantidade: g.quantidade, contra: Boolean(g.contra),
    jogador: g.jogador_nome ? jogadorId(timeDoAutor(g.time_id, jogo.mandante_id, jogo.visitante_id, g.contra), g.jogador_nome.trim()) : null,
  }));
  Object.assign(jogo, { gols_mandante: gm, gols_visitante: gv, status: 'encerrado', atualizado_em: new Date().toISOString() });
}

function reabrirJogo(jogoId) {
  Object.assign(jogos.find((x) => x.id === jogoId), { gols: [], gols_mandante: null, gols_visitante: null, status: 'agendado' });
}

// ---------- Mural (demo) ----------
const semAcento = (s) => s.normalize('NFD').replace(/[^A-Za-z]/g, '');
const codigos = new Map(times.map((t) => [t.id, `${semAcento(t.nome).slice(0, 3).toUpperCase()}${100 + t.id}`]));
const haHoras = (h) => new Date(Date.now() - h * 3600e3).toISOString();

const posts = [
  { id: 1, campeonato_id: 1, time_id: idDe('RDL'), autor: 'RDL', descricao: 'Vitória na estreia! Time unido, bora pra próxima 💚', foto_path: 'assets/banner-referencia.png', jogo_id: 3, criado_em: haHoras(26) },
  { id: 2, campeonato_id: 1, time_id: null, autor: 'Organização', descricao: 'Bom jogo a todos! A rodada 3 acontece neste domingo, no Campo Maicon Santos.', foto_path: 'assets/banner-referencia.png', jogo_id: null, criado_em: haHoras(3) },
];
const comentarios = [
  { id: 1, post_id: 1, nome: 'Zé da Feira', texto: 'Que time! Tamo junto 👏', criado_em: haHoras(20) },
];

function montarPost(p) {
  return {
    ...p,
    time: p.time_id ? timePorId(p.time_id) : null,
    jogo: p.jogo_id ? jogos.find((j) => j.id === p.jogo_id) ?? null : null,
    comentarios: comentarios.filter((c) => c.post_id === p.id),
  };
}

const lerComoDataUrl = (blob) => new Promise((ok, falha) => {
  const leitor = new FileReader();
  leitor.onload = () => ok(leitor.result);
  leitor.onerror = () => falha(new Error('Não foi possível ler a foto.'));
  leitor.readAsDataURL(blob);
});

function validarCodigo(codigo) {
  const achado = [...codigos].find(([, c]) => c === String(codigo ?? '').trim().toUpperCase());
  const time = achado && timePorId(achado[0]);
  return time?.ativo ? { time_id: time.id, nome: time.nome } : null;
}

async function publicarPost({ codigo, descricao, foto, jogoId }) {
  const time = codigo ? validarCodigo(codigo) : null;
  if (codigo && !time) throw new Error('Código do time inválido.');
  const novo = {
    id: proximoId(posts), campeonato_id: 1, time_id: time?.time_id ?? null, autor: time?.nome ?? 'Organização',
    descricao: descricao?.trim() || null, foto_path: await lerComoDataUrl(foto), jogo_id: jogoId ?? null, criado_em: new Date().toISOString(),
    aprovado: !time, // time aguarda o organizador aprovar
  };
  posts.push(novo);
}

function comentarPost(postId, nome, texto) {
  if (!nome?.trim() || !texto?.trim()) throw new Error('Informe seu nome e o comentário.');
  comentarios.push({ id: proximoId(comentarios), post_id: postId, nome: nome.trim().slice(0, 30), texto: texto.trim().slice(0, 300), criado_em: new Date().toISOString() });
}

function apagarPost(id) {
  const i = posts.findIndex((p) => p.id === id);
  if (i >= 0) posts.splice(i, 1);
  for (let k = comentarios.length - 1; k >= 0; k--) if (comentarios[k].post_id === id) comentarios.splice(k, 1);
}

function apagarPostDoTime(codigo, id) {
  const time = validarCodigo(codigo);
  if (!time) throw new Error('Código do time inválido.');
  if (posts.find((p) => p.id === id)?.time_id === time.time_id) apagarPost(id);
}

function apagarComentario(id) {
  const i = comentarios.findIndex((c) => c.id === id);
  if (i >= 0) comentarios.splice(i, 1);
}

function gerarCodigo(timeId) {
  const novo = `${semAcento(timePorId(timeId).nome).slice(0, 3).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`;
  codigos.set(timeId, novo);
  return novo;
}

function aprovarPost(id) {
  const post = posts.find((p) => p.id === id);
  if (post) post.aprovado = true;
}

function clubeMeusPosts(codigo) {
  const time = validarCodigo(codigo);
  if (!time) throw Object.assign(new Error('Código do time inválido.'), { codigoInvalido: true });
  return posts.filter((p) => p.time_id === time.time_id).sort((a, b) => b.criado_em.localeCompare(a.criado_em))
    .map((p) => ({ ...p, aprovado: p.aprovado !== false, comentarios: comentarios.filter((c) => c.post_id === p.id).length }));
}

// ---------- Área do clube (demo) ----------
const escalacoes = new Map();
function timeDoCodigo(codigo) {
  const time = validarCodigo(codigo);
  if (!time) throw Object.assign(new Error('Código do time inválido.'), { codigoInvalido: true });
  return time.time_id;
}

function clubeSalvarJogador(codigo, j) {
  const timeId = timeDoCodigo(codigo);
  const existente = j.id ? jogadores.find((x) => x.id === j.id && x.time_id === timeId) : null;
  const dados = { nome: j.nome.trim(), numero: j.numero ?? null, posicao: j.posicao || null, foto_url: j.foto_url || null, ativo: true };
  if (existente) Object.assign(existente, dados);
  else jogadores.push({ id: proximoId(jogadores), time_id: timeId, ...dados });
  return { id: existente?.id ?? jogadores.at(-1).id };
}

function clubeApagarJogador(codigo, id) {
  const timeId = timeDoCodigo(codigo);
  const i = jogadores.findIndex((x) => x.id === id && x.time_id === timeId);
  if (i >= 0) jogadores[i].ativo = false;
  return { ok: true };
}

function clubeSalvarTecnico(codigo, nome, fotoUrl) {
  const time = timePorId(timeDoCodigo(codigo));
  Object.assign(time, { tecnico_nome: nome?.trim() || null, tecnico_foto_url: fotoUrl || null });
  return { ok: true };
}

const clubeBuscarEscalacao = (codigo) => escalacoes.get(timeDoCodigo(codigo)) ?? { time_id: timeDoCodigo(codigo) };
function clubeSalvarEscalacao(codigo, escalacao) {
  const timeId = timeDoCodigo(codigo);
  escalacoes.set(timeId, { time_id: timeId, ...escalacao, atualizado_em: new Date().toISOString() });
  return { ok: true };
}

export const dadosDemo = {
  salvarTime, salvarRodada, salvarJogo, excluirJogo, excluirTime, excluirRodada, salvarResultado, reabrirJogo,
  publicarPost, comentarPost, apagarPost, apagarPostDoTime, apagarComentario, gerarCodigo, validarCodigo,
  aprovarPost, clubeMeusPosts, clubeSalvarJogador, clubeApagarJogador, clubeSalvarTecnico, clubeBuscarEscalacao, clubeSalvarEscalacao,
  listarPosts: () => [...posts].sort((a, b) => b.criado_em.localeCompare(a.criado_em)).map(montarPost),
  listarCodigos: () => [...codigos].map(([time_id, codigo]) => ({ time_id, codigo })),
  buscarCampeonato: () => campeonato,
  listarTimes: () => times,
  listarRodadas: () => rodadas,
  listarJogos: (rodadaId) => jogos.filter((j) => !rodadaId || j.rodada_id === rodadaId),
  listarJogosEncerrados: () => jogos.filter((j) => j.status === 'encerrado'),
  listarJogadores: (timeId) => jogadores.filter((j) => !timeId || j.time_id === timeId),
  buscarClassificacao: classificacao,
  buscarArtilharia: artilharia,
};
