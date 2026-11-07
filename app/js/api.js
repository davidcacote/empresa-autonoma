// Acesso ao Supabase por fetch direto à API REST (sem supabase-js para dados).
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const LIMITE_MS = 12000;

/** Erro da API com um `codigo` estável (ex.: "turno_cheio", "rede", "outro"). */
export class ErroApi extends Error {
  constructor(codigo, estado = 0) {
    super(codigo);
    this.codigo = codigo;
    this.estado = estado;
  }
}

async function pedir(caminho, opcoes = {}) {
  const ctrl = new AbortController();
  const temporizador = setTimeout(() => ctrl.abort(), LIMITE_MS);
  let resposta;
  try {
    resposta = await fetch(SUPABASE_URL + caminho, {
      ...opcoes,
      signal: ctrl.signal,
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, ...opcoes.headers },
    });
  } catch {
    throw new ErroApi('rede');
  } finally {
    clearTimeout(temporizador);
  }
  let corpo = null;
  try { corpo = await resposta.json(); } catch { /* sem corpo JSON */ }
  if (!resposta.ok) throw new ErroApi(typeof corpo?.message === 'string' ? corpo.message : 'outro', resposta.status);
  return corpo;
}

const ler = (tabela, consulta) => pedir(`/rest/v1/${tabela}?${consulta}`);

const rpc = (funcao, argumentos) => pedir(`/rest/v1/rpc/${funcao}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(argumentos),
});

/** Postos, turnos e inscrições de uma festa (lidos em paralelo). */
export async function carregarDados(festaId) {
  const id = encodeURIComponent(festaId);
  const [postos, turnos, inscricoes] = await Promise.all([
    ler('postos', `festa_id=eq.${id}&select=*&order=ordem`),
    ler('turnos', `festa_id=eq.${id}&select=*&order=inicio`),
    ler('inscricoes', `festa_id=eq.${id}&select=id,turno_id,primeiro_nome,criado_em&order=criado_em`),
  ]);
  return { postos, turnos, inscricoes };
}

/** A festa pelo slug (ou null se não existir). */
export async function carregarFesta(slug) {
  const festas = await ler('festas', `slug=eq.${encodeURIComponent(slug)}&select=*`);
  return Array.isArray(festas) && festas[0] ? festas[0] : null;
}

export const inscrever = (turnoId, nome, dispositivo, maiorIdade) =>
  rpc('inscrever', { p_turno: turnoId, p_nome: nome, p_dispositivo: dispositivo, p_maior_idade: maiorIdade });

export const cancelarInscricao = (inscricaoId, dispositivo) =>
  rpc('cancelar_inscricao', { p_inscricao: inscricaoId, p_dispositivo: dispositivo });

export const criarFesta = (payload) => rpc('criar_festa', payload);

export const verificarChave = (slug, chave) => rpc('verificar_chave', { p_slug: slug, p_chave: chave });

export const removerInscricao = (slug, chave, inscricaoId) =>
  rpc('remover_inscricao', { p_slug: slug, p_chave: chave, p_inscricao: inscricaoId });
