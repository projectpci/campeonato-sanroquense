import { buscarCampeonato, buscarClassificacao, buscarArtilharia, listarJogos, listarJogosEncerrados, listarRodadas } from '../api.js';
import { ordenarClassificacao } from '../classificacao.js';
import { assinarMudancas } from '../realtime.js';
import { cartaoJogo } from '../cartaoJogo.js';
import { carregarComCache } from '../cache.js';
import { botaoAvisos } from '../avisos.js';
import { CANAL_WHATSAPP } from '../supabase.js';
import { montarLayout, checarConfiguracao, mostrarCarregando, mostrarAviso, escapar, escudo, icone } from '../ui.js';

const app = document.getElementById('app');
const CLASSES_PODIO = ['ouro', 'prata', 'bronze'];

function htmlHero(c) {
  return `
    <section class="hero">
      <h1>${escapar(c.nome)}</h1>
      <div class="hero__info">
        <div class="card card--neon"><small>Local</small>${escapar(c.local ?? '—')}</div>
        <div class="card card--neon"><small>Organização</small>${escapar(c.organizacao ?? '—')}</div>
      </div>
    </section>`;
}

function htmlSecaoJogos(titulo, rodada, jogos) {
  if (!rodada || !jogos.length) return '';
  return `<section class="secao"><h3>${titulo} · Rodada ${rodada.numero}</h3>${jogos.map(cartaoJogo).join('')}</section>`;
}

function htmlTop4(linhas) {
  const corpo = linhas.slice(0, 4).map((t) => {
    const classe = CLASSES_PODIO[t.posicao - 1];
    return `<tr><td class="pos ${classe ?? ''}">${classe ? icone('coroa') : ''} ${t.posicao}º</td>
      <td class="time"><a class="time__nome" href="time.html?id=${t.time_id}">${escudo(t, 32)} ${escapar(t.nome)}</a></td><td class="pts">${t.pts}</td></tr>`;
  }).join('');
  return `
    <section class="secao"><h3>Classificação</h3>
      <div class="tabela-rolagem"><table class="tabela">
        <thead><tr><th>Pos</th><th>Time</th><th>PTS</th></tr></thead><tbody>${corpo}</tbody></table></div>
      <p><a href="classificacao.html">Ver tabela completa →</a></p>
    </section>`;
}

function htmlArtilheiros(artilharia) {
  if (!artilharia.length) return '';
  const maior = Number(artilharia[0].gols);
  const lideres = artilharia.filter((a) => Number(a.gols) === maior);
  const itens = lideres.map((a) => `
    <div class="card card--neon artilheiro">
      <span class="artilheiro__pos ouro">${icone('coroa')}</span>
      <div><div class="artilheiro__nome">${escapar(a.jogador)}</div>
        <div class="artilheiro__time">${escudo({ nome: a.time, escudo_url: a.escudo_url }, 32)} ${escapar(a.time)}</div></div>
      <span class="artilheiro__gols">${a.gols}</span>
    </div>`).join('');
  return `<section class="secao"><h3>Artilheiro${lideres.length > 1 ? 's' : ''}</h3>${itens}
    <p><a href="artilharia.html">Ver artilharia →</a></p></section>`;
}

// ---------- Destaque: jogos de hoje (ao vivo primeiro) ou o próximo dia de jogos ----------
const mesmoDia = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const diasAte = (iso) => Math.round((new Date(new Date(iso).toDateString()) - new Date(new Date().toDateString())) / 86400000);

function htmlDestaque(jogos) {
  const agora = new Date();
  const aoVivo = jogos.filter((j) => j.status === 'ao_vivo');
  const hoje = jogos.filter((j) => j.status !== 'ao_vivo' && j.data_hora && mesmoDia(j.data_hora, agora));
  if (aoVivo.length || hoje.length) {
    const titulo = aoVivo.length ? 'Ao vivo agora' : 'Jogos de hoje';
    const lista = [...aoVivo, ...hoje];
    return { ids: lista.map((j) => j.id), html: `<section class="secao secao--destaque"><h3>${titulo}</h3>${lista.map(cartaoJogo).join('')}</section>` };
  }
  const proximo = jogos.find((j) => j.status === 'agendado' && j.data_hora && new Date(j.data_hora) > agora);
  if (!proximo) return { ids: [], html: '' };
  const dia = jogos.filter((j) => j.status === 'agendado' && j.data_hora && mesmoDia(j.data_hora, proximo.data_hora));
  const n = diasAte(proximo.data_hora);
  const quando = n <= 0 ? 'hoje' : n === 1 ? 'amanhã' : `em ${n} dias`;
  const data = new Date(proximo.data_hora).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
  return { ids: dia.map((j) => j.id), html: `<section class="secao secao--destaque"><h3>Próximos jogos · ${quando}</h3>
    <p class="texto-2 texto-pequeno">${escapar(data)}</p>${dia.map(cartaoJogo).join('')}</section>` };
}

async function buscar() {
  const [campeonato, rodadas, jogos, encerrados, linhas, artilharia] = await Promise.all([
    buscarCampeonato(), listarRodadas(), listarJogos(), listarJogosEncerrados(), buscarClassificacao(), buscarArtilharia(),
  ]);
  return { campeonato, rodadas, jogos, encerrados, linhas, artilharia };
}

function desenhar({ campeonato, rodadas, jogos, encerrados, linhas, artilharia }) {
    const porRodada = (r) => jogos.filter((j) => j.rodada_id === r?.id);
    const destaque = htmlDestaque(jogos);
    const proxima = rodadas.find((r) => porRodada(r).some((j) => j.status === 'agendado' && !destaque.ids.includes(j.id)));
    const ultimaEncerrada = [...rodadas].reverse().find((r) => porRodada(r).some((j) => j.status === 'encerrado'));

    app.innerHTML = `
      ${htmlHero(campeonato)}
      ${destaque.html}
      <div id="avisos-geral"></div>
      ${htmlSecaoJogos('Próxima rodada', proxima, porRodada(proxima).filter((j) => j.status === 'agendado' && !destaque.ids.includes(j.id)))}
      ${htmlSecaoJogos('Últimos resultados', ultimaEncerrada, porRodada(ultimaEncerrada).filter((j) => j.status === 'encerrado'))}
      ${htmlTop4(ordenarClassificacao(linhas, encerrados))}
      ${htmlArtilheiros(artilharia)}
      ${CANAL_WHATSAPP ? `<p class="centro"><a class="botao" href="${escapar(CANAL_WHATSAPP)}" target="_blank" rel="noopener">${icone('whatsapp')} Entrar no canal do WhatsApp</a></p>` : ''}
      <p class="rodape-frase">Juntos pelo futebol de nossa comunidade!</p>
      <p class="centro texto-pequeno"><a class="texto-2" href="instalar.html">Instalar o app</a> · <a class="texto-2" href="index.html">Trocar perfil</a></p>`;
    botaoAvisos(document.getElementById('avisos-geral'));
}

async function carregar() {
  try {
    await carregarComCache('inicio', buscar, desenhar);
  } catch (erro) {
    mostrarAviso(app, `Não foi possível carregar o resumo: ${erro.message}`);
  }
}

montarLayout('inicio');
document.querySelector('.faixa')?.remove();
if (checarConfiguracao(app)) {
  mostrarCarregando(app);
  carregar();
  assinarMudancas(carregar);
}
