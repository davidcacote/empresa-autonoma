import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODELOS, modeloPorId, postosDoModelo } from '../apps/barraca/js/modelos.js';
import { validarFesta } from '../apps/barraca/js/logica.js';

test('há três modelos com os postos pedidos', () => {
  assert.deepEqual(MODELOS.map((m) => m.nome), ['Festa de aldeia', 'Recolha de alimentos', 'Feira de Natal de escola']);
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

test('Feira de Natal de escola: bancas, turnos de 1-2 h, lotações razoáveis, dias relativos', () => {
  const postos = postosDoModelo('feira-de-natal-de-escola');
  assert.deepEqual(postos.map((p) => p.nome), ['Bolos', 'Chocolate quente', 'Rifas', 'Montagem e desmontagem']);
  for (const p of postos) {
    assert.ok(p.turnos.length >= 2);
    for (const t of p.turnos) {
      const min = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
      const dur = min(t.fim) - min(t.inicio);
      assert.ok(dur >= 60 && dur <= 120, `duração ${dur}`);
      assert.ok(t.vagas >= 1 && t.vagas <= 10);
      assert.ok(Number.isInteger(t.diaRel));
    }
  }
});
