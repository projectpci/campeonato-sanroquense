// Guarda no aparelho a última resposta de cada página: ela abre na hora com os dados da última visita
// e atualiza em seguida com os dados novos. Em modo demonstração não usa cache.
import { demo, CAMPEONATO_ID } from './supabase.js';
import { toast } from './ui.js';

const PREFIXO = `sr_cache_${CAMPEONATO_ID}_`;
const jaAbriu = new Set(); // só a primeira carga da página usa o cache (o Realtime recarrega sem piscar)

function ler(chave) {
  try {
    const texto = localStorage.getItem(PREFIXO + chave);
    return texto ? JSON.parse(texto) : null;
  } catch { return null; }
}

function guardar(chave, valor) {
  try { localStorage.setItem(PREFIXO + chave, JSON.stringify(valor)); } catch { /* sem armazenamento */ }
}

// buscar(): devolve os dados do banco · desenhar(dados): monta a tela com eles
export async function carregarComCache(chave, buscar, desenhar) {
  const antigo = demo || jaAbriu.has(chave) ? null : ler(chave);
  jaAbriu.add(chave);
  if (antigo) {
    try { desenhar(antigo); } catch { /* cache de uma versão antiga do site: ignora */ }
  }
  let novo;
  try {
    novo = await buscar();
  } catch (erro) {
    if (!antigo) throw erro;
    toast('Sem conexão: mostrando os últimos dados salvos', true);
    return;
  }
  desenhar(novo);
  if (!demo) guardar(chave, novo);
}
