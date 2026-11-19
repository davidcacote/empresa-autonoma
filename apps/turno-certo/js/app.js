// Turno Certo: interface. Tudo como texto (textContent), sem backend e sem pedidos de rede.
import * as L from './logica.js';
import { criarArmazem } from './armazem.js';

const $ = (id) => document.getElementById(id);
function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) el.setAttribute(k, v === true ? '' : String(v));
  el.append(...filhos.filter((f) => f != null));
  return el;
}

const armazem = criarArmazem();
let dados = armazem.ler();
dados.folhas = dados.folhas.filter(L.folhaValida);
if (!dados.folhas.some((f) => f.id === dados.atual)) dados.atual = dados.folhas[0]?.id ?? null;
let rascunho = [];
let aCriar = dados.folhas.length === 0;

const atual = () => dados.folhas.find((f) => f.id === dados.atual) ?? null;

function dizer(msg, erro = false) { const e = $('estado'); e.textContent = msg; e.classList.toggle('erro', erro); }

function guardar() {
  if (!armazem.gravar(dados)) dizer('Não foi possível guardar. Os dados mantêm-se só nesta página.', true);
}

function aplicar(r, msgOk, foco) {
  if (!r.ok) { dizer(r.erro, true); return false; }
  const i = dados.folhas.findIndex((f) => f.id === dados.atual);
  dados.folhas[i] = r.folha;
  guardar();
  dizer(msgOk ?? '');
  desenhar();
  if (foco) $(foco)?.focus();
  return true;
}

function desenharEscolha() {
  const sel = $('folhas');
  sel.replaceChildren(...dados.folhas.map((f) => h('option', { value: f.id }, `${f.nome} (${L.formatarData(f.data)})`)));
  if (dados.atual) sel.value = dados.atual;
  sel.disabled = dados.folhas.length === 0;
}

function desenharRascunho() {
  $('c-lista').replaceChildren(...rascunho.map((p, i) => h('li', {},
    h('span', {}, `${p.horario}: ${p.vagas} ${p.vagas === 1 ? 'vaga' : 'vagas'}`),
    (() => { const b = h('button', { type: 'button', class: 'botao botao--sec botao--mini', 'aria-label': `Remover posto ${p.horario}` }, 'Remover'); b.addEventListener('click', () => { rascunho.splice(i, 1); desenharRascunho(); }); return b; })())));
}

function linhaInscricao(folha, posto, i) {
  const acoes = h('div', { class: 'insc__acoes nao-imprimir' });
  const btn = (txt, rotulo, fn) => { const b = h('button', { type: 'button', class: 'botao botao--sec botao--mini', 'aria-label': rotulo }, txt); b.addEventListener('click', fn); return b; };
  const f = i.ficha;
  const refoco = `ficha-${posto.id}`;
  const partes = [h('span', {}, h('strong', {}, `Ficha ${f}`), ' ', i.faltou ? h('span', { class: 'etiqueta etiqueta--falta' }, 'FALTOU') : h('span', { class: 'etiqueta' }, 'presente'))];
  if (!i.faltou) {
    acoes.append(btn('Faltou', `Marcar a ficha ${f} como faltou`, () => aplicar(L.marcarFalta(folha, posto.id, f), `Ficha ${f} marcada como faltou.`, refoco)),
      btn('Remover', `Remover a ficha ${f} do turno`, () => aplicar(L.removerInscricao(folha, posto.id, f), `Ficha ${f} removida.`, refoco)));
  } else {
    if (i.substituto) {
      partes.push(h('span', {}, `Substituto: ficha ${i.substituto.ficha} `, h('span', { class: i.substituto.validada ? 'etiqueta' : 'etiqueta etiqueta--falta' }, i.substituto.validada ? 'validada, falta coberta' : 'por validar')));
      if (!i.substituto.validada) acoes.append(btn('Validar substituto', `Validar o substituto ${i.substituto.ficha} da ficha ${f}`, () => aplicar(L.validarSubstituto(folha, posto.id, f), `Substituto da ficha ${f} validado.`, refoco)));
    } else partes.push(h('span', {}, 'Sem substituto'));
    if (!i.substituto?.validada) {
      const id = `sub-${posto.id}-${f}`;
      const campo = h('input', { id, inputmode: 'numeric', maxlength: 6, autocomplete: 'off', 'aria-label': `Ficha substituta da ficha ${f}` });
      const reg = btn(i.substituto ? 'Trocar substituto' : 'Registar substituto', `Registar a ficha substituta da ficha ${f}`, () => aplicar(L.registarSubstituto(folha, posto.id, f, campo.value), `Substituto da ficha ${f} registado. Falta validar.`, refoco));
      campo.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); reg.click(); } });
      acoes.append(campo, reg);
    }
    acoes.append(btn('Desfazer falta', `Desfazer a falta da ficha ${f}`, () => aplicar(L.desfazerFalta(folha, posto.id, f), `Falta da ficha ${f} desfeita.`, refoco)));
  }
  return h('li', {}, h('div', {}, ...partes), acoes);
}

