// Turno Certo: lógica pura (sem DOM, sem armazenamento). Todas as funções devolvem {ok, folha} ou {ok:false, erro}
// e nunca alteram o argumento recebido.
export const VAGAS_MIN = 1;
export const VAGAS_MAX = 30;
export const MAX_POSTOS = 40;
export const MAX_NOME = 60;
export const MAX_HORARIO = 30;

const clonar = (o) => JSON.parse(JSON.stringify(o));
const falha = (erro) => ({ ok: false, erro });

/** Número de ficha: só dígitos (1 a 6), sem zeros à esquerda. Nunca nomes, contactos ou idades. */
export function normalizarFicha(texto) {
  const t = String(texto ?? '').trim();
  if (!/^\d{1,6}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 ? String(n) : null;
}

export function dataValida(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d))) return false;
  const dt = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === d;
}

export function formatarData(d) {
  if (!dataValida(d)) return '';
  const [a, m, dia] = d.split('-');
  return `${dia}/${m}/${a}`;
}

export function vagasValidas(v) {
  return Number.isInteger(v) && v >= VAGAS_MIN && v <= VAGAS_MAX;
}

let contador = 0;
function novoId(prefixo) {
  contador += 1;
  return `${prefixo}${Date.now().toString(36)}${contador.toString(36)}`;
}

export function validarPosto({ horario, vagas }) {
  const h = String(horario ?? '').trim();
  if (!h) return 'Indique o horário do posto.';
  if (h.length > MAX_HORARIO) return `O horário pode ter no máximo ${MAX_HORARIO} caracteres.`;
  if (!vagasValidas(Number(vagas)) || !Number.isInteger(Number(vagas))) return `As vagas têm de ser um número entre ${VAGAS_MIN} e ${VAGAS_MAX}.`;
  return null;
}

export function criarFolha({ nome, data, postos }) {
  const n = String(nome ?? '').trim();
  if (!n) return falha('Indique o nome da festa.');
  if (n.length > MAX_NOME) return falha(`O nome pode ter no máximo ${MAX_NOME} caracteres.`);
  if (!dataValida(data)) return falha('Indique uma data válida.');
  if (!Array.isArray(postos) || postos.length === 0) return falha('Adicione pelo menos um posto.');
  if (postos.length > MAX_POSTOS) return falha(`No máximo ${MAX_POSTOS} postos.`);
  const lista = [];
  for (const p of postos) {
    const e = validarPosto(p);
    if (e) return falha(e);
    lista.push({ id: novoId('p'), horario: String(p.horario).trim(), vagas: Number(p.vagas), inscricoes: [] });
  }
  return { ok: true, folha: { id: novoId('f'), nome: n, data, postos: lista } };
}

export function adicionarPosto(folha, posto) {
  const e = validarPosto(posto);
  if (e) return falha(e);
  if (folha.postos.length >= MAX_POSTOS) return falha(`No máximo ${MAX_POSTOS} postos.`);
  const f = clonar(folha);
  f.postos.push({ id: novoId('p'), horario: String(posto.horario).trim(), vagas: Number(posto.vagas), inscricoes: [] });
  return { ok: true, folha: f };
}

const achar = (folha, postoId) => folha.postos.find((p) => p.id === postoId);

/** Fichas já usadas no posto (inscritas e substitutas): uma ficha só entra uma vez por turno. */
export function fichasNoPosto(posto) {
  const s = new Set();
  for (const i of posto.inscricoes) { s.add(i.ficha); if (i.substituto) s.add(i.substituto.ficha); }
  return s;
}

/** Ocupadas = inscritas que não faltaram + substitutos validados. */
export function ocupadas(posto) {
  return posto.inscricoes.reduce((n, i) => n + (i.faltou ? (i.substituto?.validada ? 1 : 0) : 1), 0);
}
export const emFalta = (posto) => posto.vagas - ocupadas(posto);

export function inscrever(folha, postoId, fichaTexto) {
  const posto = achar(folha, postoId);
  if (!posto) return falha('Posto não encontrado.');
  const ficha = normalizarFicha(fichaTexto);
  if (!ficha) return falha('Indique só o número da ficha (1 a 6 dígitos). Não escreva nomes nem contactos.');
  if (fichasNoPosto(posto).has(ficha)) return falha(`A ficha ${ficha} já está neste turno.`);
  if (posto.inscricoes.length >= posto.vagas) return falha('Turno cheio.');
  const f = clonar(folha);
  achar(f, postoId).inscricoes.push({ ficha, faltou: false, substituto: null });
  return { ok: true, folha: f };
}

export function removerInscricao(folha, postoId, ficha) {
  const posto = achar(folha, postoId);
  if (!posto || !posto.inscricoes.some((i) => i.ficha === ficha)) return falha('Inscrição não encontrada.');
  const f = clonar(folha);
  const p = achar(f, postoId);
  p.inscricoes = p.inscricoes.filter((i) => i.ficha !== ficha);
  return { ok: true, folha: f };
}

