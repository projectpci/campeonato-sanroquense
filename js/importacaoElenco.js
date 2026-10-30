// Painel do organizador: "Elenco por WhatsApp".
// 1) Enviar aos clubes: link do formulário (geral e por time) e mensagem pronta para o WhatsApp.
// 2) Importar: cola as mensagens recebidas, confere o que foi reconhecido e importa em massa.
import { importarElenco } from './api.js';
import { escapar, escudo, toast } from './ui.js';
import { criarFolha } from './sumula.js';
import { SECOES, lerMensagens, avaliarJogadores, nomeIgual, modeloEmBranco } from './importarElenco.js';

const slug = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const linkDoFormulario = (time) => {
  const url = new URL('cadastro-elenco.html', location.href);
  if (time) { url.searchParams.set('time', time.id); url.searchParams.set('clube', slug(time.nome)); } // o nome só deixa o link reconhecível
  return url.href;
};
// Mensagem pronta com o nome do time (negrito do WhatsApp), para o responsável saber de qual elenco se trata
const convite = (link, time) => `Olá${time ? `, responsável pelo *${time.nome}*` : ''}! Para agilizar o cadastro do elenco${time ? ` do *${time.nome}*` : ''} no app do Campeonato SRP, preencha o formulário pelo celular (leva poucos minutos). No fim, toque em *Enviar* e mande a lista de volta no WhatsApp:\n${link}`;
const linkZap = (texto) => `https://wa.me/?text=${encodeURIComponent(texto)}`;
const copiar = async (texto, ok = 'Copiado ✔') => { try { await navigator.clipboard.writeText(texto); toast(ok); } catch { toast('Não foi possível copiar.', true); } };

