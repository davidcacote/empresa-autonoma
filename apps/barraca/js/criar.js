// Criar festa: formulário com postos e turnos dinâmicos; no fim mostra os links de voluntários e de gestão.
import { criarFesta } from './api.js';
import { h, $, preencher, marcarPronta } from './dom.js';
import { guardarFestaCriada } from './armazem.js';
import { chaveDia, diasEntre, rotuloDia, validarFesta, montarPayloadFesta, mensagemErro, LIMITES, textoPartilha, ligacaoWhatsApp } from './logica.js';

const form = $('form-festa');
const raizPostos = $('postos');
let enviando = false;

// ── Construção do formulário ────────────────────────────────────────────────

const campoTexto = (rotulo, atributos) =>
  h('label', { class: 'campo' }, h('span', { class: 'campo__rotulo' }, rotulo), h('input', atributos));

function criarTurno() {
  const linha = h('div', { class: 'turno-form', role: 'group' },
    h('label', { class: 'campo' }, h('span', { class: 'campo__rotulo' }, 'Dia'), h('select', { 'data-parte': 'dia' })),
    h('div', { class: 'par' },
      campoTexto('Início', { type: 'time', value: '18:00', 'data-parte': 'inicio' }),
      campoTexto('Fim', { type: 'time', value: '20:00', 'data-parte': 'fim' })),
    campoTexto('Vagas', { type: 'number', min: 1, max: 50, value: 3, inputmode: 'numeric', 'data-parte': 'vagas' }),
    h('button', { type: 'button', class: 'botao botao--texto', onclick: () => { linha.remove(); renumerar(); } }, 'Remover turno'));
  return linha;
}

function criarPosto() {
  const turnos = h('div', { class: 'turnos-form' });
  const posto = h('fieldset', { class: 'bloco posto-form' },
    h('legend', {}, 'Posto'),
    campoTexto('Nome do posto', { type: 'text', maxlength: 40, autocomplete: 'off', placeholder: 'Bar', 'data-parte': 'nome' }),
    turnos,
    h('div', { class: 'acoes-linha' },
      h('button', { type: 'button', class: 'botao botao--secundario', onclick: () => { turnos.append(criarTurno()); preencherDias(); renumerar(); } }, '+ Adicionar turno'),
      h('button', { type: 'button', class: 'botao botao--texto', 'data-remover-posto': '', onclick: () => { posto.remove(); renumerar(); } }, 'Remover posto')));
  turnos.append(criarTurno());
  return posto;
}

/** Numera legendas e esconde "Remover" quando só há um posto / um turno. */
function renumerar() {
  const postos = [...raizPostos.children];
  postos.forEach((p, i) => {
    p.querySelector('legend').textContent = `Posto ${i + 1}`;
    p.querySelector('[data-remover-posto]').hidden = postos.length === 1;
    p.querySelector('[data-parte="nome"]').dataset.campo = `postos.${i}.nome`;
    const turnos = [...p.querySelectorAll('.turno-form')];
    turnos.forEach((t, j) => {
      t.setAttribute('aria-label', `Turno ${j + 1} do posto ${i + 1}`);
      t.querySelector('button').hidden = turnos.length === 1;
      // Cada campo do turno fica identificado pela posição (usado nos erros e nos testes)
      for (const el of t.querySelectorAll('[data-parte]')) el.dataset.campo = `postos.${i}.turnos.${j}.${el.dataset.parte}`;
    });
  });
  $('mais-posto').disabled = postos.length >= LIMITES.postos;
}

/** As opções de "Dia" dependem das datas da festa. */
function preencherDias() {
  const { data_inicio: ini, data_fim: fim } = form.elements;
  const validas = ini.value && fim.value && fim.value >= ini.value;
  const dias = validas ? diasEntre(ini.value, fim.value).slice(0, LIMITES.diasMax + 1) : [];
  for (const sel of form.querySelectorAll('select[data-parte="dia"]')) {
    const atual = sel.value;
    preencher(sel, dias.length
      ? dias.map((d) => h('option', { value: d }, rotuloDia(d, 'completo')))
      : h('option', { value: '' }, 'Escolha primeiro as datas'));
    sel.value = dias.includes(atual) ? atual : (dias[0] ?? '');
    sel.disabled = dias.length === 0;
  }
}

// ── Leitura e validação ─────────────────────────────────────────────────────

