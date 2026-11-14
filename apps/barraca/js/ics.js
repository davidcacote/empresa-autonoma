// Geração de um ficheiro de calendário (.ics, RFC 5545) com o turno do voluntário. Módulo puro, sem DOM nem rede.
// Os turnos guardam instantes absolutos; escrevemos DTSTART/DTEND em UTC ("Z"), o que dispensa VTIMEZONE e
// mantém a hora certa em Europe/Lisbon em qualquer altura do ano (incluindo a mudança de hora).
// Nada disto é guardado: o ficheiro gera-se no dispositivo a partir de dados que a página já tem.

const CRLF = '\r\n';
const LIMITE_OCTETOS = 75;
const codificador = new TextEncoder();

/** Escapa texto (RFC 5545 §3.3.11): \ ; , e quebras de linha. Remove outros caracteres de controlo. */
export function escaparTexto(texto) {
  return String(texto ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

/** Dobra uma linha a 75 octetos (UTF-8), sem partir carateres; as continuações começam com um espaço. */
export function dobrarLinha(linha) {
  if (codificador.encode(linha).length <= LIMITE_OCTETOS) return linha;
  const partes = [];
  let atual = '';
  let octetos = 0;
  let limite = LIMITE_OCTETOS;
  for (const car of linha) { // itera por pontos de código
    const n = codificador.encode(car).length;
    if (octetos + n > limite) {
      partes.push(atual);
      atual = '';
      octetos = 0;
      limite = LIMITE_OCTETOS - 1; // o espaço inicial da continuação conta
    }
    atual += car;
    octetos += n;
  }
  partes.push(atual);
  return partes.join(`${CRLF} `);
}

/** Instante -> "AAAAMMDDTHHMMSSZ" (UTC). Lança erro se a data for inválida. */
export function dataUtc(instante) {
  const d = new Date(instante);
  if (Number.isNaN(d.getTime())) throw new Error('data_invalida');
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Ficheiro .ics com um VEVENT.
 * `turno`: {uid, festa, posto, localidade, inicio, fim}. `agora` (DTSTAMP) é injetável para testes.
 * Um turno que passa da meia-noite tem `fim` no dia seguinte (já é assim nos dados), logo DTEND também.
 */
export function criarIcs({ uid, festa, posto, localidade, inicio, fim }, agora = new Date()) {
  if (!uid) throw new Error('uid_em_falta');
  if (!(new Date(fim) > new Date(inicio))) throw new Error('intervalo_invalido');
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Barraca//Turnos//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escaparTexto(uid)}`,
    `DTSTAMP:${dataUtc(agora)}`,
    `DTSTART:${dataUtc(inicio)}`,
    `DTEND:${dataUtc(fim)}`,
    `SUMMARY:${escaparTexto(`${festa} · ${posto}`)}`,
    `LOCATION:${escaparTexto(localidade)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return linhas.map(dobrarLinha).join(CRLF) + CRLF;
}

/** UID estável para uma inscrição (o mesmo evento não duplica ao importar duas vezes). */
export const uidInscricao = (inscricaoId) => `${inscricaoId}@barraca`;

/** Nome do ficheiro: "turno-<festa>.ics" (só ASCII seguro). */
export function nomeFicheiroIcs(festa) {
  const base = String(festa ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return `turno-${base || 'festa'}.ics`;
}
