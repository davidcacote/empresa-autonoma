import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../apps/turno-certo/js/logica.js';
import { criarArmazem } from '../apps/turno-certo/js/armazem.js';

const nova = (vagas = 2) => L.criarFolha({ nome: ' Festa X ', data: '2027-07-01', postos: [{ horario: '18:00', vagas }] }).folha;
const ok = (r) => { assert.equal(r.ok, true, r.erro); return r.folha; };

test('criar folha: valida nome, data, postos e vagas 1 a 30', () => {
  const f = nova(3);
  assert.equal(f.nome, 'Festa X');
  assert.equal(f.postos[0].vagas, 3);
  const base = { nome: 'A', data: '2027-07-01', postos: [{ horario: '18', vagas: 1 }] };
  assert.equal(L.criarFolha({ ...base, nome: '  ' }).ok, false);
  assert.equal(L.criarFolha({ ...base, data: '2027-02-30' }).ok, false);
  assert.equal(L.criarFolha({ ...base, data: '' }).ok, false);
  assert.equal(L.criarFolha({ ...base, postos: [] }).ok, false);
  assert.equal(L.criarFolha({ ...base, postos: [{ horario: ' ', vagas: 2 }] }).ok, false);
  for (const v of [0, 31, 1.5, NaN, -1]) assert.equal(L.criarFolha({ ...base, postos: [{ horario: 'x', vagas: v }] }).ok, false, `vagas ${v}`);
  for (const v of [1, 30]) assert.equal(L.criarFolha({ ...base, postos: [{ horario: 'x', vagas: v }] }).ok, true);
  assert.equal(L.formatarData('2027-07-01'), '01/07/2027');
});

test('adicionar posto não altera a folha original', () => {
  const f = nova();
  const g = ok(L.adicionarPosto(f, { horario: '20:00', vagas: 5 }));
  assert.equal(f.postos.length, 1);
  assert.equal(g.postos.length, 2);
  assert.equal(L.adicionarPosto(f, { horario: '', vagas: 5 }).ok, false);
});

test('ficha: só número; nomes, contactos e idades são recusados', () => {
  assert.equal(L.normalizarFicha(' 007 '), '7');
  for (const x of ['Ana', '912345678', '12 anos', '', '0', '-3', '1.5', 'a1', null, undefined]) assert.equal(L.normalizarFicha(x), null, String(x));
  const f = nova();
  assert.equal(L.inscrever(f, f.postos[0].id, 'Maria').ok, false);
  assert.equal(L.inscrever(f, f.postos[0].id, '912345678').ok, false);
});

test('inscrever: turno cheio na última vaga, sem duplicados, contador', () => {
  let f = nova(2);
  const p = f.postos[0].id;
  f = ok(L.inscrever(f, p, '1'));
  assert.equal(L.ocupadas(f.postos[0]), 1);
  const dup = L.inscrever(f, p, '01');
  assert.equal(dup.ok, false); assert.match(dup.erro, /já está/);
  f = ok(L.inscrever(f, p, '2'));
  assert.equal(L.ocupadas(f.postos[0]), 2);
  assert.equal(L.emFalta(f.postos[0]), 0);
  const cheio = L.inscrever(f, p, '3');
  assert.equal(cheio.ok, false); assert.match(cheio.erro, /Turno cheio/);
  assert.equal(L.inscrever(f, 'nada', '3').ok, false);
});

test('a mesma ficha pode estar em turnos diferentes', () => {
  let f = ok(L.adicionarPosto(nova(), { horario: '20:00', vagas: 2 }));
  f = ok(L.inscrever(f, f.postos[0].id, '5'));
  f = ok(L.inscrever(f, f.postos[1].id, '5'));
  assert.equal(L.resumo(f).ocupadas, 2);
});

