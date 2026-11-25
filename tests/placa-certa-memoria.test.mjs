import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAVE, armazenamento, sanear, carregar, guardar } from '../apps/placa-certa/js/memoria.js';
import { valoresPorDefeito } from '../apps/placa-certa/js/modelos.js';

const falso = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };
const quebrado = { getItem() { throw new DOMException('bloqueado', 'SecurityError'); }, setItem() { throw new DOMException('cheio', 'QuotaExceededError'); } };

test('com localStorage: guarda e volta a carregar o último texto', () => {
  const arm = falso();
  const valores = { ...valoresPorDefeito('aviso'), titulo: 'Volto já', mensagem: 'Estou na padaria' };
  assert.equal(guardar('aviso', valores, arm), true);
  assert.deepEqual(carregar(arm), { modelo: 'aviso', valores });
});

test('variante (Natal) é lembrada com o texto editado', () => {
  const arm = falso();
  const valores = { ...valoresPorDefeito('horario-natal'), nota: 'Reabrimos a 3.' };
  guardar('horario-natal', valores, arm);
  assert.deepEqual(carregar(arm), { modelo: 'horario-natal', valores });
});

test('sem localStorage (null/undefined): não lança e devolve valores neutros', () => {
  assert.equal(carregar(null), null);
  assert.equal(guardar('aviso', {}, null), false);
});

test('localStorage que lança (bloqueado, quota): não lança', () => {
  assert.equal(carregar(quebrado), null);
  assert.equal(guardar('aviso', valoresPorDefeito('aviso'), quebrado), false);
});

test('armazenamento(): acesso a globalThis.localStorage que lança não propaga', () => {
  const orig = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new DOMException('bloqueado', 'SecurityError'); } });
  try { assert.equal(armazenamento(), null); assert.equal(carregar(), null); assert.equal(guardar('aviso', {}), false); }
  finally { orig ? Object.defineProperty(globalThis, 'localStorage', orig) : delete globalThis.localStorage; }
});

test('dados corrompidos ou adulterados são ignorados ou limpos', () => {
  const arm = falso();
  for (const mau of ['{', 'null', '[]', '"x"', JSON.stringify({ v: 2, modelo: 'aviso' }), JSON.stringify({ v: 1, modelo: 'inexistente', valores: {} })]) {
    arm.m.set(CHAVE, mau);
    assert.equal(carregar(arm), null, mau);
  }
  const r = sanear({ v: 1, modelo: 'aberto-fechado', valores: { palavra: 'OUTRA', hora: '99:99', mensagem: 'x'.repeat(500), extra: 'y', __proto__: { z: 1 } } });
  assert.equal(r.valores.palavra, 'ABERTO');
  assert.equal(r.valores.hora, '');
  assert.equal([...r.valores.mensagem].length, 80);
  assert.equal('extra' in r.valores, false);
  assert.equal(sanear({ v: 1, modelo: 'aviso', valores: { titulo: 5 } }).valores.titulo, 'Aviso');
});
