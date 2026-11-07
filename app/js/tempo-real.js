// Atualização automática: Realtime do Supabase quando possível, sondagem a cada 15 s quando não.
// O supabase-js só é carregado por CDN para isto; se falhar (sem rede, bloqueado), a página continua a funcionar.
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_JS_CDN, SONDAGEM_MS } from './config.js';

const LIMITE_LIGACAO_MS = 8000;

const comLimite = (promessa, ms) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('limite')), ms);
  promessa.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
});

/**
 * Mantém os dados frescos. `recarregar()` volta a ler tudo; `aMudarModo('direto'|'sondagem')` avisa a página.
 * Devolve uma função para parar.
 */
export function iniciarAtualizacao({ festaId, recarregar, aMudarModo }) {
  let temporizador = null;
  let atraso = null;
  let cliente = null;
  let parado = false;

  const pedirLeitura = () => { clearTimeout(atraso); atraso = setTimeout(recarregar, 300); };

  function sondar() {
    if (temporizador || parado) return;
    temporizador = setInterval(() => { if (!document.hidden) recarregar(); }, SONDAGEM_MS);
    aMudarModo('sondagem');
  }
  function pararSondagem() { clearInterval(temporizador); temporizador = null; }

  const aoVoltar = () => { if (!document.hidden) recarregar(); };
  document.addEventListener('visibilitychange', aoVoltar);

  async function ligarTempoReal() {
    try {
      const { createClient } = await comLimite(import(SUPABASE_JS_CDN), LIMITE_LIGACAO_MS);
      if (parado) return;
      cliente = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
      const filtro = `festa_id=eq.${festaId}`;
      const limiteCanal = setTimeout(sondar, LIMITE_LIGACAO_MS);
      cliente.channel(`festa-${festaId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos', filter: filtro }, pedirLeitura)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inscricoes', filter: filtro }, pedirLeitura)
        .subscribe((estado) => {
          if (parado) return;
          if (estado === 'SUBSCRIBED') { clearTimeout(limiteCanal); pararSondagem(); aMudarModo('direto'); recarregar(); }
          else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(estado)) sondar();
        });
    } catch { /* sem CDN: a sondagem já está a funcionar */ }
  }

  sondar();
  ligarTempoReal();

  return function parar() {
    parado = true;
    pararSondagem();
    clearTimeout(atraso);
    document.removeEventListener('visibilitychange', aoVoltar);
    try { cliente?.removeAllChannels(); } catch { /* nada a fazer */ }
  };
}
