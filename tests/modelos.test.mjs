import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODELOS, modeloPorId, postosDoModelo } from '../apps/barraca/js/modelos.js';
import { validarFesta } from '../apps/barraca/js/logica.js';

test('há dois modelos com os postos pedidos', () => {
  assert.deepEqual(MODELOS.map((m) => m.nome), ['Festa de aldeia', 'Recolha de alimentos']);
  assert.deepEqual(postosDoModelo('festa-de-aldeia').map((p) => p.nome), ['Bar', 'Comes e bebes', 'Bilheteira', 'Montagem']);
  assert.deepEqual(postosDoModelo('recolha-de-alimentos').map((p) => p.nome), ['Entrada', 'Caixas', 'Armazém']);
});

test('modelo desconhecido: null e sem postos', () => {
  assert.equal(modeloPorId('x'), null);
  assert.deepEqual(postosDoModelo('x'), []);
});

test('devolve cópias independentes (editar não altera o modelo)', () => {
  const a = postosDoModelo('festa-de-aldeia');
  a[0].nome = 'Outro'; a[0].turnos[0].vagas = 99;
  const b = postosDoModelo('festa-de-aldeia');
  assert.equal(b[0].nome, 'Bar');
  assert.equal(b[0].turnos[0].vagas, 3);
});

test('os modelos geram uma festa válida assim que há datas e dia', () => {
  for (const m of MODELOS) {
    const postos = postosDoModelo(m.id).map((p) => ({ ...p, turnos: p.turnos.map((t) => ({ ...t, dia: '2030-06-22' })) }));
    const erros = validarFesta({ nome: 'Festa', localidade: 'Aldeia', descricao: '', dataInicio: '2030-06-22', dataFim: '2030-06-22', postos }, '2030-01-01');
    assert.deepEqual(erros, []);
  }
});

test('textos sem datas reais, marcas ou nomes de pessoas', () => {
  const texto = JSON.stringify(MODELOS);
  assert.ok(!/\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/.test(texto));
});
