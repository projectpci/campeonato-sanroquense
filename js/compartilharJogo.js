// Botão de compartilhar de cada card de jogo: gera a arte do jogo (antes, ao vivo ou resultado) e abre o WhatsApp.
import { buscarCampeonato } from './api.js';
import { compartilharImagem } from './compartilhar.js';
import { arteJogo, inserirArte } from './artes.js';
import { toast } from './ui.js';

const jogos = new Map(); // id → último estado desenhado do jogo
export const registrarJogo = (jogo) => jogos.set(jogo.id, jogo);

document.addEventListener('click', async (e) => {
  const botao = e.target.closest('[data-compartilhar-jogo]');
  if (!botao) return;
  e.preventDefault();
  e.stopPropagation();
  const jogo = jogos.get(Number(botao.dataset.compartilharJogo));
  if (!jogo) return;
  if (typeof window.html2canvas !== 'function') { toast('Aguarde a página terminar de carregar e tente de novo.', true); return; }
  botao.disabled = true;
  toast('Gerando imagem...');
  try {
    const campeonato = await buscarCampeonato();
    const nome = `${jogo.mandante.sigla ?? jogo.mandante.nome}-x-${jogo.visitante.sigla ?? jogo.visitante.nome}`.toLowerCase().replace(/\s+/g, '-');
    await compartilharImagem(inserirArte('arte-jogo', arteJogo(campeonato, jogo)), `jogo-${nome}.jpg`);
  } catch (erro) {
    toast(`Não foi possível gerar a imagem: ${erro.message}`, true);
  } finally {
    botao.disabled = false;
  }
});