function desenharPosto(folha, posto) {
  const oc = L.ocupadas(posto);
  const falta = L.emFalta(posto);
  const titulo = h('h3', {}, h('span', {}, `Posto ${posto.horario}`),
    h('span', { class: 'contador', 'aria-live': 'polite' }, `${oc}/${posto.vagas} ocupadas`),
    falta > 0 ? h('span', { class: 'faltam' }, `FALTAM ${falta} ${falta === 1 ? 'vaga' : 'vagas'}`) : h('span', { class: 'contador' }, 'COMPLETO'));
  const lista = h('ul', { class: 'lista insc', 'aria-label': `Inscrições do posto ${posto.horario}` },
    ...(posto.inscricoes.length ? posto.inscricoes.map((i) => linhaInscricao(folha, posto, i)) : [h('li', {}, 'Sem inscrições.')]));
  const campo = h('input', { id: `ficha-${posto.id}`, inputmode: 'numeric', maxlength: 6, autocomplete: 'off' });
  const form = h('form', { class: 'form-ficha', novalidate: true },
    h('div', { class: 'campo' }, h('label', { for: `ficha-${posto.id}` }, `Número da ficha (posto ${posto.horario})`), campo),
    h('button', { type: 'submit', class: 'botao' }, 'Inscrever'));
  form.addEventListener('submit', (e) => { e.preventDefault(); aplicar(L.inscrever(folha, posto.id, campo.value), `Ficha ${L.normalizarFicha(campo.value)} inscrita no posto ${posto.horario}.`, `ficha-${posto.id}`); });
  return h('section', { class: `posto posto--${L.estadoPosto(posto)}`, 'aria-label': `Posto ${posto.horario}` }, titulo, lista, form);
}

function desenharFolha() {
  const folha = atual();
  $('sec-folha').hidden = !folha || aCriar;
  if (!folha) return;
  $('t-folha').textContent = folha.nome;
  $('folha-data').textContent = `Data: ${L.formatarData(folha.data)}`;
  const r = L.resumo(folha);
  $('resumo').textContent = `${r.ocupadas}/${r.vagas} vagas ocupadas. ${r.emFalta > 0 ? `FALTAM ${r.emFalta}.` : 'Folha completa.'} Pendências: ${r.pendencias}.`;
  const pend = L.pendencias(folha);
  $('pendencias').replaceChildren(...(pend.length
    ? pend.map((p) => h('li', {}, `Posto ${p.horario}: ficha ${p.ficha} faltou. ${p.substituto ? `Substituto ${p.substituto} por validar.` : 'Sem substituto.'}`))
    : [h('li', { class: 'vazio' }, 'Nenhuma pendência.')]));
  $('postos').replaceChildren(...folha.postos.map((p) => desenharPosto(folha, p)));
}

function desenhar() {
  $('sec-criar').hidden = !aCriar;
  desenharEscolha();
  desenharRascunho();
  desenharFolha();
}

function lerPosto(idH, idV) { return { horario: $(idH).value, vagas: $(idV).value === '' ? NaN : Number($(idV).value) }; }

function iniciar() {
  $('aviso-memoria').hidden = armazem.persistente;
  $('folhas').addEventListener('change', (e) => { dados.atual = e.target.value; guardar(); aCriar = false; desenhar(); });
  $('nova').addEventListener('click', () => { aCriar = true; rascunho = []; $('c-erro').textContent = ''; desenhar(); $('c-nome').focus(); });
  $('c-cancelar').addEventListener('click', () => { aCriar = false; desenhar(); });
  $('exemplo').addEventListener('click', () => {
    const f = L.festaExemplo();
    dados.folhas.push(f); dados.atual = f.id; aCriar = false; guardar(); dizer('Festa de exemplo carregada (dados fictícios).'); desenhar();
  });
  $('c-add').addEventListener('click', () => {
    const p = lerPosto('c-horario', 'c-vagas');
    const e = L.validarPosto(p);
    $('c-erro').textContent = e ?? '';
    if (e) return;
    rascunho.push({ horario: p.horario.trim(), vagas: p.vagas });
    $('c-horario').value = ''; desenharRascunho(); $('c-horario').focus();
  });
  $('form-criar').addEventListener('submit', (e) => {
    e.preventDefault();
    const pend = lerPosto('c-horario', 'c-vagas');
    const postos = [...rascunho];
    if (pend.horario.trim() && !L.validarPosto(pend)) postos.push({ horario: pend.horario.trim(), vagas: pend.vagas });
    const r = L.criarFolha({ nome: $('c-nome').value, data: $('c-data').value, postos });
    if (!r.ok) { $('c-erro').textContent = r.erro; return; }
    dados.folhas.push(r.folha); dados.atual = r.folha.id; aCriar = false; rascunho = [];
    $('c-nome').value = ''; $('c-data').value = ''; $('c-horario').value = ''; $('c-erro').textContent = '';
    guardar(); dizer(`Folha "${r.folha.nome}" criada.`); desenhar();
  });
  $('form-posto').addEventListener('submit', (e) => {
    e.preventDefault();
    if (aplicar(L.adicionarPosto(atual(), lerPosto('p-horario', 'p-vagas')), 'Posto adicionado.')) $('p-horario').value = '';
  });
  $('imprimir').addEventListener('click', () => window.print());
  desenhar();
  document.body.dataset.pronto = 'sim';
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
}
iniciar();
