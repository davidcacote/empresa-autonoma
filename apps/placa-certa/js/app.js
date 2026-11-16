// Placa Certa: formulário + pré-visualização A4 em direto. Tudo como texto (textContent), sem backend.
import { MODELOS, modeloPorId, valoresPorDefeito, limitar, montarFolha } from './modelos.js';

const $ = (id) => document.getElementById(id);
function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) el.setAttribute(k, v === true ? '' : String(v));
  el.append(...filhos.filter((f) => f != null));
  return el;
}

let modeloId = MODELOS[0].id;
let valores = valoresPorDefeito(modeloId);

function desenharFolha() {
  const folha = $('folha');
  folha.dataset.modelo = modeloId;
  folha.replaceChildren(...montarFolha(modeloId, valores).map((b) => {
    if (b.tipo === 'item') return h('div', { class: 'folha__item' }, h('span', { class: 'folha__nome' }, b.nome), b.preco ? h('span', { class: 'folha__preco' }, b.preco) : null);
    return h('p', { class: `folha__${b.tipo}` }, b.texto);
  }));
}

function desenharCampos() {
  const m = modeloPorId(modeloId);
  $('campos').replaceChildren(...m.campos.map((c) => {
    const id = `campo-${c.id}`;
    let el;
    if (c.tipo === 'escolha') {
      el = h('select', { id, name: c.id }, ...c.opcoes.map((o) => h('option', { value: o }, o)));
    } else if (c.tipo === 'hora') {
      el = h('input', { id, name: c.id, type: 'time' });
    } else if (c.tipo === 'area') {
      el = h('textarea', { id, name: c.id, rows: 6, maxlength: c.max });
    } else {
      el = h('input', { id, name: c.id, type: 'text', maxlength: c.max });
    }
    el.value = valores[c.id] ?? '';
    el.addEventListener('input', () => { valores[c.id] = limitar(el.value, c.max); desenharFolha(); });
    return h('div', { class: 'campo' }, h('label', { for: id }, c.rotulo), el);
  }));
}

function escolherModelo(id) {
  modeloId = id;
  valores = valoresPorDefeito(id);
  desenharCampos();
  desenharFolha();
}

function iniciar() {
  const sel = $('modelo');
  sel.replaceChildren(...MODELOS.map((m) => h('option', { value: m.id }, m.nome)));
  sel.addEventListener('change', () => escolherModelo(sel.value));
  $('imprimir').addEventListener('click', () => window.print());
  escolherModelo(modeloId);
  document.body.dataset.pronto = 'sim';
}
iniciar();