test('falta só fica coberta com substituto registado E validado', () => {
  let f = nova(2);
  const p = f.postos[0].id;
  f = ok(L.inscrever(f, p, '1')); f = ok(L.inscrever(f, p, '2'));
  assert.equal(L.marcarFalta(f, p, '9').ok, false);
  assert.equal(L.registarSubstituto(f, p, '1', '7').ok, false, 'só após faltar');
  f = ok(L.marcarFalta(f, p, '1'));
  assert.deepEqual(L.pendencias(f), [{ postoId: p, horario: '18:00', ficha: '1', substituto: null }]);
  assert.equal(L.ocupadas(f.postos[0]), 1);
  assert.equal(L.validarSubstituto(f, p, '1').ok, false, 'sem substituto registado');
  assert.equal(L.registarSubstituto(f, p, '1', '2').ok, false, 'substituto já no turno');
  assert.equal(L.registarSubstituto(f, p, '1', 'Rui').ok, false);
  f = ok(L.registarSubstituto(f, p, '1', '7'));
  assert.equal(L.pendencias(f).length, 1, 'registado mas não validado continua pendente');
  assert.equal(L.pendencias(f)[0].substituto, '7');
  assert.equal(L.ocupadas(f.postos[0]), 1);
  assert.equal(L.inscrever(f, p, '7').ok, false, 'substituto ocupa a ficha');
  f = ok(L.validarSubstituto(f, p, '1'));
  assert.deepEqual(L.pendencias(f), []);
  assert.equal(L.ocupadas(f.postos[0]), 2);
  assert.equal(L.emFalta(f.postos[0]), 0);
  assert.equal(L.estadoPosto(f.postos[0]), 'completo');
});

test('desfazer falta e remover inscrição', () => {
  let f = nova(2); const p = f.postos[0].id;
  f = ok(L.inscrever(f, p, '1'));
  f = ok(L.marcarFalta(f, p, '1')); f = ok(L.registarSubstituto(f, p, '1', '4'));
  assert.equal(L.estadoPosto(f.postos[0]), 'falta');
  f = ok(L.desfazerFalta(f, p, '1'));
  assert.equal(f.postos[0].inscricoes[0].substituto, null);
  assert.equal(L.pendencias(f).length, 0);
  f = ok(L.removerInscricao(f, p, '1'));
  assert.equal(f.postos[0].inscricoes.length, 0);
  assert.equal(L.removerInscricao(f, p, '1').ok, false);
});

test('festa de exemplo é válida, fictícia e tem pendências', () => {
  const f = L.festaExemplo();
  assert.equal(L.folhaValida(f), true);
  assert.equal(L.pendencias(f).length, 2);
  assert.equal(L.resumo(f).vagas, 8);
  assert.ok(f.postos.every((p) => p.inscricoes.every((i) => /^\d+$/.test(i.ficha))));
});

test('folhaValida rejeita dados corrompidos', () => {
  const f = nova();
  assert.equal(L.folhaValida(f), true);
  for (const x of [null, {}, { ...f, data: 'x' }, { ...f, postos: [{ ...f.postos[0], vagas: 99 }] },
    { ...f, postos: [{ ...f.postos[0], inscricoes: [{ ficha: 'Ana', faltou: false }] }] }]) assert.equal(L.folhaValida(x), false);
});

test('armazém: localStorage quando existe, memória quando falha', () => {
  const mapa = new Map();
  const ls = { setItem: (k, v) => mapa.set(k, v), getItem: (k) => mapa.get(k) ?? null, removeItem: (k) => mapa.delete(k) };
  const a = criarArmazem(ls);
  assert.equal(a.persistente, true);
  a.gravar({ folhas: [{ x: 1 }], atual: 'x' });
  assert.deepEqual(criarArmazem(ls).ler(), { folhas: [{ x: 1 }], atual: 'x' });
  const m = criarArmazem({ setItem() { throw new Error('bloqueado'); } });
  assert.equal(m.persistente, false);
  assert.deepEqual(m.ler(), { folhas: [], atual: null });
  m.gravar({ folhas: [1], atual: null });
  assert.deepEqual(m.ler().folhas, [1]);
});
