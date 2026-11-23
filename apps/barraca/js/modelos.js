// Modelos de postos para o formulário "Criar festa" (módulo puro, sem DOM).
// Um modelo só sugere postos e turnos-tipo; o utilizador edita tudo antes de gravar.

const TURNO_TIPO = { inicio: '18:00', fim: '20:00', vagas: 3 };

export const MODELOS = [
  { id: 'festa-de-aldeia', nome: 'Festa de aldeia', postos: ['Bar', 'Comes e bebes', 'Bilheteira', 'Montagem'] },
  { id: 'recolha-de-alimentos', nome: 'Recolha de alimentos', postos: ['Entrada', 'Caixas', 'Armazém'] },
];

const T = (inicio, fim, vagas, diaRel = 0) => ({ inicio, fim, vagas, diaRel });

// `diaRel`: posição do dia dentro da festa (0 = primeiro dia, -1 = último). Nunca datas fixas.
MODELOS.push({
  id: 'feira-de-natal-de-escola',
  nome: 'Feira de Natal de escola',
  postos: [
    { nome: 'Bolos', turnos: [T('10:00', '12:00', 3), T('12:00', '14:00', 3), T('14:00', '16:00', 3)] },
    { nome: 'Chocolate quente', turnos: [T('10:00', '12:00', 2), T('14:00', '16:00', 2)] },
    { nome: 'Rifas', turnos: [T('10:00', '12:00', 2), T('14:00', '16:00', 2)] },
    { nome: 'Montagem e desmontagem', turnos: [T('08:00', '10:00', 6), T('16:00', '17:30', 6, -1)] },
  ],
});

/** O modelo com este id, ou null. */
export const modeloPorId = (id) => MODELOS.find((m) => m.id === id) ?? null;

/** Postos do modelo prontos a pôr no formulário (cópia nova de cada vez; um turno-tipo por posto). Sem dia: depende das datas. */
export function postosDoModelo(id) {
  const modelo = modeloPorId(id);
  if (!modelo) return [];
  return modelo.postos.map((p) => typeof p === 'string'
    ? { nome: p, turnos: [{ ...TURNO_TIPO }] }
    : { nome: p.nome, turnos: p.turnos.map((t) => ({ ...t })) });
}
