// Cria e exporta o client do Supabase.
// Versão FIXA do supabase-js: uma atualização do CDN não pode quebrar o site no meio do campeonato.
const SUPABASE_ESM = 'https://esm.sh/@supabase/supabase-js@2.45.4';

// config.js e a biblioteca carregam ao mesmo tempo (antes um esperava o outro: uma ida e volta a mais em cada página)
const [resultadoConfig, resultadoSdk] = await Promise.allSettled([import('./config.js'), import(SUPABASE_ESM)]);
const config = resultadoConfig.status === 'fulfilled' ? resultadoConfig.value : null;

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
// Opcional: número do organizador (só dígitos, com 55 + DDD) que recebe o elenco enviado pelo formulário dos clubes
export const WHATSAPP_ELENCO = String(config?.WHATSAPP_ELENCO ?? '').replace(/\D/g, '');

export let supabase = null;
if (configurado) {
  if (resultadoSdk.status !== 'fulfilled') throw resultadoSdk.reason; // sem a biblioteca o app não abre (js/resgate.js tenta de novo)
  supabase = resultadoSdk.value.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
}
