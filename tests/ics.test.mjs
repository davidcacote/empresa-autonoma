// Testes do gerador de .ics (apps/barraca/js/ics.js). Correr com: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarIcs, escaparTexto, dobrarLinha, dataUtc, uidInscricao, nomeFicheiroIcs } from '../apps/barraca/js/ics.js';

const AGORA = new Date('2030-06-01T10:00:00Z');
const base = {
  uid: uidInscricao('abc-123'), festa: 'Festas de Verão da Ribeira', posto: 'Bar', localidade: 'Aldeia da Ribeira',
  inicio: '2030-06-22T19:00:00.000Z', fim: '2030-06-22T21:00:00.000Z',
};
const linhasDe = (ics) => ics.split('\r\n');
const octetos = (t) => new TextEncoder().encode(t).length;

test('VEVENT completo: UTC correto, SUMMARY, LOCATION, UID e DTSTAMP', () => {
  const ics = criarIcs(base, AGORA);
  const l = linhasDe(ics);
  assert.equal(l[0], 'BEGIN:VCALENDAR');
  assert.equal(l.at(-2), 'END:VCALENDAR');
  assert.equal(l.at(-1), '');
  assert.equal(l.filter((x) => x === 'BEGIN:VEVENT').length, 1);
  assert.ok(l.includes('DTSTART:20300622T190000Z')); // 20h em Lisboa (verão, UTC+1) = 19h UTC
  assert.ok(l.includes('DTEND:20300622T210000Z'));
  assert.ok(l.includes('DTSTAMP:20300601T100000Z'));
  assert.ok(l.includes('UID:abc-123@barraca'));
  assert.ok(l.includes('SUMMARY:Festas de Verão da Ribeira · Bar'));
  assert.ok(l.includes('LOCATION:Aldeia da Ribeira'));
  assert.ok(!/(?<!\r)\n/.test(ics), 'só CRLF');
});

test('UID é estável entre gerações e não depende de DTSTAMP', () => {
  const uid = (ics) => linhasDe(ics).find((x) => x.startsWith('UID:'));
  assert.equal(uid(criarIcs(base, AGORA)), uid(criarIcs(base, new Date('2031-01-01T00:00:00Z'))));
});

test('turno que passa da meia-noite: DTEND no dia seguinte', () => {
  // 22h–00h de verão em Lisboa: 21:00Z – 23:00Z; e 23h–02h: 22:00Z – 01:00Z do dia seguinte
  const ics = criarIcs({ ...base, inicio: '2030-06-22T22:00:00Z', fim: '2030-06-23T01:00:00Z' }, AGORA);
  assert.ok(ics.includes('DTSTART:20300622T220000Z'));
  assert.ok(ics.includes('DTEND:20300623T010000Z'));
});

test('mudança de hora: instantes absolutos mantêm a hora local certa', () => {
  const fmt = (iso) => new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
  // Inverno: 20h local = 20:00Z; verão: 20h local = 19:00Z
  assert.ok(criarIcs({ ...base, inicio: '2030-01-12T20:00:00Z', fim: '2030-01-12T22:00:00Z' }, AGORA).includes('DTSTART:20300112T200000Z'));
  // Noite da mudança (2030-03-31): 00h30 local = 00:30Z (ainda UTC+0), 03h local = 02:00Z (já UTC+1)
  const ics = criarIcs({ ...base, inicio: '2030-03-31T00:30:00Z', fim: '2030-03-31T02:00:00Z' }, AGORA);
  assert.ok(ics.includes('DTSTART:20300331T003000Z') && ics.includes('DTEND:20300331T020000Z'));
  assert.equal(fmt('2030-03-31T00:30:00Z'), '00:30');
  assert.equal(fmt('2030-03-31T02:00:00Z'), '03:00');
  // Fim do verão (2030-10-27): 22h local sábado = 21:00Z, 22h local domingo = 22:00Z
  assert.ok(criarIcs({ ...base, inicio: '2030-10-26T21:00:00Z', fim: '2030-10-26T23:00:00Z' }, AGORA).includes('DTSTART:20301026T210000Z'));
  assert.ok(criarIcs({ ...base, inicio: '2030-10-27T22:00:00Z', fim: '2030-10-28T00:00:00Z' }, AGORA).includes('DTSTART:20301027T220000Z'));
});

