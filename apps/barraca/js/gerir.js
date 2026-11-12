// Gestão pela organização: lista de inscritos por turno, com "Remover" (link secreto em #chave).
import { carregarFesta, carregarDados, verificarChave, removerInscricao } from './api.js';
import { h, $, preencher, marcarPronta } from './dom.js';
import { criarIndicador } from './indicador.js';
import { iniciarAtualizacao } from './tempo-real.js';
import { confirmar } from './dialogos.js';
import { agruparPorDiaEPosto, intervaloDatas, mensagemErro, slugValido, chaveDia, chaveDoFragmento } from './logica.js';

const estado = { slug: null, chave: null, festa: null, dados: null, dia: null, diaEscolhido: false, assinatura: '', aCarregar: false };
const indicador = criarIndicador($('ligacao'));

async function arrancar() {
  estado.slug = new URLSearchParams(location.search).get('f');
  estado.chave = chaveDoFragmento(location.hash);
  if (!slugValido(estado.slug) || !estado.chave) return mostrarProblema('chave_invalida');

  try {
    if (!(await verificarChave(estado.slug, estado.chave))) return mostrarProblema('chave_invalida');
    estado.festa = await carregarFesta(estado.slug);
    if (!estado.festa) return mostrarProblema('chave_invalida');
    estado.dados = await carregarDados(estado.festa.id);
  } catch (erro) {
    return mostrarProblema(erro.codigo ?? 'outro', true);
  }

  document.title = `Gerir ${estado.festa.nome} · Barraca`;
  $('titulo').textContent = `Gerir: ${estado.festa.nome}`;
  $('detalhes').textContent = `${estado.festa.localidade} · ${intervaloDatas(estado.festa.data_inicio, estado.festa.data_fim)}`;
  $('link-publica').href = `festa.html?f=${encodeURIComponent(estado.slug)}`;
  $('publica').hidden = false;
  $('ligacao').hidden = false;
  $('controlos').hidden = false;
  indicador.sucesso();
  renderizar(true);
  marcarPronta();
  iniciarAtualizacao({ festaId: estado.festa.id, recarregar, aMudarModo: (m) => indicador.modo(m) });
}

function mostrarProblema(codigo, podeRepetir = false) {
  $('titulo').textContent = 'Não foi possível abrir a gestão';
  preencher($('conteudo'),
    h('div', { class: 'vazio' },
      h('p', {}, mensagemErro(codigo)),
      podeRepetir
        ? h('button', { type: 'button', class: 'botao botao--primario', onclick: () => location.reload() }, 'Tentar outra vez')
        : h('a', { class: 'botao botao--primario', href: 'index.html' }, 'Voltar ao início')));
  marcarPronta();
}

async function recarregar() {
  if (estado.aCarregar) return;
  estado.aCarregar = true;
  indicador.carregando();
  try {
    estado.dados = await carregarDados(estado.festa.id);
    indicador.sucesso();
    renderizar();
  } catch { indicador.falha(); } finally { estado.aCarregar = false; }
}

function renderizar(forcar = false) {
  const { postos, turnos, inscricoes } = estado.dados;
  const dias = agruparPorDiaEPosto(turnos, postos, new Date(), inscricoes);
  if (!dias.some((d) => d.chave === estado.dia)) estado.diaEscolhido = false;
  if (!estado.diaEscolhido) estado.dia = (dias.find((d) => d.chave >= chaveDia(new Date())) ?? dias[0])?.chave ?? null;

  const assinatura = JSON.stringify([dias, estado.dia, inscricoes.map((i) => i.id)]);
  if (!forcar && assinatura === estado.assinatura) return;
  estado.assinatura = assinatura;

  const foco = document.activeElement?.dataset?.foco;
  const nav = $('dias');
  nav.hidden = dias.length < 2;
  preencher(nav, dias.map((d) => h('button', {
    type: 'button', class: 'dia', 'aria-pressed': String(d.chave === estado.dia), 'aria-label': d.longo, dataset: { foco: `dia-${d.chave}` },
    onclick: () => { estado.dia = d.chave; estado.diaEscolhido = true; renderizar(); },
  }, d.curto)));

  const dia = dias.find((d) => d.chave === estado.dia);
  preencher($('conteudo'), dia
    ? dia.postos.map(({ posto, turnos: ts }) => h('section', { class: 'posto', 'aria-labelledby': `posto-${posto.id}` },
      h('h2', { class: 'posto__titulo', id: `posto-${posto.id}` }, posto.nome),
      h('ul', { class: 'turnos' }, ts.map(cartaoTurno))))
    : h('div', { class: 'vazio' }, h('p', {}, 'Esta festa ainda não tem turnos.')));
  if (foco) document.querySelector(`[data-foco="${CSS.escape(foco)}"]`)?.focus();
}

function cartaoTurno({ turno, estado: e, intervalo, resumo }) {
  const inscritos = estado.dados.inscricoes.filter((i) => i.turno_id === turno.id);
  return h('li', { class: `turno turno--${e.tipo}` },
    h('div', { class: 'turno__topo' },
      h('p', { class: 'turno__hora' }, intervalo),
      h('p', { class: 'estado' }, h('span', { class: 'estado__forma', 'aria-hidden': 'true' }, e.simbolo), `${turno.ocupadas} de ${turno.vagas} · ${e.texto}`)),
    inscritos.length
      ? h('ul', { class: 'turno__nomes inscritos' }, inscritos.map((i) => h('li', { class: 'inscritos__item' },
        h('span', { class: 'inscritos__nome' }, i.primeiro_nome),
        h('button', {
          type: 'button', class: 'botao botao--perigo-suave', dataset: { foco: `rem-${i.id}` },
          'aria-label': `Remover ${i.primeiro_nome} de ${resumo}`, onclick: () => remover(i, resumo),
        }, 'Remover'))))
      : h('p', { class: 'turno__nomes turno__nomes--vazio' }, 'Ainda ninguém inscrito'));
}

async function remover(inscricao, resumo) {
  const sim = await confirmar({
    titulo: 'Remover esta inscrição?', texto: `${inscricao.primeiro_nome} · ${resumo}. A vaga fica livre outra vez.`,
    rotulo: 'Sim, remover', perigo: true,
  });
  if (!sim) return;
  try {
    await removerInscricao(estado.slug, estado.chave, inscricao.id);
    $('aviso').hidden = true;
    const c = $('confirmacao');
    preencher(c, h('span', { class: 'aviso__forma', 'aria-hidden': 'true' }, '✓'), h('p', {}, `Inscrição removida: ${inscricao.primeiro_nome}.`));
    c.hidden = false;
    await recarregar();
    renderizar(true);
  } catch (erro) {
    const a = $('aviso');
    a.textContent = mensagemErro(erro);
    a.hidden = false;
  }
}

arrancar();
