// Armazenamento: localStorage se existir; senão memória (com aviso visível na interface).
const CHAVE = 'turno-certo:v1';

export function criarArmazem(ls) {
  let memoria = { folhas: [], atual: null };
  let persistente = false;
  try {
    const s = ls ?? globalThis.localStorage;
    s.setItem(`${CHAVE}:teste`, '1'); s.removeItem(`${CHAVE}:teste`);
    persistente = true;
    return {
      persistente,
      ler() { try { const d = JSON.parse(s.getItem(CHAVE)); return d && Array.isArray(d.folhas) ? d : { folhas: [], atual: null }; } catch { return { folhas: [], atual: null }; } },
      gravar(d) { try { s.setItem(CHAVE, JSON.stringify(d)); return true; } catch { return false; } },
    };
  } catch { /* indisponível */ }
  return { persistente, ler: () => structuredClone(memoria), gravar(d) { memoria = structuredClone(d); return true; } };
}
