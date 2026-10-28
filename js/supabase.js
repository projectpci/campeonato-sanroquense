// Cria e exporta o client do Supabase.
// Versão FIXA do supabase-js: uma atualização do CDN não pode quebrar o site no meio do campeonato.
const SUPABASE_ESM = 'https://esm.sh/@supabase/supabase-js@2.45.4';

let config = null;
try {
  config = await import('./config.js');
} catch {
  config = null;
}

export const configurado = Boolean(
  config && config.SUPABASE_URL && !config.SUPABASE_URL.includes('SEU-PROJETO')
);

// O modo demonstração (dados fictícios, login aberto) só existe em máquina local.
// Em produção, sem config.js o site mostra um erro em vez de liberar um painel falso.
const ehLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
export const demo = !configurado && ehLocal;
export const semConfiguracao = !configurado && !ehLocal;

export const CAMPEONATO_ID = config?.CAMPEONATO_ID ?? 1;
export const CANAL_WHATSAPP = config?.CANAL_WHATSAPP_URL ?? '';

export let supabase = null;
if (configurado) {
  const { createClient } = await import(SUPABASE_ESM);
  supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
}
