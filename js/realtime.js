// Um canal "campeonato" ouvindo as tabelas; chama o callback com debounce de 300 ms.
import { supabase } from './supabase.js';

const TABELAS = ['jogos', 'gols', 'times', 'rodadas', 'posts', 'comentarios', 'jogadores'];

export function assinarMudancas(callback) {
  if (!supabase) return () => {};

  let temporizador;
  const disparar = () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(callback, 300);
  };

  const canal = supabase.channel('campeonato');
  for (const table of TABELAS) {
    canal.on('postgres_changes', { event: '*', schema: 'public', table }, disparar);
  }
  canal.subscribe();

  return () => {
    clearTimeout(temporizador);
    supabase.removeChannel(canal);
  };
}