export function abrirElencoWhatsApp({ times, jogadores, executar }) {
  const ativos = times.filter((t) => t.ativo !== false);
  const d = criarFolha(`
    <div class="importar">
      <div class="folha__topo"><h2>Elenco por WhatsApp</h2><button class="link-botao" type="button" data-fechar aria-label="Fechar">✕</button></div>
      <div class="segmentos" role="tablist">
        <button class="segmento segmento--ativo" data-painel="enviar" role="tab">1 · Enviar</button>
        <button class="segmento" data-painel="importar" role="tab">2 · Importar</button>
      </div>

      <section data-painel-conteudo="enviar" class="importar__painel">
        <p class="texto-2 texto-pequeno">Mande o link para os clubes. Eles preenchem pelo celular e enviam a lista de volta pelo WhatsApp, já no formato que o sistema reconhece.</p>
        <div class="importar__geral">
          <input readonly value="${escapar(linkDoFormulario())}" aria-label="Link do formulário" data-link-geral>
          <button class="botao botao--secundario botao--pequeno" type="button" data-copiar-link="">Copiar</button>
          <a class="botao botao--pequeno" target="_blank" rel="noopener" href="${escapar(linkZap(convite(linkDoFormulario())))}">WhatsApp</a>
        </div>
        <h3>Link por time <small class="texto-2">(o time já vem escolhido)</small></h3>
        <ul class="importar__times">${ativos.map((t) => `
          <li>${escudo(t, 32)}<span>${escapar(t.nome)}</span>
            <button class="botao botao--secundario botao--pequeno" type="button" data-copiar-link="${t.id}">Copiar</button>
            <a class="botao botao--pequeno" target="_blank" rel="noopener" href="${escapar(linkZap(convite(linkDoFormulario(t), t)))}">WhatsApp</a>
          </li>`).join('')}</ul>
        <h3>Prefere que o clube digite no WhatsApp?</h3>
        <p class="texto-2 texto-pequeno">Copie o modelo e envie. O sistema também lê mensagens digitadas à mão (número - nome, por posição).</p>
        <button class="botao botao--secundario" type="button" data-copiar-modelo>Copiar modelo em branco</button>
      </section>

      <section data-painel-conteudo="importar" class="importar__painel oculto">
        <div data-passo="colar">
          <p class="texto-2 texto-pequeno">Cole aqui as mensagens recebidas. Pode colar várias de uma vez, de vários times: cada uma começa na linha "Time:".</p>
          <textarea class="importar__texto" rows="9" placeholder="Cole as mensagens do WhatsApp…" aria-label="Mensagens recebidas" data-texto></textarea>
          <div class="form__acoes"><button class="botao" type="button" data-ler disabled>Ler mensagens</button></div>
        </div>
        <div data-passo="conferir" class="oculto"></div>
      </section>
    </div>`, 'importar-folha');

  const painel = (nome) => {
    d.querySelectorAll('[data-painel]').forEach((b) => b.classList.toggle('segmento--ativo', b.dataset.painel === nome));
    d.querySelectorAll('[data-painel-conteudo]').forEach((s) => s.classList.toggle('oculto', s.dataset.painelConteudo !== nome));
  };

  // ---------- Passo 2: conferir ----------
  const conferir = d.querySelector('[data-passo="conferir"]');
  const colar = d.querySelector('[data-passo="colar"]');
  const texto = d.querySelector('[data-texto]');

  const htmlJogador = (j) => `
    <div class="importar__jogador" data-jogador>
      <input type="checkbox" data-inc checked aria-label="Importar este jogador">
      <input class="importar__num" inputmode="numeric" maxlength="2" placeholder="Nº" value="${j.numero ?? ''}" data-num aria-label="Número">
      <input class="importar__nome" maxlength="40" value="${escapar(j.nome)}" data-nome aria-label="Nome">
      <select data-pos aria-label="Posição"><option value="">Posição</option>${SECOES.map(([p]) => `<option value="${p}"${j.posicao === p ? ' selected' : ''}>${p}</option>`).join('')}</select>
      <small class="importar__estado" data-estado></small>
    </div>`;

  const htmlClube = (c, i) => `
    <article class="importar__clube" data-clube="${i}">
      <header>
        <select data-time aria-label="Time desta mensagem"><option value="">Escolha o time…</option>${ativos.map((t) => `<option value="${t.id}"${c.time?.id === t.id ? ' selected' : ''}>${escapar(t.nome)}</option>`).join('')}</select>
        <span class="importar__contagem" data-contagem></span>
      </header>
      ${c.avisos.map((a) => `<p class="aviso texto-pequeno">${escapar(a)}</p>`).join('')}
      ${c.tecnico ? `<label class="campo campo--check importar__tecnico"><input type="checkbox" data-tecnico checked> Técnico: <b>${escapar(c.tecnico)}</b></label>` : ''}
      <div class="importar__jogadores">${c.jogadores.map(htmlJogador).join('')}</div>
    </article>`;

  const lerLinha = (el) => ({
    incluir: el.querySelector('[data-inc]').checked,
    nome: el.querySelector('[data-nome]').value.trim(),
    numero: el.querySelector('[data-num]').value === '' ? null : Number(el.querySelector('[data-num]').value),
    posicao: el.querySelector('[data-pos]').value || null,
  });
  const NOME_INVALIDO = ['nome muito curto', 'nome com mais de 40 letras'];

  // Atualiza o estado de cada linha (novo, atualiza, igual, aviso) e as contagens
  function reavaliar() {
    let total = 0;
    conferir.querySelectorAll('[data-clube]').forEach((clube) => {
      const timeId = Number(clube.querySelector('[data-time]').value) || null;
      const existentes = jogadores.filter((j) => j.time_id === timeId);
      const linhas = [...clube.querySelectorAll('[data-jogador]')];
      const dados = linhas.map(lerLinha);
      const incluidos = dados.map((x, i) => (x.incluir ? i : -1)).filter((i) => i >= 0);
      const problemas = avaliarJogadores(incluidos.map((i) => dados[i]));
      let novos = 0;
      let atualiza = 0;
      linhas.forEach((el, i) => {
        const x = dados[i];
        const estado = el.querySelector('[data-estado]');
        el.classList.toggle('importar__jogador--fora', !x.incluir);
        const p = problemas[incluidos.indexOf(i)] ?? [];
        if (!x.incluir) { estado.textContent = 'não será importado'; estado.className = 'importar__estado'; return; }
        const ja = existentes.find((e) => nomeIgual(e.nome, x.nome));
        const igual = ja && (x.numero == null || ja.numero === x.numero) && (!x.posicao || ja.posicao === x.posicao);
        const invalido = p.some((t) => NOME_INVALIDO.includes(t));
        if (!invalido && timeId) { if (!ja) novos++; else if (!igual) atualiza++; }
        if (!invalido && timeId && (!ja || !igual)) total++; // quem já está igual no time não conta
        const base = !timeId ? 'escolha o time' : ja ? (igual ? 'já cadastrado' : 'atualiza número/posição') : 'novo';
        estado.textContent = [base, ...p].join(' · ');
        estado.className = `importar__estado${invalido ? ' importar__estado--erro' : p.length || !timeId ? ' importar__estado--aviso' : !ja ? ' importar__estado--novo' : ''}`;
      });
      clube.querySelector('[data-contagem]').textContent = `${novos} novo${novos === 1 ? '' : 's'} · ${atualiza} atualiza${atualiza === 1 ? '' : 'm'}`;
      clube.classList.toggle('importar__clube--sem-time', !timeId);
    });
    const botao = conferir.querySelector('[data-importar]');
    botao.textContent = total ? `Importar ${total} jogador${total === 1 ? '' : 'es'}` : 'Nada para importar';
    botao.disabled = !total;
  }

  function mostrarPrevia(clubes) {
    if (!clubes.length) { toast('Não encontrei nenhum elenco nesse texto. Confira se a mensagem tem "Time:" e os jogadores.', true); return; }
    conferir.innerHTML = `
      <p class="texto-2 texto-pequeno">Confira o que o sistema entendeu. Corrija nome, número ou posição, e desmarque quem não deve entrar. Quem já está no time só recebe número e posição; ninguém é apagado.</p>
      ${clubes.map(htmlClube).join('')}
      <div class="importar__rodape">
        <button class="botao botao--secundario" type="button" data-voltar>Voltar</button>
        <button class="botao" type="button" data-importar>Importar</button>
      </div>`;
    colar.classList.add('oculto');
    conferir.classList.remove('oculto');
    reavaliar();
    d.scrollTo({ top: 0 });
  }

  function importar() {
    const lotes = [];
    let semTime = 0;
    conferir.querySelectorAll('[data-clube]').forEach((clube) => {
      const timeId = Number(clube.querySelector('[data-time]').value) || null;
      const linhas = [...clube.querySelectorAll('[data-jogador]')].map(lerLinha).filter((x) => x.incluir);
      const validos = linhas.filter((x) => x.nome.length >= 2 && x.nome.length <= 40);
      if (!validos.length) return;
      if (!timeId) { semTime += validos.length; return; }
      const tecnico = clube.querySelector('[data-tecnico]')?.checked ? clube.querySelector('.importar__tecnico b').textContent : '';
      lotes.push({ time_id: timeId, tecnico, jogadores: validos });
    });
    if (semTime) { toast(`Escolha o time de todas as mensagens (faltam ${semTime} jogadores).`, true); return; }
    const n = lotes.reduce((s, l) => s + l.jogadores.length, 0);
    if (!n || !confirm(`Importar ${n} jogador${n === 1 ? '' : 'es'} em ${lotes.length} time${lotes.length === 1 ? '' : 's'}?`)) return;
    const botao = conferir.querySelector('[data-importar]');
    botao.disabled = true;
    executar(async () => {
      const r = await importarElenco(lotes);
      d.close();
      toast(`Importado ✔ ${r.novos} novo${r.novos === 1 ? '' : 's'}, ${r.atualizados} atualizado${r.atualizados === 1 ? '' : 's'}${r.tecnicos ? `, ${r.tecnicos} técnico${r.tecnicos === 1 ? '' : 's'}` : ''}`);
    }).finally(() => { botao.disabled = false; });
  }

  d.addEventListener('click', (e) => {
    if (e.target.closest('[data-fechar]')) { d.close(); return; }
    const aba = e.target.closest('[data-painel]');
    if (aba) { painel(aba.dataset.painel); return; }
    const link = e.target.closest('[data-copiar-link]');
    if (link) {
      const time = ativos.find((t) => t.id === Number(link.dataset.copiarLink));
      copiar(convite(linkDoFormulario(time), time), time ? `Mensagem do ${time.nome} copiada ✔` : 'Mensagem copiada ✔');
      return;
    }
    if (e.target.closest('[data-copiar-modelo]')) { copiar(modeloEmBranco(), 'Modelo copiado ✔'); return; }
    if (e.target.closest('[data-ler]')) { mostrarPrevia(lerMensagens(texto.value, times)); return; }
    if (e.target.closest('[data-voltar]')) { conferir.classList.add('oculto'); colar.classList.remove('oculto'); return; }
    if (e.target.closest('[data-importar]')) importar();
  });
  texto.addEventListener('input', () => { d.querySelector('[data-ler]').disabled = !texto.value.trim(); });
  conferir.addEventListener('input', (e) => { if (e.target.matches('[data-num]')) e.target.value = e.target.value.replace(/\D/g, '').slice(0, 2); reavaliar(); });
  conferir.addEventListener('change', reavaliar);
}
