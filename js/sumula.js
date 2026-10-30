// Súmula do organizador: lançar e editar o resultado marcando cada gol como Pró, Pênalti ou Contra.
// O placar sai da conta dos gols (nunca fica diferente da lista) e a ordem da lista é a ordem dos gols na partida.
// Serve ao jogo encerrado (editar resultado), ao jogo em andamento (marcar gol ao vivo) e ao jogo agendado.
import { salvarResultado, reabrirJogo } from './api.js';
import { escapar, escudo } from './ui.js';
import { golsOrdenados, tipoDoGol, textoDoGol } from './golsDoJogo.js';

const TIPOS = {
  gol: { rotulo: 'Gol pró', icone: '⚽', titulo: 'Gol' },
  penalti: { rotulo: 'Pênalti', icone: '🥅', titulo: 'Gol de pênalti' },
  contra: { rotulo: 'Contra', icone: '↩', titulo: 'Gol contra' },
};

// "Dudú", "dudu " e "DUDU" são o mesmo jogador
const normalizarNome = (nome) => String(nome ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Folha que sobe de baixo no celular; não fecha as outras janelas (o seletor de autor abre por cima da súmula)
export function criarFolha(html, classe) {
  const d = document.createElement('dialog');
  d.className = `dialogo dialogo--folha ${classe}`;
  d.innerHTML = html;
  d.addEventListener('close', () => d.remove());
  document.body.append(d);
  d.showModal();
  return d;
}

// ---------- Gols do jogo como lista de lances ----------
// Um lance = um gol: { time_id (quem recebe o gol), nome (autor), tipo: 'gol' | 'penalti' | 'contra' }
function lancesDoJogo(jogo) {
  const lances = golsOrdenados(jogo).flatMap((g) =>
    Array.from({ length: Math.max(1, g.quantidade ?? 1) }, () => ({ time_id: g.time_id, nome: g.jogador?.nome ?? '', tipo: tipoDoGol(g) })));
  // placar sem autores (ex.: marcado só no +/− de uma versão antiga): entram como "autor não informado"
  for (const [timeId, total] of [[jogo.mandante_id, jogo.gols_mandante ?? 0], [jogo.visitante_id, jogo.gols_visitante ?? 0]]) {
    for (let faltam = total - lances.filter((l) => l.time_id === timeId).length; faltam > 0; faltam--) lances.push({ time_id: timeId, nome: '', tipo: 'gol' });
  }
  return lances;
}

const placarDosLances = (jogo, lances) => [
  lances.filter((l) => l.time_id === jogo.mandante_id).length,
  lances.filter((l) => l.time_id === jogo.visitante_id).length,
];

const gravar = (jogo, lances, encerrar) => {
  const [gm, gv] = placarDosLances(jogo, lances);
  return salvarResultado(jogo.id, gm, gv, lances.map((l) => ({
    time_id: l.time_id, jogador_nome: l.nome.trim(), quantidade: 1, contra: l.tipo === 'contra', penalti: l.tipo === 'penalti',
  })), encerrar);
};

// ---------- Escolha do autor ----------
// Devolve o nome escolhido, '' (sem autor) ou null (cancelou)
function escolherAutor({ jogo, jogadores, timeId, tipo, atual = '' }) {
  const adversario = timeId === jogo.mandante_id ? jogo.visitante : jogo.mandante;
  const favorecido = timeId === jogo.mandante_id ? jogo.mandante : jogo.visitante;
  const autorTime = tipo === 'contra' ? adversario : favorecido;
  const elenco = jogadores
    .filter((j) => j.time_id === autorTime.id && j.ativo !== false)
    .sort((a, b) => (a.numero ?? 999) - (b.numero ?? 999) || a.nome.localeCompare(b.nome));
  const pergunta = tipo === 'contra'
    ? `Gol contra a favor do <b>${escapar(favorecido.nome)}</b>. Quem do <b>${escapar(adversario.nome)}</b> fez?`
    : `<b>${escapar(favorecido.nome)}</b> · quem fez o gol?`;

  return new Promise((resolver) => {
    let resposta = null;
    const d = criarFolha(`
      <div class="folha__topo"><h2>${TIPOS[tipo].icone} ${TIPOS[tipo].titulo}</h2><button class="link-botao" type="button" data-cancelar>Cancelar</button></div>
      <p class="texto-2 texto-pequeno">${pergunta}</p>
      <input class="picker__busca" type="search" placeholder="Buscar ou digitar o nome" autocomplete="off" autocapitalize="words" value="${escapar(atual)}" aria-label="Nome do jogador">
      <div class="picker__lista"></div>
      <button class="botao picker__novo oculto" type="button"></button>
      <button class="link-botao picker__sem" type="button">Sem autor por enquanto</button>`, 'picker');
    const busca = d.querySelector('.picker__busca');
    const lista = d.querySelector('.picker__lista');
    const novo = d.querySelector('.picker__novo');
    const escolher = (nome) => { resposta = nome; d.close(); };

    const desenhar = () => {
      const termo = normalizarNome(busca.value);
      const achados = elenco.filter((j) => !termo || normalizarNome(j.nome).includes(termo));
      lista.innerHTML = achados.map((j) => `
        <button class="picker__jogador${normalizarNome(j.nome) === normalizarNome(atual) ? ' picker__jogador--atual' : ''}" type="button" data-nome="${escapar(j.nome)}">
          <b>${j.numero ?? '–'}</b><span>${escapar(j.nome)}</span></button>`).join('')
        || (elenco.length ? '<p class="texto-2 texto-pequeno">Ninguém com esse nome no elenco.</p>' : '<p class="texto-2 texto-pequeno">Elenco ainda sem jogadores: digite o nome.</p>');
      const exato = elenco.some((j) => normalizarNome(j.nome) === termo);
      const digitado = busca.value.trim();
      novo.classList.toggle('oculto', !digitado || exato);
      novo.textContent = `+ Usar “${digitado}” (jogador novo)`;
    };

    d.addEventListener('click', (e) => {
      if (e.target.closest('[data-cancelar]')) { d.close(); return; }
      if (e.target.closest('.picker__sem')) { escolher(''); return; }
      if (e.target.closest('.picker__novo')) { escolher(busca.value.trim()); return; }
      const jogador = e.target.closest('[data-nome]');
      if (jogador) escolher(jogador.dataset.nome);
    });
    busca.addEventListener('input', desenhar);
    busca.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const termo = normalizarNome(busca.value);
      const achados = elenco.filter((j) => normalizarNome(j.nome).includes(termo));
      if (achados.length === 1) escolher(achados[0].nome);
      else if (busca.value.trim()) escolher(busca.value.trim());
    });
    d.addEventListener('close', () => resolver(resposta));
    desenhar();
    if (!elenco.length) busca.focus(); // com elenco, os botões vêm primeiro (o teclado não cobre a lista)
  });
}

