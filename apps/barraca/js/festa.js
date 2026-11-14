// Página pública da festa: turnos por dia e posto, inscrição, "as minhas inscrições".
import { carregarFesta, carregarDados, inscrever, cancelarInscricao } from './api.js';
import { h, $, preencher, marcarPronta } from './dom.js';
import { idDispositivo, minhasInscricoes } from './armazem.js';
import { criarIndicador } from './indicador.js';
import { iniciarAtualizacao } from './tempo-real.js';
import { confirmar } from './dialogos.js';
import { criarIcs, uidInscricao, nomeFicheiroIcs } from './ics.js';
import {
  agruparPorDiaEPosto, intervaloDatas, mensagemErro, resumoNomes, slugValido, validarNome, chaveDia, textoPartilha, ligacaoWhatsApp,
} from './logica.js';

const estado = {
  slug: null, festa: null, dados: null,
  dia: null, diaEscolhido: false, soLivres: false,
  assinatura: '', aCarregar: false, turnoAtivo: null, aEnviar: false,
};
const indicador = criarIndicador($('ligacao'));

// ── Arranque ────────────────────────────────────────────────────────────────
// (arrancar() é chamado no fim do ficheiro, depois de tudo estar definido)

async function arrancar() {
  estado.slug = new URLSearchParams(location.search).get('f');
  if (!slugValido(estado.slug)) return mostrarVazio('Não encontrámos esta festa', 'O endereço parece estar incompleto. Confirme que copiou o link inteiro.');
  indicador.carregando();
  try {
    estado.festa = await carregarFesta(estado.slug);
    if (!estado.festa) return mostrarVazio('Não encontrámos esta festa', 'Talvez o link esteja errado, ou a festa já tenha sido apagada.');
    estado.dados = await carregarDados(estado.festa.id);
  } catch (erro) {
    indicador.falha();
    return mostrarErroInicial(erro);
  }
  indicador.sucesso();
  desenharCabecalho();
  preparar();
  renderizar(true);
  marcarPronta();
  iniciarAtualizacao({ festaId: estado.festa.id, recarregar, aMudarModo: (m) => indicador.modo(m) });
}

/** Volta a ler os dados (sondagem, evento em tempo real ou ao voltar ao separador). */
async function recarregar() {
  if (estado.aCarregar || !estado.festa) return;
  estado.aCarregar = true;
  indicador.carregando();
  try {
    estado.dados = await carregarDados(estado.festa.id);
    indicador.sucesso();
    renderizar();
  } catch {
    indicador.falha();
  } finally {
    estado.aCarregar = false;
  }
}

function mostrarVazio(titulo, texto) {
  $('titulo').textContent = titulo;
  $('ligacao').hidden = true;
  preencher($('conteudo'),
    h('div', { class: 'vazio' },
      h('p', { class: 'vazio__bandeira', 'aria-hidden': 'true' }, '⚑'),
      h('p', {}, texto),
      h('a', { class: 'botao botao--primario', href: 'index.html' }, 'Voltar ao início')));
  document.title = `${titulo} · Barraca`;
  marcarPronta();
}

function mostrarErroInicial(erro) {
  $('titulo').textContent = 'Não foi possível abrir a festa';
  preencher($('conteudo'),
    h('div', { class: 'vazio' },
      h('p', {}, mensagemErro(erro)),
      h('button', { type: 'button', class: 'botao botao--primario', onclick: () => location.reload() }, 'Tentar outra vez')));
  marcarPronta();
}

function desenharCabecalho() {
  const { nome, localidade, data_inicio: ini, data_fim: fim, descricao } = estado.festa;
  document.title = `${nome} · Barraca`;
  $('titulo').textContent = nome;
  $('detalhes').textContent = `${localidade} · ${intervaloDatas(ini, fim)}`;
  if (descricao) { $('descricao').textContent = descricao; $('descricao').hidden = false; }
  const link = new URL(`festa.html?f=${encodeURIComponent(estado.slug)}`, location.href).href;
  $('partilhar').href = ligacaoWhatsApp(textoPartilha({ nome, localidade, ini, fim }, link));
  $('partilhar').hidden = false;
  $('controlos').hidden = false;
}

// ── Desenho da lista ────────────────────────────────────────────────────────

