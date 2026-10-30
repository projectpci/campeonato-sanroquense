// Elenco por WhatsApp: monta a mensagem que o clube envia (formulário) e lê as mensagens recebidas para o
// organizador importar em massa. Módulo puro (sem tela nem banco): testado em tests/elenco.test.mjs.
// As posições são as do sistema (js/escalacao.js): GOL, ZAG, LAT, VOL, MEI, ATA.

export const SECOES = [
  ['GOL', 'Goleiros', '🧤'], ['ZAG', 'Zagueiros', '🛡️'], ['LAT', 'Laterais', '↔️'],
  ['VOL', 'Volantes', '⚙️'], ['MEI', 'Meias', '🎯'], ['ATA', 'Atacantes', '⚽'],
];

// Palavras que o clube pode usar para dizer a posição (sem acento, minúsculas)
const SINONIMOS = {
  GOL: ['gol', 'goleiro', 'goleiros', 'goleira', 'goleiras', 'goleria'],
  ZAG: ['zag', 'zagueiro', 'zagueiros', 'zagueira', 'zaga', 'defensor', 'defensores', 'defesa', 'beque'],
  LAT: ['lat', 'lateral', 'laterais', 'lateral direito', 'lateral esquerdo', 'ala', 'alas', 'ld', 'le'],
  VOL: ['vol', 'volante', 'volantes', 'primeiro volante', 'segundo volante'],
  MEI: ['mei', 'meia', 'meias', 'meio', 'meio campo', 'meio campista', 'meio campistas', 'meio-campo', 'meio-campista', 'meio-campistas', 'meia atacante', 'armador', 'mc'],
  ATA: ['ata', 'atacante', 'atacantes', 'ataque', 'centroavante', 'ponta', 'pontas', 'camisa 9'],
};

export const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '');
const chave = (s) => semAcento(s).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/[\s-]+/g, ' ').trim();
export const nomeIgual = (a, b) => chave(a) === chave(b);

const PALAVRA_PARA_POSICAO = new Map(Object.entries(SINONIMOS).flatMap(([pos, palavras]) => palavras.map((p) => [chave(p), pos])));
const posicaoDe = (texto) => PALAVRA_PARA_POSICAO.get(chave(texto)) ?? null;