// ---------- Botões Gol pró / Pênalti / Contra ----------
const botoesDoTime = (time, atributo) => `
  <div class="sumula__coluna">
    <span class="sumula__coluna-nome">${escudo(time, 32)}<b>${escapar(time.nome)}</b></span>
    ${Object.entries(TIPOS).map(([tipo, t]) => `
      <button class="gol-btn gol-btn--${tipo}" type="button" ${atributo}="${time.id}:${tipo}">
        <span aria-hidden="true">${t.icone}</span>${t.rotulo}</button>`).join('')}
  </div>`;

// ---------- Janela da súmula (lançar, editar, encerrar) ----------
export function abrirSumula(jogo, jogadores, { executar }) {
  const lances = lancesDoJogo(jogo);
  const encerrado = jogo.status === 'encerrado';
  const aoVivo = jogo.status === 'ao_vivo';
  let alterado = false;
  const titulo = encerrado ? 'Editar resultado' : aoVivo ? 'Encerrar jogo' : 'Lançar resultado';
  const status = encerrado ? 'Encerrado' : aoVivo ? 'Ao vivo' : 'Agendado';

  const d = criarFolha(`
    <div class="sumula">
      <div class="folha__topo">
        <div><span class="sumula__status sumula__status--${jogo.status}">${status}</span><h2>${titulo}</h2></div>
        <button class="link-botao" type="button" data-fechar aria-label="Fechar">✕</button>
      </div>
      <div class="sumula__placar">
        <div class="sumula__time">${escudo(jogo.mandante, 48)}<span>${escapar(jogo.mandante.nome)}</span></div>
        <div class="sumula__numeros" aria-live="polite"><b data-pm>0</b><i>×</i><b data-pv>0</b></div>
        <div class="sumula__time">${escudo(jogo.visitante, 48)}<span>${escapar(jogo.visitante.nome)}</span></div>
      </div>
      <p class="sumula__dica texto-2 texto-pequeno">Toque no tipo de gol do time que marcou e escolha o jogador.</p>
      <div class="sumula__botoes">${botoesDoTime(jogo.mandante, 'data-novo')}${botoesDoTime(jogo.visitante, 'data-novo')}</div>
      <section class="sumula__gols-bloco">
        <h3>Gols da partida</h3>
        <ol class="sumula__gols"></ol>
        <p class="aviso texto-pequeno oculto" data-aviso></p>
        ${encerrado ? '<button class="link-botao sumula__reabrir" type="button" data-reabrir>Reabrir jogo (apaga placar e gols)</button>' : ''}
      </section>
      <div class="sumula__rodape">
        <button class="botao botao--secundario" type="button" data-fechar>Cancelar</button>
        ${encerrado ? '' : '<button class="botao botao--secundario" type="button" data-salvar="parcial">Manter ao vivo</button>'}
        <button class="botao" type="button" data-salvar="encerrar">${encerrado ? 'Salvar alterações' : 'Encerrar e salvar'}</button>
      </div>
    </div>`, 'sumula-folha');

  const desenhar = () => {
    const [pm, pv] = placarDosLances(jogo, lances);
    d.querySelector('[data-pm]').textContent = pm;
    d.querySelector('[data-pv]').textContent = pv;
    d.querySelector('.sumula__gols').innerHTML = lances.map((l, i) => `
      <li class="sumula__gol sumula__gol--${l.time_id === jogo.mandante_id ? 'm' : 'v'} sumula__gol--${l.tipo}">
        <button class="sumula__autor" type="button" data-editar="${i}" title="Trocar o jogador">
          <span class="sumula__icone" aria-hidden="true">${TIPOS[l.tipo].icone}</span>
          <span class="sumula__nome${l.nome || l.tipo === 'contra' ? '' : ' sumula__nome--vazio'}">${escapar(l.nome || l.tipo === 'contra' ? textoDoGol({ nome: l.nome, tipo: l.tipo, quantidade: 1 }) : `Sem autor${l.tipo === 'penalti' ? ' (p)' : ''}`)}</span>
        </button>
        <button class="sumula__remover" type="button" data-remover="${i}" aria-label="Remover este gol">✕</button>
      </li>`).join('') || '<li class="sumula__vazio texto-2">Nenhum gol lançado (0 × 0).</li>';
    const semAutor = lances.filter((l) => !l.nome.trim() && l.tipo !== 'contra').length;
    const aviso = d.querySelector('[data-aviso]');
    aviso.textContent = semAutor ? `${semAutor} gol${semAutor === 1 ? '' : 's'} sem autor: conta${semAutor === 1 ? '' : 'm'} no placar, mas não na artilharia. Toque no gol para escolher o jogador.` : '';
    aviso.classList.toggle('oculto', !semAutor);
  };

  const tentarFechar = () => { if (!alterado || confirm('Descartar as alterações deste resultado?')) d.close(); };
  d.addEventListener('cancel', (e) => { if (alterado && !confirm('Descartar as alterações deste resultado?')) e.preventDefault(); });

  const salvar = (encerrar) => executar(async () => { await gravar(jogo, lances, encerrar); d.close(); },
    encerrar ? 'Resultado salvo ✔' : 'Placar salvo — jogo segue ao vivo ✔');

  d.addEventListener('click', async (e) => {
    if (e.target.closest('[data-fechar]')) { tentarFechar(); return; }
    const novo = e.target.closest('[data-novo]');
    if (novo) {
      const [timeId, tipo] = novo.dataset.novo.split(':');
      const nome = await escolherAutor({ jogo, jogadores, timeId: Number(timeId), tipo });
      if (nome === null) return;
      lances.push({ time_id: Number(timeId), nome, tipo });
      alterado = true;
      desenhar();
      return;
    }
    const editar = e.target.closest('[data-editar]');
    if (editar) {
      const lance = lances[Number(editar.dataset.editar)];
      const nome = await escolherAutor({ jogo, jogadores, timeId: lance.time_id, tipo: lance.tipo, atual: lance.nome });
      if (nome === null) return;
      lance.nome = nome;
      alterado = true;
      desenhar();
      return;
    }
    const remover = e.target.closest('[data-remover]');
    if (remover) { lances.splice(Number(remover.dataset.remover), 1); alterado = true; desenhar(); return; }
    const botaoSalvar = e.target.closest('[data-salvar]');
    if (botaoSalvar) { salvar(botaoSalvar.dataset.salvar === 'encerrar'); return; }
    if (e.target.closest('[data-reabrir]') && confirm('Reabrir o jogo apaga o placar e os gols lançados. Continuar?')) {
      executar(async () => { await reabrirJogo(jogo.id); d.close(); }, 'Jogo reaberto');
    }
  });
  desenhar();
}

