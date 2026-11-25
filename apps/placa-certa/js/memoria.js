// Placa Certa: lembrar o último texto neste browser (localStorage). Nada sai do dispositivo.
// Lógica sem DOM: o armazenamento é injetado, e qualquer falha (bloqueado, modo privado, quota) é silenciosa.
import { MODELOS, VARIANTES, modeloBase, modeloPorId, valoresPorDefeito, limitar, horaValida } from './modelos.js';

export const CHAVE = 'placa-certa:ultimo:v1';

/** localStorage se existir e responder; nunca lança (só aceder à propriedade já pode lançar). */
export function armazenamento() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** Valida e limpa um estado lido do disco; devolve {modelo, valores} ou null. */
export function sanear(bruto) {
  if (!bruto || typeof bruto !== 'object' || bruto.v !== 1) return null;
  const id = bruto.modelo;
  if (![...MODELOS, ...VARIANTES].some((m) => m.id === id)) return null;
  const base = modeloPorId(modeloBase(id));
  const guardados = bruto.valores && typeof bruto.valores === 'object' ? bruto.valores : {};
  const valores = valoresPorDefeito(id);
  for (const c of base.campos) {
    const v = guardados[c.id];
    if (typeof v !== 'string') continue;
    if (c.tipo === 'escolha') { if (c.opcoes.includes(v)) valores[c.id] = v; }
    else if (c.tipo === 'hora') { if (v === '' || horaValida(v)) valores[c.id] = v; }
    else valores[c.id] = limitar(v, c.max);
  }
  return { modelo: id, valores };
}

/** Último estado guardado, ou null (sem armazenamento, vazio, corrompido). */
export function carregar(arm = armazenamento()) {
  try {
    const txt = arm?.getItem(CHAVE);
    return txt ? sanear(JSON.parse(txt)) : null;
  } catch { return null; }
}

/** Guarda o estado; devolve true se gravou, false se falhou (sem lançar). */
export function guardar(modelo, valores, arm = armazenamento()) {
  try {
    if (!arm) return false;
    arm.setItem(CHAVE, JSON.stringify({ v: 1, modelo, valores }));
    return true;
  } catch { return false; }
}
