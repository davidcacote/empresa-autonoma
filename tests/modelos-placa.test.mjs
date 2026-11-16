import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODELOS, modeloPorId, valoresPorDefeito, montarFolha, dividirItem, dividirLinhas, limitar, horaValida } from '../apps/placa-certa/js/modelos.js';

test('há 4 modelos pela ordem pedida', () => {
  assert.deepEqual(MODELOS.map((m) => m.nome), ['Aberto / Fechado', 'Horário', 'Preços / Lista', 'Aviso']);
  assert.equal(modeloPorId('x'), null);
  assert.deepEqual(valoresPorDefeito('x'), {});
});

test('valores por defeito exatos', () => {
  assert.deepEqual(valoresPorDefeito('aberto-fechado'), { palavra: 'ABERTO', mensagem: 'Entre, esteja à vontade.', hora: '' });
  assert.deepEqual(valoresPorDefeito('horario'), { titulo: 'Horário', linhas: 'Segunda a sexta: 9h00 às 19h00\nSábado: 9h00 às 13h00\nDomingo: Fechado', nota: 'Encerramos em feriados.' });
  assert.deepEqual(valoresPorDefeito('precos'), { titulo: 'Preços', itens: 'Café - 0,80 €\nPão com queijo - 1,50 €\nSumo natural - 2,50 €', nota: 'Preços com IVA incluído.' });
  assert.deepEqual(valoresPorDefeito('aviso'), { titulo: 'Aviso', mensagem: 'Por favor, deixe aqui o seu recado. Obrigado pela compreensão.' });
});

test('"nome - preço": divide, e linha sem " - " fica inteira', () => {
  assert.deepEqual(dividirItem('Café - 0,80 €'), { nome: 'Café', preco: '0,80 €', inteira: false });
  assert.deepEqual(dividirItem('Pão-de-ló 2 €'), { nome: 'Pão-de-ló 2 €', preco: '', inteira: true });
  assert.equal(dividirItem('Café - ').preco, '');
  const blocos = montarFolha('precos', { titulo: 'P', itens: 'Café - 1 €\n\nSó texto', nota: '' });
  assert.deepEqual(blocos, [
    { tipo: 'titulo', texto: 'P' },
    { tipo: 'item', nome: 'Café', preco: '1 €' },
    { tipo: 'item', nome: 'Só texto', preco: '' },
  ]);
});

test('VOLTO JÁ com hora mostra "Volto às HH:MM"; ABERTO ou hora inválida não', () => {
  const textos = (v) => montarFolha('aberto-fechado', v).map((b) => b.texto);
  assert.deepEqual(textos({ palavra: 'VOLTO JÁ', mensagem: '', hora: '14:30' }), ['VOLTO JÁ', 'Volto às 14:30']);
  assert.deepEqual(textos({ palavra: 'VOLTO JÁ', mensagem: '', hora: '' }), ['VOLTO JÁ']);
  assert.deepEqual(textos({ palavra: 'VOLTO JÁ', mensagem: '', hora: '25:99' }), ['VOLTO JÁ']);
  assert.deepEqual(textos({ palavra: 'ABERTO', mensagem: 'Olá', hora: '14:30' }), ['ABERTO', 'Olá']);
  assert.deepEqual(textos({ palavra: 'XPTO' }), ['ABERTO']);
  assert.ok(horaValida('09:05') && !horaValida('9:05'));
});

test('limites de caracteres e de linhas; texto fica como texto', () => {
  assert.equal(limitar('abcdef', 3), 'abc');
  assert.deepEqual(dividirLinhas(' a \r\n\n b ', 5), ['a', 'b']);
  const t = montarFolha('aviso', { titulo: 'x'.repeat(100), mensagem: '<b>oi</b>' });
  assert.equal(t[0].texto.length, 40);
  assert.equal(t[1].texto, '<b>oi</b>');
});

test('horário por defeito: título, 3 linhas e nota', () => {
  const b = montarFolha('horario', valoresPorDefeito('horario'));
  assert.deepEqual(b.map((x) => x.tipo), ['titulo', 'linha', 'linha', 'linha', 'nota']);
});