// ---------- Painel "ao vivo" no card do jogo ----------
export const painelAoVivo = (jogo) => `
  <div class="aovivo" data-aovivo="${jogo.id}">
    <p class="aovivo__titulo"><span class="ponto-vivo" aria-hidden="true"></span>Marcar gol ao vivo</p>
    <div class="sumula__botoes">${botoesDoTime(jogo.mandante, 'data-aovivo-gol')}${botoesDoTime(jogo.visitante, 'data-aovivo-gol')}</div>
    <div class="aovivo__acoes">
      ${(jogo.gols_mandante ?? 0) + (jogo.gols_visitante ?? 0) > 0 ? '<button class="link-botao" type="button" data-desfazer>↶ Desfazer último gol</button>' : '<span></span>'}
      <button class="botao botao--secundario botao--pequeno" type="button" data-sumula>Editar gols / Encerrar</button>
    </div>
  </div>`;

export function ligarMarcacaoAoVivo(raiz, jogos, jogadores, { executar }) {
  raiz.querySelectorAll('[data-aovivo]').forEach((painel) => {
    const jogo = jogos.find((j) => j.id === Number(painel.dataset.aovivo));
    painel.addEventListener('click', async (e) => {
      const botao = e.target.closest('[data-aovivo-gol]');
      if (botao) {
        const [timeId, tipo] = botao.dataset.aovivoGol.split(':');
        const nome = await escolherAutor({ jogo, jogadores, timeId: Number(timeId), tipo });
        if (nome === null) return;
        const lances = [...lancesDoJogo(jogo), { time_id: Number(timeId), nome, tipo }];
        executar(() => gravar(jogo, lances, false), 'Gol marcado ✔');
        return;
      }
      if (e.target.closest('[data-desfazer]')) {
        const lances = lancesDoJogo(jogo);
        const ultimo = lances.pop();
        if (ultimo && confirm(`Desfazer o último gol (${textoDoGol({ nome: ultimo.nome, tipo: ultimo.tipo, quantidade: 1 })})?`)) {
          executar(() => gravar(jogo, lances, false), 'Gol desfeito');
        }
        return;
      }
      if (e.target.closest('[data-sumula]')) abrirSumula(jogo, jogadores, { executar });
    });
  });
}
