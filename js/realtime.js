// Um canal ouvindo as tabelas; chama o callback com debounce de 400 ms.
// Cada página ouve só as tabelas que mostra: um comentário no mural não recarrega a Tabela de todo mundo.
import { supabase } from './supabase.js';

export const TABELAS_JOGOS = ['jogos', 'gols', 'times', 'rodadas', 'escalacoes_jogo'];
const TODAS = [...TABELAS_JOGOS, 'posts', 'comentarios', 'jogadores'];

export function assinarMudancas(callback, tabelas = TODAS) {
  if (!supabase) return () => {};

  let temporizador;
  let pendente = false;
  const disparar = () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      // aba escondida: atualiza quando o torcedor voltar (economiza bateria e consultas)
      if (document.hidden) { pendente = true; return; }
      callback();
    }, 400);
  };
  const aoVoltar = () => { if (!document.hidden && pendente) { pendente = false; callback(); } };
  document.addEventListener('visibilitychange', aoVoltar);

  const canal = supabase.channel(`campeonato-${tabelas.join('-')}`);
  for (const table of tabelas) {
    canal.on('postgres_changes', { event: '*', schema: 'public', table }, disparar);
  }
  canal.subscribe();

  return () => {
    clearTimeout(temporizador);
    document.removeEventListener('visibilitychange', aoVoltar);
    supabase.removeChannel(canal);
  };
}