function renderizar(forcar = false) {
  const agora = new Date();
  const { postos, turnos, inscricoes } = estado.dados;
  const dias = agruparPorDiaEPosto(turnos, postos, agora, inscricoes);
  const minhas = minhasInscricoes.listar(estado.slug);

  // Dia mostrado: o escolhido; senão o primeiro com turnos ainda por acabar (ou o primeiro)
  if (!dias.some((d) => d.chave === estado.dia)) estado.diaEscolhido = false;
  if (!estado.diaEscolhido) {
    const hoje = chaveDia(agora);
    estado.dia = (dias.find((d) => d.chave >= hoje) ?? dias[0])?.chave ?? null;
  }

  // Só mexe no DOM se algo mudou (não rouba o foco a quem está a navegar)
  const assinatura = JSON.stringify([dias, estado.dia, estado.soLivres, minhas.map((m) => m.id)]);
  if (!forcar && assinatura === estado.assinatura) return;
  estado.assinatura = assinatura;

  const focoAnterior = document.activeElement?.dataset?.foco;
  const jaInscritos = new Set(minhas.map((m) => m.turnoId));
  desenharDias(dias);
  desenharPostos(dias.find((d) => d.chave === estado.dia), jaInscritos);
  desenharMinhas(minhas);
  if (focoAnterior) document.querySelector(`[data-foco="${CSS.escape(focoAnterior)}"]`)?.focus();
}

function desenharDias(dias) {
  const nav = $('dias');
  nav.hidden = dias.length < 2;
  preencher(nav, dias.map((d) => h('button', {
    type: 'button', class: 'dia', 'aria-pressed': String(d.chave === estado.dia), 'aria-label': d.longo,
    dataset: { foco: `dia-${d.chave}` },
    onclick: () => { estado.dia = d.chave; estado.diaEscolhido = true; renderizar(); },
  }, d.curto)));
}

function desenharPostos(dia, jaInscritos) {
  const raiz = $('conteudo');
  if (!dia) {
    return preencher(raiz, h('div', { class: 'vazio' }, h('p', {}, 'Esta festa ainda não tem turnos.')));
  }
  const postos = dia.postos
    .map(({ posto, turnos }) => ({ posto, turnos: turnos.filter((t) => !estado.soLivres || t.estado.reservavel) }))
    .filter((p) => p.turnos.length);
  if (!postos.length) {
    return preencher(raiz, h('div', { class: 'vazio' }, h('p', {}, 'Não há vagas livres neste dia. Experimente outro dia ou desligue o filtro.')));
  }
  preencher(raiz, postos.map(({ posto, turnos }) =>
    h('section', { class: 'posto', 'aria-labelledby': `posto-${posto.id}` },
      h('h2', { class: 'posto__titulo', id: `posto-${posto.id}` }, posto.nome),
      h('ul', { class: 'turnos' }, turnos.map((t) => cartaoTurno(t, jaInscritos.has(t.turno.id)))))));
}

function cartaoTurno({ turno, estado: e, intervalo, nomes, resumo }, jaInscrito) {
  const podeInscrever = e.reservavel && !jaInscrito;
  return h('li', { class: `turno turno--${e.tipo}` },
    h('div', { class: 'turno__topo' },
      h('p', { class: 'turno__hora' }, intervalo),
      h('p', { class: 'estado' }, h('span', { class: 'estado__forma', 'aria-hidden': 'true' }, e.simbolo), e.texto)),
    h('p', { class: `turno__nomes${nomes.length ? '' : ' turno__nomes--vazio'}` },
      nomes.length ? [h('span', { class: 'so-leitor' }, 'Inscritos: '), resumoNomes(nomes)] : 'Ainda ninguém inscrito'),
    h('button', {
      type: 'button', class: 'botao botao--primario botao--bloco', disabled: !podeInscrever,
      'aria-label': `${jaInscrito ? 'Já inscrito(a)' : 'Inscrever-me'}: ${resumo}`,
      dataset: { foco: `turno-${turno.id}`, turno: turno.id },
      onclick: (ev) => abrirInscricao(turno.id, resumo, ev.currentTarget),
    }, jaInscrito ? 'Já está inscrito(a)' : 'Inscrever-me'));
}

// ── Inscrição ───────────────────────────────────────────────────────────────

const dlg = $('dlg');
const campoNome = $('dlg-nome');
const campoMaior = $('dlg-maior');
const textoErro = $('dlg-erro');
let botaoOrigem = null;

function preparar() {
  $('so-livres').addEventListener('change', (ev) => { estado.soLivres = ev.target.checked; renderizar(); });
  $('form-inscricao').addEventListener('submit', enviarInscricao);
  $('dlg-cancelar').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (ev) => { if (ev.target === dlg) dlg.close(); });
  // Ao fechar sem inscrever, o foco volta ao botão de origem (com sucesso, vai para a confirmação)
  dlg.addEventListener('close', () => { if (dlg.returnValue !== 'ok' && botaoOrigem?.isConnected) botaoOrigem.focus(); });
}

function abrirInscricao(turnoId, resumo, botao) {
  estado.turnoAtivo = { id: turnoId, resumo };
  dlg.returnValue = '';
  botaoOrigem = botao;
  $('dlg-resumo').textContent = resumo;
  campoNome.value = '';
  campoMaior.checked = false;
  mostrarErroCampo(null);
  dlg.showModal();
  campoNome.focus();
}

