// Única porta para o banco. Não manipula DOM.
import { supabase, CAMPEONATO_ID, demo } from './supabase.js';
import { dadosDemo } from './demo.js';

function cliente() {
  if (!supabase) throw new Error('Modo demonstração: configure js/config.js para salvar dados.');
  return supabase;
}

async function executar(consulta) {
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  return data;
}

const SELECT_JOGO = `
  *,
  mandante:times!jogos_mandante_id_fkey(id, nome, sigla, escudo_url),
  visitante:times!jogos_visitante_id_fkey(id, nome, sigla, escudo_url),
  rodada:rodadas(id, numero, data),
  gols(id, time_id, quantidade, contra, jogador:jogadores(id, nome))
`;

// ---------- Leitura ----------
export const buscarCampeonato = () =>
  demo ? dadosDemo.buscarCampeonato() :
  executar(cliente().from('campeonato').select('*').eq('id', CAMPEONATO_ID).single());

export const listarTimes = () =>
  demo ? dadosDemo.listarTimes() :
  executar(cliente().from('times').select('*').eq('campeonato_id', CAMPEONATO_ID).order('nome'));

export const listarRodadas = () =>
  demo ? dadosDemo.listarRodadas() :
  executar(cliente().from('rodadas').select('*').eq('campeonato_id', CAMPEONATO_ID).order('numero'));

export const listarJogos = (rodadaId) => {
  if (demo) return dadosDemo.listarJogos(rodadaId);
  let consulta = cliente().from('jogos').select(SELECT_JOGO).order('data_hora', { nullsFirst: false });
  if (rodadaId) consulta = consulta.eq('rodada_id', rodadaId);
  return executar(consulta);
};

export const listarJogosEncerrados = () =>
  demo ? dadosDemo.listarJogosEncerrados() :
  executar(cliente().from('jogos').select('*').eq('status', 'encerrado'));

export const listarJogadores = (timeId) => {
  if (demo) return dadosDemo.listarJogadores(timeId);
  let consulta = cliente().from('jogadores').select('*').order('nome');
  if (timeId) consulta = consulta.eq('time_id', timeId);
  return executar(consulta);
};

export const buscarClassificacao = () =>
  demo ? dadosDemo.buscarClassificacao() :
  executar(cliente().from('v_classificacao').select('*').eq('campeonato_id', CAMPEONATO_ID));

export const buscarArtilharia = (timeId) => {
  if (demo) return dadosDemo.buscarArtilharia(timeId);
  let consulta = cliente().from('v_artilharia').select('*').eq('campeonato_id', CAMPEONATO_ID);
  if (timeId) consulta = consulta.eq('time_id', timeId);
  return executar(consulta);
};

// ---------- Auth ----------
// Em modo demonstração, qualquer e-mail/senha entra (sessão só no navegador)
const CHAVE_DEMO = 'demo_sessao';

export async function entrar(email, senha) {
  if (demo) { sessionStorage.setItem(CHAVE_DEMO, email); return; }
  return executar(cliente().auth.signInWithPassword({ email, password: senha }));
}

export async function sair() {
  if (demo) { sessionStorage.removeItem(CHAVE_DEMO); return; }
  return cliente().auth.signOut();
}

export async function buscarSessao() {
  if (demo) return sessionStorage.getItem(CHAVE_DEMO) ? { user: { email: sessionStorage.getItem(CHAVE_DEMO) } } : null;
  const { data } = await cliente().auth.getSession();
  return data.session;
}

// ---------- Escrita (exige organizador autenticado) ----------
// Com `id` atualiza só os campos enviados; sem `id` cria. (upsert parcial falharia nos campos NOT NULL)
const gravar = (tabela, registro) => {
  const { id, ...campos } = registro;
  const consulta = id
    ? cliente().from(tabela).update(campos).eq('id', id)
    : cliente().from(tabela).insert(campos);
  return executar(consulta.select().single());
};

export const salvarTime = (time) =>
  demo ? dadosDemo.salvarTime(time) :
  gravar('times', time.id ? time : { ...time, campeonato_id: CAMPEONATO_ID });

export async function enviarEscudo(timeId, arquivo) {
  if (demo) return URL.createObjectURL(arquivo);
  const caminho = `${timeId}.png`;
  const { error } = await cliente().storage.from('escudos')
    .upload(caminho, arquivo, { upsert: true, contentType: 'image/png' });
  if (error) throw new Error(error.message);
  const { data } = cliente().storage.from('escudos').getPublicUrl(caminho);
  return `${data.publicUrl}?v=${Date.now()}`; // evita cache do escudo antigo
}

// Time que já jogou não pode ser excluído (o banco bloqueia): desative-o
export const excluirTime = (id) =>
  demo ? dadosDemo.excluirTime(id) :
  executar(cliente().from('times').delete().eq('id', id));

// Excluir a rodada apaga também os confrontos e gols dela (cascade)
export const excluirRodada = (id) =>
  demo ? dadosDemo.excluirRodada(id) :
  executar(cliente().from('rodadas').delete().eq('id', id));

