// Modelos de postos para o formulário "Criar festa" (módulo puro, sem DOM).
// Um modelo só sugere postos e turnos-tipo; o utilizador edita tudo antes de gravar.

const TURNO_TIPO = { inicio: '18:00', fim: '20:00', vagas: 3 };

export const MODELOS = [
  { id: 'festa-de-aldeia', nome: 'Festa de aldeia', postos: ['Bar', 'Comes e bebes', 'Bilheteira', 'Montagem'] },
  { id: 'recolha-de-alimentos', nome: 'Recolha de alimentos', postos: ['Entrada', 'Caixas', 'Armazém'] },
];

/** O modelo com este id, ou null. */
export const modeloPorId = (id) => MODELOS.find((m) => m.id === id) ?? null;

/** Postos do modelo prontos a pôr no formulário (cópia nova de cada vez; um turno-tipo por posto). Sem dia: depende das datas. */
export function postosDoModelo(id) {
  const modelo = modeloPorId(id);
  if (!modelo) return [];
  return modelo.postos.map((nome) => ({ nome, turnos: [{ ...TURNO_TIPO }] }));
}