// Linha de título de uma seção: "GOLEIROS", "*Zagueiros* (4)", "🛡️ Defensores:" ...
function secaoDaLinha(linha) {
  const base = linha.replace(/[\s*_~]/g, ' ').split(/[(:\[]/)[0];
  const pos = posicaoDe(base);
  if (pos) return pos;
  const palavras = chave(base).split(' ');
  return palavras.length <= 3 && palavras[0] && PALAVRA_PARA_POSICAO.has(palavras[0]) && !/\d/.test(chave(base)) ? PALAVRA_PARA_POSICAO.get(palavras[0]) : null;
}

const EMOJI = /\p{Extended_Pictographic}/gu;
const JUNCAO_EMOJI = /[‍️⃣]/g; // juntam o emoji (1️⃣ vira 1): saem sem deixar espaço
const CABECALHO_ZAP = /^\[?\d{1,2}[/.]\d{1,2}[/.]\d{2,4}[,\s]+\d{1,2}:\d{2}(:\d{2})?\]?\s*(-\s*)?[^:]{1,60}:\s?/;

function limpar(linha) {
  return linha.replace(CABECALHO_ZAP, '').replace(JUNCAO_EMOJI, '').replace(EMOJI, ' ').replace(/[*_~`]/g, '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

const PALAVRAS_DE_NOME = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
export function nomeBonito(nome) {
  const t = nome.replace(/\s+/g, ' ').trim();
  if (t !== t.toUpperCase() && t !== t.toLowerCase()) return t; // já veio capitalizado do jeito do clube
  return t.toLowerCase().split(' ').map((p, i) => (i > 0 && PALAVRAS_DE_NOME.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(' ');
}

// "10 - Lelê" · "Lelê 10" · "10) Lelê" · "Lelê | MEI | 10" · "Lelê - Meia - 10" · "Lelê"
function lerJogador(texto, posicaoDaSecao) {
  let t = texto.replace(/^[\s•·▪▫►▶>*+–—-]+(?=\S)/, '').replace(/\s*[(\[]\s*(c|cap|capit[aã]o)\s*[)\]]\s*/gi, ' ').replace(/©/g, '').trim();
  const partes = t.split(/\s*[|;]\s*|\s+[-–—]\s+/).map((p) => p.trim()).filter(Boolean);
  let numero = null;
  let posicao = null;
  const nome = [];
  for (const p of partes) {
    if (numero === null && /^#?\d{1,3}$/.test(p)) numero = Number(p.replace('#', ''));
    else if (!posicao && posicaoDe(p) && partes.length > 1) posicao = posicaoDe(p);
    else nome.push(p);
  }
  let nomeTexto = nome.join(' - ');
  if (numero === null) {
    const prefixo = nomeTexto.match(/^#?(\d{1,3})\s*[-–—.)\]:º°]*\s*(\D.*)$/);
    const sufixo = nomeTexto.match(/^(\D.*?)\s*[-–—(\[#:nº°]*\s*#?(\d{1,3})\s*[)\]]?$/);
    if (prefixo) { numero = Number(prefixo[1]); nomeTexto = prefixo[2]; } else if (sufixo) { nomeTexto = sufixo[1]; numero = Number(sufixo[2]); }
  }
  nomeTexto = nomeTexto.replace(/^[\s.\-–—:,)]+|[\s.\-–—:,(]+$/g, '').trim();
  return { numero, nome: nomeTexto, posicao: posicao ?? posicaoDaSecao ?? null };
}

const CONVERSA = /^(segue|segue o|obrigad|valeu|boa noite|boa tarde|bom dia|att|abraco|ok|blz|pronto|fim|tmj|fechou)\b/;
const CHAVES = {
  time: /^(time|equipe|clube|nome do time|elenco)\s*[:：]\s*(.+)$/i,
  tecnico: /^(t[eé]cnico|treinador|professor|coach|comiss[aã]o t[eé]cnica)\s*[:：-]\s*(.*)$/i,
  ignorar: /^(responsavel|respons[aá]vel|contato|telefone|whatsapp|zap|obs|observa[cç][aã]o|observa[cç][oõ]es|total|data|cidade|capit[aã]o|capitao)\b/i,
};

// Lê uma ou várias mensagens coladas (cada mensagem começa na linha "Time: ...").
// `times`: [{ id, nome, sigla }] do campeonato, para reconhecer o time pelo nome.
export function lerMensagens(texto, times = []) {
  const clubes = [];
  let atual = null;
  let secao = null;
  const novo = (timeTexto = '') => { atual = { timeTexto, tecnico: '', jogadores: [], avisos: [] }; clubes.push(atual); secao = null; };

  for (const bruta of String(texto ?? '').split(/\r?\n/)) {
    const linha = limpar(bruta);
    if (!linha) continue;
    const achouTime = linha.match(CHAVES.time);
    if (achouTime && !secaoDaLinha(linha)) { novo(achouTime[2].trim()); continue; }
    const achouTecnico = linha.match(CHAVES.tecnico);
    if (achouTecnico) { if (!atual) novo(); atual.tecnico = nomeBonito(achouTecnico[2]); continue; }
    if (CHAVES.ignorar.test(linha)) continue;
    const pos = secaoDaLinha(linha);
    if (pos) { secao = pos; if (!atual) novo(); continue; }
    const j = lerJogador(linha, secao);
    if (!j.nome) continue;
    if (!secao && j.numero == null && !j.posicao) continue; // conversa solta ("Segue o elenco", "Obrigado")
    if (j.numero == null && (j.nome.split(' ').length > 4 || CONVERSA.test(chave(j.nome)))) continue; // frase, não nome
    if (!atual) novo();
    atual.jogadores.push(j);
  }

  return clubes.filter((c) => c.jogadores.length || c.timeTexto || c.tecnico).map((c) => conferir(c, times));
}

// Problemas de cada jogador de um elenco (mesma ordem da lista): nome, posição, número e repetidos
export function avaliarJogadores(jogadores) {
  const problemas = jogadores.map((j) => {
    const lista = [];
    const nome = String(j.nome ?? '').trim();
    if (nome.length < 2 || !/\p{L}{2}/u.test(nome)) lista.push('nome muito curto');
    if (nome.length > 40) lista.push('nome com mais de 40 letras');
    if (!j.posicao) lista.push('sem posição');
    if (j.numero != null && (j.numero < 0 || j.numero > 99)) lista.push('número fora de 0 a 99');
    return lista;
  });
  const porNumero = new Map();
  const porNome = new Map();
  jogadores.forEach((j, i) => {
    if (j.numero != null) porNumero.set(j.numero, [...(porNumero.get(j.numero) ?? []), i]);
    porNome.set(chave(j.nome), [...(porNome.get(chave(j.nome)) ?? []), i]);
  });
  for (const [n, idx] of porNumero) if (idx.length > 1) idx.forEach((i) => problemas[i].push('número ' + n + ' repetido'));
  for (const idx of porNome.values()) if (idx.length > 1) idx.slice(1).forEach((i) => problemas[i].push('nome repetido'));
  return problemas;
}

function conferir(clube, times) {
  const avisos = [];
  const time = reconhecerTime(clube.timeTexto, times);
  if (!clube.timeTexto) avisos.push('Mensagem sem a linha "Time:". Escolha o time.');
  else if (!time) avisos.push('Não encontrei o time "' + clube.timeTexto + '". Escolha o time na lista.');
  const jogadores = clube.jogadores.map((j) => ({ ...j, nome: nomeBonito(j.nome) }));
  const problemas = avaliarJogadores(jogadores);
  return { ...clube, time, avisos, jogadores: jogadores.map((j, i) => ({ ...j, problemas: problemas[i] })) };
}

// Acha o time pelo nome ou sigla escrito pelo clube (sem acento, sem maiúsculas); null se não tiver certeza
export function reconhecerTime(texto, times) {
  const c = chave(texto);
  if (!c) return null;
  const exato = times.find((t) => chave(t.nome) === c || (t.sigla && chave(t.sigla) === c));
  if (exato) return exato;
  const parecidos = times.filter((t) => c.length >= 3 && (chave(t.nome).includes(c) || c.includes(chave(t.nome))));
  return parecidos.length === 1 ? parecidos[0] : null;
}

// ---------- Mensagem que o clube envia ----------
// jogadores: [{ numero, nome, posicao }] · devolve o texto pronto para o WhatsApp
export function montarMensagem({ time, tecnico = '', jogadores = [] }) {
  const linhas = ['📋 *ELENCO · CAMPEONATO SRP*', `Time: ${time}`, `Técnico: ${tecnico || '-'}`];
  let total = 0;
  for (const [pos, rotulo, emoji] of SECOES) {
    const da = jogadores.filter((j) => j.posicao === pos && j.nome.trim());
    if (!da.length) continue;
    total += da.length;
    linhas.push('', `${emoji} *${rotulo}*`, ...da.map((j) => (j.numero != null && j.numero !== '' ? `${j.numero} - ${j.nome.trim()}` : j.nome.trim())));
  }
  linhas.push('', `Total: ${total} jogadores`);
  return linhas.join('\n');
}

// Mensagem em branco para o organizador mandar aos clubes que preferem digitar no próprio WhatsApp
// (sem jogador de exemplo: se voltasse sem preencher, o exemplo seria importado como jogador)
export function modeloEmBranco() {
  return ['📋 *ELENCO · CAMPEONATO SRP*', 'Time: ', 'Técnico: ', ...SECOES.flatMap(([, rotulo, emoji]) => ['', `${emoji} *${rotulo}*`, ''])].join('\n');
}