test('escape RFC 5545: vírgulas, ponto e vírgula, barras e quebras de linha', () => {
  assert.equal(escaparTexto('a,b;c\\d\ne\r\nf\rg'), 'a\\,b\\;c\\\\d\\ne\\nf\\ng');
  assert.equal(escaparTexto('a\u0000b\u0007c'), 'abc');
  assert.equal(escaparTexto(null), '');
  const ics = criarIcs({ ...base, festa: 'Festa, do Zé; "a" \\ nova', posto: 'Bar\nCaixa', localidade: 'Vila, Norte; PT' }, AGORA);
  assert.ok(ics.includes('SUMMARY:Festa\\, do Zé\\; "a" \\\\ nova · Bar\\nCaixa\r\n'));
  assert.ok(ics.includes('LOCATION:Vila\\, Norte\\; PT\r\n'));
  // Um nome com quebra de linha não consegue injetar propriedades
  const inj = criarIcs({ ...base, festa: 'X\r\nATTENDEE:mailto:a@b.pt' }, AGORA);
  assert.ok(!linhasDe(inj).some((x) => x.startsWith('ATTENDEE')));
});

test('dobragem a 75 octetos, sem partir carateres UTF-8, e reversível', () => {
  const curta = 'SUMMARY:curto';
  assert.equal(dobrarLinha(curta), curta);
  const exata = 'X'.repeat(75);
  assert.equal(dobrarLinha(exata), exata);
  assert.equal(dobrarLinha(exata + 'Y'), `${exata}\r\n Y`);
  const longa = 'SUMMARY:' + 'ção · '.repeat(60);
  const dobrada = dobrarLinha(longa);
  const partes = dobrada.split('\r\n');
  assert.ok(partes.length > 1);
  for (const p of partes) assert.ok(octetos(p) <= 75, `linha com ${octetos(p)} octetos`);
  for (const p of partes.slice(1)) assert.ok(p.startsWith(' '));
  assert.equal(partes[0] + partes.slice(1).map((p) => p.slice(1)).join(''), longa); // desdobrar devolve o original
  // Emoji (4 octetos) nunca é cortado a meio
  const emoji = dobrarLinha('SUMMARY:' + '🎉'.repeat(40));
  for (const p of emoji.split('\r\n')) { assert.ok(octetos(p) <= 75); assert.ok(!p.includes('�')); }
});

test('no ficheiro final todas as linhas têm no máximo 75 octetos', () => {
  const ics = criarIcs({ ...base, festa: 'Festa muito comprida '.repeat(8), localidade: 'Localidade, com vírgulas; e ção '.repeat(4) }, AGORA);
  for (const l of linhasDe(ics)) assert.ok(octetos(l) <= 75, `linha com ${octetos(l)} octetos`);
});

test('entradas inválidas lançam erro em vez de gerar um ficheiro errado', () => {
  assert.throws(() => criarIcs({ ...base, uid: '' }, AGORA), /uid_em_falta/);
  assert.throws(() => criarIcs({ ...base, inicio: 'lixo' }, AGORA), /intervalo_invalido/);
  assert.throws(() => criarIcs({ ...base, fim: base.inicio }, AGORA), /intervalo_invalido/);
  assert.throws(() => dataUtc('lixo'), /data_invalida/);
});

test('nome do ficheiro é ASCII seguro', () => {
  assert.equal(nomeFicheiroIcs('Festas de Verão da Ribeira'), 'turno-festas-de-verao-da-ribeira.ics');
  assert.equal(nomeFicheiroIcs('../../x"y'), 'turno-x-y.ics');
  assert.equal(nomeFicheiroIcs(''), 'turno-festa.ics');
});
