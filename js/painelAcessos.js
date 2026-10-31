// Painel do organizador (Ajustes): quantos aparelhos acessaram o app por dia e quantos instalaram.
import { resumoAcessos, listarPicosOnline } from './api.js';
import { escapar } from './ui.js';

const dataCurta = (iso) => { const [, m, d] = iso.split('-'); return `${d}/${m}`; };
const diaDaSemana = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
const pct = (parte, todo) => (todo ? Math.round((parte / todo) * 100) : 0);

export function htmlAcessos(r, picos = new Map()) {
  const dias = [...r.dias].reverse(); // mais recente primeiro
  const hoje = dias[0];
  const maior = Math.max(1, ...dias.map((d) => d.acessos));
  const carta = (n, rotulo, dica = '') => `<div class="acessos__carta"><strong>${n}</strong><span>${rotulo}</span>${dica ? `<small>${dica}</small>` : ''}</div>`;
  return `
    <div class="acessos__cartas">
      ${carta(hoje.acessos, 'Acessaram hoje', `${hoje.novos} novo${hoje.novos === 1 ? '' : 's'}`)}
      ${carta(hoje.instalados, 'Pelo app instalado hoje', `${hoje.novas_instalacoes} ${hoje.novas_instalacoes === 1 ? 'nova instalação' : 'novas instalações'}`)}
      ${carta(r.total_aparelhos, 'Aparelhos no total', r.desde ? `desde ${dataCurta(r.desde)}` : '')}
      ${carta(r.total_instalados, 'Instalaram o app', `${pct(r.total_instalados, r.total_aparelhos)}% dos aparelhos`)}
    </div>
    <ol class="acessos__dias">
      <li class="acessos__cab"><span>Dia</span><span></span><span title="Aparelhos que abriram o app">Acessos</span><span title="Abriram pelo ícone instalado">Instal.</span><span title="Primeira vez no app">Novos</span></li>
      ${dias.map((d) => `
        <li class="acessos__dia${d.acessos ? '' : ' acessos__dia--vazio'}">
          <span class="acessos__data"><b>${dataCurta(d.dia)}</b> ${diaDaSemana(d.dia)}${picos.get(d.dia) ? `<small title="Pico de pessoas ao mesmo tempo">pico ${picos.get(d.dia)}</small>` : ''}</span>
          <span class="acessos__barra"><i style="width:${Math.round((d.acessos / maior) * 100)}%"></i></span>
          <strong>${d.acessos}</strong><span>${d.instalados}</span><span>${d.novos}</span>
        </li>`).join('')}
    </ol>
    <p class="texto-2 texto-pequeno">Conta <b>aparelhos</b>, não pessoas: quem usa dois celulares ou limpa os dados do navegador conta mais de uma vez. Android: ${r.plataformas.android ?? 0} · iPhone: ${r.plataformas.ios ?? 0} · outros: ${r.plataformas.outro ?? 0}. "Instal." = abriu pelo ícone do app.${r.desde ? ` A contagem começou em ${dataCurta(r.desde)}.` : ''}</p>`;
}

export async function ligarAcessos(alvo) {
  try {
    const [resumo, picos] = await Promise.all([resumoAcessos(14), listarPicosOnline(30).catch(() => [])]);
    if (!alvo.isConnected) return;
    alvo.innerHTML = resumo.total_aparelhos
      ? htmlAcessos(resumo, new Map(picos.map((p) => [p.dia, p.pico])))
      : '<p class="texto-2 texto-pequeno">Ainda sem registros. Os acessos começam a ser contados a partir de agora: volte aqui amanhã.</p>';
  } catch (erro) {
    if (alvo.isConnected) alvo.innerHTML = `<p class="aviso texto-pequeno">Não foi possível carregar os acessos: ${escapar(erro.message)}</p>`;
  }
}