function mostrarErroCampo(mensagem, campo) {
  textoErro.textContent = mensagem ?? '';
  for (const c of [campoNome, campoMaior]) c.removeAttribute('aria-invalid');
  if (mensagem && campo) { campo.setAttribute('aria-invalid', 'true'); campo.focus(); }
}

async function enviarInscricao(ev) {
  ev.preventDefault();
  if (estado.aEnviar) return;
  const nome = validarNome(campoNome.value);
  if (!nome.ok) return mostrarErroCampo(nome.mensagem, campoNome);
  if (!campoMaior.checked) return mostrarErroCampo(mensagemErro('confirmar_maioridade'), campoMaior);

  mostrarErroCampo(null);
  estado.aEnviar = true;
  const botao = $('dlg-confirmar');
  botao.disabled = true;
  botao.textContent = 'A inscrever…';
  const { id: turnoId, resumo } = estado.turnoAtivo;
  try {
    const r = await inscrever(turnoId, nome.valor, idDispositivo(), true);
    minhasInscricoes.adicionar({ id: r.id, slug: estado.slug, turnoId, nome: r.primeiro_nome, resumo });
    dlg.close('ok');
    mostrarConfirmacao(`Está inscrito(a), ${r.primeiro_nome}!`, resumo, eventoDoTurno(turnoId, r.id));
    limparAviso();
    await recarregar();
    renderizar(true);
  } catch (erro) {
    const fechaFolha = ['turno_cheio', 'turno_terminado', 'turno_inexistente'].includes(erro.codigo);
    if (fechaFolha) { dlg.close(); mostrarAviso(mensagemErro(erro)); recarregar(); }
    else mostrarErroCampo(mensagemErro(erro), erro.codigo === 'nome_invalido' ? campoNome : null);
  } finally {
    estado.aEnviar = false;
    botao.disabled = false;
    botao.textContent = 'Confirmar';
  }
}

// ── Avisos e confirmação ────────────────────────────────────────────────────

function mostrarAviso(texto) {
  const el = $('aviso');
  el.textContent = texto;
  el.hidden = false;
  el.scrollIntoView({ block: 'nearest' });
}
const limparAviso = () => { $('aviso').hidden = true; $('aviso').textContent = ''; };

/** Confirmação escrita, sempre visível até haver outra ação. */
function mostrarConfirmacao(titulo, detalhe, evento = null) {
  const el = $('confirmacao');
  preencher(el, h('span', { class: 'aviso__forma', 'aria-hidden': 'true' }, '✓'),
    h('div', {},
      h('p', {}, h('strong', {}, titulo), detalhe ? ` ${detalhe}` : ''),
      evento && h('button', {
        type: 'button', class: 'botao botao--secundario', dataset: { acao: 'calendario' },
        onclick: () => descarregarIcs(evento),
      }, 'Adicionar ao calendário')));
  el.hidden = false;
  el.scrollIntoView({ block: 'nearest' });
  el.focus({ preventScroll: true });
}

// ── Calendário (.ics) ───────────────────────────────────────────────────────

/** Dados do turno para o calendário (a partir do que a página já carregou); null se o turno já não existir. */
function eventoDoTurno(turnoId, inscricaoId) {
  const turno = estado.dados.turnos.find((t) => t.id === turnoId);
  const posto = estado.dados.postos.find((p) => p.id === turno?.posto_id);
  if (!turno || !posto) return null;
  return {
    uid: uidInscricao(inscricaoId), festa: estado.festa.nome, posto: posto.nome,
    localidade: estado.festa.localidade, inicio: turno.inicio, fim: turno.fim,
  };
}

function descarregarIcs(evento) {
  const ficheiro = new Blob([criarIcs(evento)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(ficheiro);
  const a = h('a', { href: url, download: nomeFicheiroIcs(evento.festa) });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ── As minhas inscrições ────────────────────────────────────────────────────

function desenharMinhas(minhas) {
  $('minhas').hidden = minhas.length === 0;
  preencher($('minhas-lista'), minhas.map((m) => h('li', { class: 'minhas__item' },
    h('p', {}, h('strong', {}, m.nome), ' · ', m.resumo),
    h('button', { type: 'button', class: 'botao botao--secundario', onclick: () => cancelar(m) }, 'Cancelar a minha inscrição'))));
}

async function cancelar(m) {
  const sim = await confirmar({
    titulo: 'Cancelar a inscrição?', texto: `${m.resumo}. Se cancelar, a vaga fica livre para outra pessoa.`,
    rotulo: 'Sim, cancelar', perigo: true,
  });
  if (!sim) return;
  try {
    await cancelarInscricao(m.id, idDispositivo());
    minhasInscricoes.remover(m.id);
    limparAviso();
    mostrarConfirmacao('A sua inscrição foi cancelada.', m.resumo);
    await recarregar();
    renderizar(true);
  } catch (erro) {
    mostrarAviso(mensagemErro(erro));
  }
}

arrancar();