export const salvarRodada = (rodada) =>
  demo ? dadosDemo.salvarRodada(rodada) :
  gravar('rodadas', rodada.id ? rodada : { ...rodada, campeonato_id: CAMPEONATO_ID });

export const salvarJogo = (jogo) =>
  demo ? dadosDemo.salvarJogo(jogo) :
  gravar('jogos', jogo);

// Placar ao vivo: só atualiza o placar (autores dos gols entram ao encerrar o jogo)
export const atualizarPlacarAoVivo = (jogoId, golsMandante, golsVisitante) =>
  salvarJogo({
    id: jogoId, status: 'ao_vivo', gols_mandante: golsMandante, gols_visitante: golsVisitante,
    atualizado_em: new Date().toISOString(),
  });

export const excluirJogo = (id) =>
  demo ? dadosDemo.excluirJogo(id) :
  executar(cliente().from('jogos').delete().eq('id', id));

// listaGols: [{ time_id, jogador_nome, quantidade, contra }]
export const salvarResultado = (jogoId, golsMandante, golsVisitante, listaGols) =>
  demo ? dadosDemo.salvarResultado(jogoId, golsMandante, golsVisitante, listaGols) :
  executar(cliente().rpc('salvar_resultado', {
    p_jogo_id: jogoId,
    p_gols_mandante: golsMandante,
    p_gols_visitante: golsVisitante,
    p_gols: listaGols,
  }));

// Volta o jogo para agendado e apaga os gols
export async function reabrirJogo(jogoId) {
  if (demo) return dadosDemo.reabrirJogo(jogoId);
  await executar(cliente().from('gols').delete().eq('jogo_id', jogoId));
  return executar(cliente().from('jogos').update({
    status: 'agendado', gols_mandante: null, gols_visitante: null, atualizado_em: new Date().toISOString(),
  }).eq('id', jogoId));
}

// ---------- Mural ----------
const SELECT_POST = `
  *,
  time:times(id, nome, escudo_url),
  jogo:jogos(id, gols_mandante, gols_visitante, status,
    mandante:times!jogos_mandante_id_fkey(nome), visitante:times!jogos_visitante_id_fkey(nome), rodada:rodadas(numero)),
  comentarios(id, nome, texto, criado_em)`;

export const listarPosts = () =>
  demo ? dadosDemo.listarPosts() :
  executar(cliente().from('posts').select(SELECT_POST)
    .eq('campeonato_id', CAMPEONATO_ID).order('criado_em', { ascending: false }).limit(60));

// URL pública da foto (no demo o caminho já é a própria imagem)
export function urlFoto(caminho) {
  if (demo || /^(data:|assets\/|https?:)/.test(caminho)) return caminho;
  return cliente().storage.from('mural').getPublicUrl(caminho).data.publicUrl;
}

// Devolve { time_id, nome } do time dono do código, ou null
export async function validarCodigo(codigo) {
  if (demo) return dadosDemo.validarCodigo(codigo);
  const dados = await executar(cliente().rpc('validar_codigo', { p_codigo: codigo }));
  return dados?.[0] ?? null;
}

async function enviarFotoMural(foto) {
  const caminho = `posts/${crypto.randomUUID()}.jpg`;
  const { error } = await cliente().storage.from('mural').upload(caminho, foto, { contentType: 'image/jpeg' });
  if (error) throw new Error(error.message);
  return caminho;
}

// Com `codigo`: publica como o time. Sem código: organizador autenticado ("Organização")
export async function publicarPost({ codigo, descricao, foto, jogoId }) {
  if (demo) return dadosDemo.publicarPost({ codigo, descricao, foto, jogoId });
  const caminho = await enviarFotoMural(foto);
  if (codigo) {
    const resposta = await executar(cliente().rpc('publicar_post', {
      p_codigo: codigo, p_descricao: descricao ?? '', p_foto_path: caminho, p_jogo_id: jogoId ?? null,
    }));
    if (resposta?.erro === 'codigo') throw new Error('Código do time inválido. Peça o código ao organizador.');
    return resposta;
  }
  // publicação do organizador já sai aprovada
  return gravar('posts', { campeonato_id: CAMPEONATO_ID, autor: 'Organização', descricao: descricao || null, foto_path: caminho, jogo_id: jogoId ?? null, aprovado: true, aprovado_em: new Date().toISOString() });
}

export const comentarPost = (postId, nome, texto) =>
  demo ? dadosDemo.comentarPost(postId, nome, texto) :
  executar(cliente().rpc('comentar_post', { p_post_id: postId, p_nome: nome, p_texto: texto }));

export async function apagarPostDoTime(codigo, postId) {
  if (demo) return dadosDemo.apagarPostDoTime(codigo, postId);
  const resposta = await executar(cliente().rpc('apagar_post_time', { p_codigo: codigo, p_post_id: postId }));
  if (resposta?.erro === 'codigo') throw new Error('Código do time inválido. Peça o código ao organizador.');
  return resposta;
}