function mudarInscricao(folha, postoId, ficha, fn) {
  const posto = achar(folha, postoId);
  if (!posto || !posto.inscricoes.some((i) => i.ficha === ficha)) return falha('Inscrição não encontrada.');
  const f = clonar(folha);
  const i = achar(f, postoId).inscricoes.find((x) => x.ficha === ficha);
  const e = fn(i, achar(f, postoId));
  return e ? falha(e) : { ok: true, folha: f };
}

export const marcarFalta = (folha, postoId, ficha) =>
  mudarInscricao(folha, postoId, ficha, (i) => { i.faltou = true; });

/** Desfazer a falta (engano): apaga também o substituto registado. */
export const desfazerFalta = (folha, postoId, ficha) =>
  mudarInscricao(folha, postoId, ficha, (i) => { i.faltou = false; i.substituto = null; });

export function registarSubstituto(folha, postoId, ficha, substitutoTexto) {
  const sub = normalizarFicha(substitutoTexto);
  if (!sub) return falha('Indique só o número da ficha do substituto (1 a 6 dígitos).');
  return mudarInscricao(folha, postoId, ficha, (i, posto) => {
    if (!i.faltou) return 'Só se regista substituto para uma ficha que faltou.';
    const usadas = fichasNoPosto(posto);
    if (i.substituto) usadas.delete(i.substituto.ficha);
    if (usadas.has(sub)) return `A ficha ${sub} já está neste turno.`;
    i.substituto = { ficha: sub, validada: false };
  });
}

export const validarSubstituto = (folha, postoId, ficha) =>
  mudarInscricao(folha, postoId, ficha, (i) => {
    if (!i.faltou || !i.substituto) return 'Registe primeiro a ficha substituta.';
    i.substituto.validada = true;
  });

/** Faltas sem substituto validado, por ordem da folha. */
export function pendencias(folha) {
  const r = [];
  for (const p of folha.postos) for (const i of p.inscricoes)
    if (i.faltou && !i.substituto?.validada) r.push({ postoId: p.id, horario: p.horario, ficha: i.ficha, substituto: i.substituto?.ficha ?? null });
  return r;
}

export function resumo(folha) {
  const vagas = folha.postos.reduce((n, p) => n + p.vagas, 0);
  const oc = folha.postos.reduce((n, p) => n + ocupadas(p), 0);
  return { vagas, ocupadas: oc, emFalta: vagas - oc, pendencias: pendencias(folha).length };
}

/** Estado de um posto para texto e borda: completo | falta. */
export const estadoPosto = (posto) => (emFalta(posto) > 0 ? 'falta' : 'completo');

/** Valida uma folha lida do armazenamento (dados podem estar corrompidos). */
export function folhaValida(f) {
  try {
    if (!f || typeof f !== 'object' || typeof f.id !== 'string' || !String(f.nome ?? '').trim() || !dataValida(f.data)) return false;
    if (!Array.isArray(f.postos)) return false;
    return f.postos.every((p) => p && typeof p.id === 'string' && typeof p.horario === 'string' && vagasValidas(p.vagas)
      && Array.isArray(p.inscricoes) && p.inscricoes.length <= p.vagas
      && p.inscricoes.every((i) => normalizarFicha(i.ficha) === i.ficha && typeof i.faltou === 'boolean'
        && (i.substituto == null || (normalizarFicha(i.substituto.ficha) === i.substituto.ficha && typeof i.substituto.validada === 'boolean'))));
  } catch { return false; }
}

/** Festa fictícia para demonstração (sem marcas nem dados pessoais). */
export function festaExemplo() {
  const r = criarFolha({ nome: 'Festa da Aldeia de Exemplo', data: '2027-08-14', postos: [
    { horario: '18:00 às 20:00', vagas: 3 }, { horario: '20:00 às 22:00', vagas: 3 }, { horario: '22:00 às 24:00', vagas: 2 },
  ] });
  let f = r.folha;
  const passos = [
    (x) => inscrever(x, x.postos[0].id, '12'), (x) => inscrever(x, x.postos[0].id, '27'), (x) => inscrever(x, x.postos[0].id, '31'),
    (x) => inscrever(x, x.postos[1].id, '8'), (x) => inscrever(x, x.postos[1].id, '15'),
    (x) => marcarFalta(x, x.postos[1].id, '15'),
    (x) => inscrever(x, x.postos[2].id, '40'),
    (x) => marcarFalta(x, x.postos[0].id, '27'), (x) => registarSubstituto(x, x.postos[0].id, '27', '44'),
  ];
  for (const p of passos) f = p(f).folha;
  return f;
}
