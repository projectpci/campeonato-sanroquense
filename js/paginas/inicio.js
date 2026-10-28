import { buscarCampeonato, buscarClassificacao, buscarArtilharia, listarJogos, listarJogosEncerrados, listarRodadas } from '../api.js';
import { ordenarClassificacao } from '../classificacao.js';
import { assinarMudancas } from '../realtime.js';
import { cartaoJogo } from '../cartaoJogo.js';
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
      <td class="time"><span class="time__nome">${escudo(t, 32)} ${escapar(t.nome)}</span></td><td class="pts">${t.pts}</td></tr>`;
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

async function carregar() {
  try {
    const [campeonato, rodadas, jogos, encerrados, linhas, artilharia] = await Promise.all([
      buscarCampeonato(), listarRodadas(), listarJogos(), listarJogosEncerrados(), buscarClassificacao(), buscarArtilharia(),
    ]);
    const porRodada = (r) => jogos.filter((j) => j.rodada_id === r?.id);
    const aoVivo = jogos.filter((j) => j.status === 'ao_vivo');
    const proxima = rodadas.find((r) => porRodada(r).some((j) => j.status === 'agendado'));
    const ultimaEncerrada = [...rodadas].reverse().find((r) => porRodada(r).some((j) => j.status === 'encerrado'));

    app.innerHTML = `
      ${htmlHero(campeonato)}
      ${aoVivo.length ? `<section class="secao"><h3>Ao vivo agora</h3>${aoVivo.map(cartaoJogo).join('')}</section>` : ''}
      ${htmlSecaoJogos('Próxima rodada', proxima, porRodada(proxima).filter((j) => j.status === 'agendado'))}
      ${htmlSecaoJogos('Últimos resultados', ultimaEncerrada, porRodada(ultimaEncerrada).filter((j) => j.status === 'encerrado'))}
      ${htmlTop4(ordenarClassificacao(linhas, encerrados))}
      ${htmlArtilheiros(artilharia)}
      ${CANAL_WHATSAPP ? `<p class="centro"><a class="botao" href="${escapar(CANAL_WHATSAPP)}" target="_blank" rel="noopener">${icone('whatsapp')} Entrar no canal do WhatsApp</a></p>` : ''}
      <p class="rodape-frase">Juntos pelo futebol de nossa comunidade!</p>
      <p class="centro texto-pequeno"><a class="texto-2" href="index.html">Trocar perfil</a></p>`;
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