// Moderação do organizador
export async function apagarPost(post) {
  if (demo) return dadosDemo.apagarPost(post.id);
  await executar(cliente().from('posts').delete().eq('id', post.id));
  await cliente().storage.from('mural').remove([post.foto_path]); // melhor esforço
}

// Moderação: publicação de time só aparece para todos depois de aprovada
export const aprovarPost = (id) =>
  demo ? dadosDemo.aprovarPost(id) :
  gravar('posts', { id, aprovado: true, aprovado_em: new Date().toISOString() });

export async function contarPostsPendentes() {
  if (demo) return dadosDemo.listarPosts().filter((p) => p.aprovado === false).length;
  const { count, error } = await cliente().from('posts').select('id', { count: 'exact', head: true }).eq('aprovado', false);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export const apagarComentario = (id) =>
  demo ? dadosDemo.apagarComentario(id) :
  executar(cliente().from('comentarios').delete().eq('id', id));

// Códigos de publicação dos times (só o organizador lê)
export const listarCodigos = () =>
  demo ? dadosDemo.listarCodigos() :
  executar(cliente().from('codigos_times').select('time_id, codigo'));

const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sem letras/números confundíveis (0/O, 1/I/L)

export async function gerarCodigo(timeId) {
  if (demo) return dadosDemo.gerarCodigo(timeId);
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const codigo = [...bytes].map((b) => ALFABETO_CODIGO[b % ALFABETO_CODIGO.length]).join('');
  await executar(cliente().from('codigos_times').upsert({ time_id: timeId, codigo }));
  return codigo;
}

// ---------- Avisos (Web Push) ----------
export const inscreverPush = (inscricao, times) =>
  demo ? Promise.resolve() :
  executar(cliente().rpc('inscrever_push', {
    p_endpoint: inscricao.endpoint, p_p256dh: inscricao.keys.p256dh, p_auth: inscricao.keys.auth, p_times: times,
  }));

export const cancelarPush = (endpoint) =>
  demo ? Promise.resolve() :
  executar(cliente().rpc('cancelar_push', { p_endpoint: endpoint }));

// ---------- Área do clube (acesso pelo código do time, sem login) ----------
// As funções do banco devolvem { erro: 'codigo' } quando o código não vale mais (trocado pelo organizador)
async function rpcClube(nome, parametros) {
  const resposta = await executar(cliente().rpc(nome, parametros));
  if (resposta?.erro === 'codigo') throw Object.assign(new Error('Código do time inválido. Peça o código novo ao organizador.'), { codigoInvalido: true });
  return resposta;
}

export async function enviarFotoElenco(timeId, foto) {
  if (demo) return URL.createObjectURL(foto);
  const caminho = `fotos/${timeId}/${crypto.randomUUID()}.jpg`;
  const { error } = await cliente().storage.from('elenco').upload(caminho, foto, { contentType: 'image/jpeg' });
  if (error) throw new Error(error.message);
  return cliente().storage.from('elenco').getPublicUrl(caminho).data.publicUrl;
}

export const clubeSalvarJogador = (codigo, j) =>
  demo ? dadosDemo.clubeSalvarJogador(codigo, j) :
  rpcClube('clube_salvar_jogador', {
    p_codigo: codigo, p_id: j.id ?? null, p_nome: j.nome, p_numero: j.numero ?? null, p_posicao: j.posicao || null, p_foto_url: j.foto_url || null,
  });

export const clubeApagarJogador = (codigo, id) =>
  demo ? dadosDemo.clubeApagarJogador(codigo, id) :
  rpcClube('clube_apagar_jogador', { p_codigo: codigo, p_id: id });

export const clubeSalvarTecnico = (codigo, nome, fotoUrl) =>
  demo ? dadosDemo.clubeSalvarTecnico(codigo, nome, fotoUrl) :
  rpcClube('clube_salvar_tecnico', { p_codigo: codigo, p_nome: nome, p_foto_url: fotoUrl || null });

export const clubeBuscarEscalacao = (codigo) =>
  demo ? dadosDemo.clubeBuscarEscalacao(codigo) :
  rpcClube('clube_buscar_escalacao', { p_codigo: codigo });

export const clubeSalvarEscalacao = (codigo, { formacao, titulares, reservas }) =>
  demo ? dadosDemo.clubeSalvarEscalacao(codigo, { formacao, titulares, reservas }) :
  rpcClube('clube_salvar_escalacao', { p_codigo: codigo, p_formacao: formacao, p_titulares: titulares, p_reservas: reservas });

// Publicações do próprio clube, inclusive as que aguardam aprovação
export async function clubeMeusPosts(codigo) {
  if (demo) return dadosDemo.clubeMeusPosts(codigo);
  return (await rpcClube('clube_meus_posts', { p_codigo: codigo })).posts ?? [];
}