function lerFormulario() {
  const f = form.elements;
  const postos = [...raizPostos.children].map((p) => {
    const turnos = [...p.querySelectorAll('.turno-form')].map((t) => {
      const valor = {};
      for (const el of t.querySelectorAll('[data-parte]')) valor[el.dataset.parte] = el.value;
      return valor;
    });
    return { nome: p.querySelector('[data-parte="nome"]').value, turnos };
  });
  return {
    nome: f.nome.value, localidade: f.localidade.value, descricao: f.descricao.value,
    dataInicio: f.data_inicio.value, dataFim: f.data_fim.value, postos,
  };
}

const campoDe = (nome) => form.querySelector(`[data-campo="${CSS.escape(nome)}"]`);

function mostrarErros(erros) {
  for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');
  const caixa = $('erros');
  if (!erros.length) { caixa.hidden = true; return; }
  for (const e of erros) campoDe(e.campo)?.setAttribute('aria-invalid', 'true');
  preencher(caixa, h('p', {}, h('strong', {}, 'Falta acertar o seguinte:')),
    h('ul', {}, erros.map((e) => h('li', {}, campoDe(e.campo)
      ? h('a', { href: '#', onclick: (ev) => { ev.preventDefault(); campoDe(e.campo).focus(); } }, e.mensagem)
      : e.mensagem))));
  caixa.hidden = false;
  caixa.focus();
}

// ── Envio ───────────────────────────────────────────────────────────────────

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (enviando) return;
  const dados = lerFormulario();
  const erros = validarFesta(dados, chaveDia(new Date()));
  mostrarErros(erros);
  if (erros.length) return;

  enviando = true;
  const botao = $('criar');
  botao.disabled = true;
  botao.textContent = 'A criar…';
  try {
    const { slug, chave } = await criarFesta(montarPayloadFesta(dados));
    mostrarSucesso(slug, chave, dados.nome.trim(), dados);
  } catch (erro) {
    mostrarErros([{ campo: '', mensagem: mensagemErro(erro) }]);
  } finally {
    enviando = false;
    botao.disabled = false;
    botao.textContent = 'Criar festa';
  }
});

function mostrarSucesso(slug, chave, nome, dados) {
  // Links absolutos a partir do endereço desta página (funciona em qualquer pasta do site)
  const voluntarios = new URL(`festa.html?f=${encodeURIComponent(slug)}`, location.href).href;
  const gestao = new URL(`gerir.html?f=${encodeURIComponent(slug)}`, location.href);
  gestao.hash = chave;
  guardarFestaCriada({ slug, nome, chave, gestao: gestao.href });
  for (const [id, url] of [['link-voluntarios', voluntarios], ['link-gestao', gestao.href]]) {
    const a = $(id);
    a.href = url;
    a.textContent = url;
  }
  $('partilhar').href = ligacaoWhatsApp(textoPartilha(
    { nome, localidade: dados.localidade.trim(), ini: dados.dataInicio, fim: dados.dataFim }, voluntarios));
  form.hidden = true;
  const painel = $('sucesso');
  painel.hidden = false;
  painel.focus();
  window.scrollTo({ top: 0 });
}

for (const botao of document.querySelectorAll('[data-copiar]')) {
  botao.addEventListener('click', async () => {
    const link = $(botao.dataset.copiar);
    let copiou = false;
    try { await navigator.clipboard.writeText(link.href); copiou = true; } catch {
      // Sem permissão da área de transferência: seleciona o texto para copiar à mão
      const sel = getSelection();
      const intervalo = document.createRange();
      intervalo.selectNodeContents(link);
      sel.removeAllRanges();
      sel.addRange(intervalo);
    }
    $('copiado').textContent = copiou ? 'Link copiado.' : 'Selecionámos o link: use "Copiar" no menu do telemóvel.';
  });
}

// ── Arranque ────────────────────────────────────────────────────────────────

$('mais-posto').addEventListener('click', () => {
  const posto = criarPosto();
  raizPostos.append(posto);
  preencherDias();
  renumerar();
  posto.querySelector('input').focus();
});
form.elements.data_inicio.min = chaveDia(new Date());
for (const nome of ['data_inicio', 'data_fim']) form.elements[nome].addEventListener('change', preencherDias);
// Ao escolher o início, sugere o mesmo dia para o fim (o utilizador ajusta se for mais longa)
form.elements.data_inicio.addEventListener('change', () => {
  const { data_inicio: ini, data_fim: fim } = form.elements;
  if (ini.value && (!fim.value || fim.value < ini.value)) { fim.value = ini.value; preencherDias(); }
  fim.min = ini.value;
});

raizPostos.append(criarPosto());
preencherDias();
renumerar();
marcarPronta();
