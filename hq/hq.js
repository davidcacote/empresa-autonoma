// Painel HQ: lê os ficheiros de empresa/dados (publicados em ./dados/) e desenha a sede.
// Todos os dados entram por textContent: nada é interpretado como HTML.

const FICHEIROS = ['empresa', 'equipa', 'reunioes', 'decisoes', 'backlog', 'ciclos', 'orcamento', 'build', 'mercado'];
const fmtData = new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtDia = new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', day: 'numeric', month: 'long', year: 'numeric' });

function el(tag, props = {}, ...filhos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'style') n.setAttribute('style', v);
    else if (k.startsWith('data-') || k.startsWith('aria-') || ['href', 'id', 'role', 'open', 'target', 'rel', 'title'].includes(k)) n.setAttribute(k, v === true ? '' : v);
    else n[k] = v;
  }
  for (const f of filhos.flat()) if (f !== null && f !== undefined && f !== false) n.append(f instanceof Node ? f : document.createTextNode(String(f)));
  return n;
}

const quando = (iso) => { try { return iso ? fmtData.format(new Date(iso)) : '—'; } catch { return String(iso); } };
const iniciais = (nome) => nome.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

async function carregar() {
  const dados = {};
  await Promise.all(FICHEIROS.map(async (f) => {
    try {
      const r = await fetch(`dados/${f}.json`, { cache: 'no-store' });
      dados[f] = r.ok ? await r.json() : null;
    } catch { dados[f] = null; }
  }));
  return dados;
}

function membroPorId(equipa) {
  const mapa = new Map((equipa ?? []).map((m) => [m.id, m]));
  mapa.set('sistema', { id: 'sistema', nome: 'Orquestrador', papel: 'coordena e executa', cor: '#565A63' });
  mapa.set('donos', { id: 'donos', nome: 'David e Joana', papel: 'donos', cor: '#1B1D22' });
  return (id) => mapa.get(id) ?? { id, nome: id, papel: '', cor: '#565A63' };
}

function avatar(m) {
  return el('span', { class: 'avatar', style: `background:${/^#[0-9a-f]{3,8}$/i.test(m.cor) ? m.cor : '#565A63'}`, 'aria-hidden': 'true', text: iniciais(m.nome) });
}

function desenharGeral(d, quem) {
  const e = d.empresa ?? {};
  const p = e.produto ?? {};
  const links = e.links ?? {};
  document.getElementById('nome-empresa').textContent = e.nome ?? 'Empresa Autónoma';

  const pausado = d.orcamento?.pausado === true;
  const estado = document.getElementById('estado-empresa');
  estado.dataset.estado = pausado ? 'pausada' : 'ativa';
  estado.textContent = pausado ? 'Pausada' : `Ativa · ciclo ${e.ciclo_atual ?? 0}`;

  document.getElementById('produto').replaceChildren(
    el('p', { class: 'rotulo', text: 'O produto' }),
    el('h2', { text: p.nome ?? '—' }),
    el('p', { text: p.pitch ?? '' }),
    el('p', { class: 'rotulo', text: p.estado ?? '' }),
    el('div', { class: 'acoes' },
      el('a', { class: 'botao primario', href: links.demo ?? '../', text: 'Ver a festa de demonstração' }),
      el('a', { class: 'botao', href: links.produto ?? '../', text: 'Abrir o produto' }),
      links.repositorio ? el('a', { class: 'botao', href: links.repositorio, text: 'Código no GitHub' }) : null),
  );

  const backlog = d.backlog ?? [];
  const feitos = backlog.filter((b) => b.estado === 'feito').length;
  const ultimoCiclo = (d.ciclos ?? []).at(-1);
  document.getElementById('indicadores').replaceChildren(
    ...[
      [String(e.ciclo_atual ?? 0), 'ciclo atual'],
      [e.proximo_ciclo ? quando(e.proximo_ciclo) : 'a agendar', 'próximo ciclo'],
      [`${feitos}/${backlog.filter((b) => b.estado !== 'cancelado').length}`, 'itens do backlog feitos'],
      [String((d.decisoes ?? []).length), 'decisões registadas'],
    ].map(([v, n]) => el('div', { class: 'indicador' }, el('span', { class: 'valor', text: v }), el('span', { class: 'nome', text: n }))),
  );

  const ultima = (d.reunioes ?? []).at(-1);
  const caixa = document.getElementById('ultima-reuniao');
  caixa.replaceChildren(el('h2', { text: 'Última reunião' }));
  if (ultima) {
    caixa.append(
      el('h3', { text: ultima.titulo }),
      el('p', { class: 'intro', text: `${quando(ultima.data)} · ${ultima.resumo ?? ''}` }),
      ultima.decisao ? el('p', { class: 'decisao-reuniao', text: ultima.decisao }) : null,
      el('p', {}, el('a', { href: '#reunioes', text: `Ler todas as reuniões (${d.reunioes.length})` })),
    );
  } else caixa.append(el('p', { class: 'vazio', text: 'Ainda não houve reuniões.' }));
  if (ultimoCiclo) caixa.append(el('p', { class: 'intro', text: `Último ciclo: n.º ${ultimoCiclo.n} — ${ultimoCiclo.objetivo} (${rotuloResultado(ultimoCiclo.resultado)})` }));

  const cv = e.ciclo_de_vida;
  const caixaCv = document.getElementById('ciclo-vida');
  if (cv && caixaCv) {
    const crit = cv.criterios_v1 ?? [];
    caixaCv.replaceChildren(
      el('h2', { text: 'Caminho até à v1.0' }),
      el('p', { class: 'intro', style: 'margin:0 0 .6rem', text: `Fase: ${cv.fase} · ${crit.filter((c) => c.feito).length} de ${crit.length} critérios · ${cv.ciclos_usados ?? 0} de ${cv.limite_v1 ?? '—'} ciclos usados · próxima reunião de mercado no ciclo ${cv.proxima_revisao_ciclo ?? '—'}` }),
      el('ul', { class: 'lista-simples' }, crit.map((c) => el('li', {}, el('span', { text: c.criterio }), el('span', { 'aria-label': c.feito ? 'cumprido' : 'por cumprir', text: c.feito ? '✓' : '○' })))),
      cv.ultima_revisao ? el('p', { class: 'intro', style: 'margin:.6rem 0 0', text: `Última revisão: ${cv.ultima_revisao}` }) : null);
  }

  const o = d.orcamento ?? {};
  document.getElementById('orcamento').replaceChildren(
    el('h2', { text: 'Orçamento' }),
    el('ul', { class: 'lista-simples' },
      ...[
        ['Estado', pausado ? `Pausado${o.motivo_pausa ? ' — ' + o.motivo_pausa : ''}` : 'A trabalhar'],
        ['Ciclos por dia', o.ciclos_por_dia ?? '—'],
        ['Máx. agentes por ciclo', o.max_agentes_por_ciclo ?? '—'],
        ['Modelo dos agentes', o.modelo_agentes ?? '—'],
        ['Objetivos por ciclo', o.objetivos_por_ciclo ?? '—'],
        ['Alvo de uso do plano', o.limite_uso_alvo_pct ? `< ${o.limite_uso_alvo_pct}%` : '—'],
      ].map(([a, b]) => el('li', {}, el('span', { text: a }), el('span', { text: String(b) })))),
    o.notas ? el('p', { class: 'intro', style: 'margin-top:.7rem', text: o.notas }) : null,
  );

  document.getElementById('intervir').replaceChildren(
    el('h2', { text: 'Como intervir' }),
    el('div', { class: 'links-intervir' },
      links.issues_donos ? el('a', { href: links.issues_donos }, el('strong', { text: 'Pedir algo à equipa' }), el('span', { text: 'Issue com a etiqueta "donos": passa à frente no próximo stand-up.' })) : null,
      links.orcamento ? el('a', { href: links.orcamento }, el('strong', { text: 'Pausar ou mudar o orçamento' }), el('span', { text: 'Editar orcamento.json ("pausado": true).' })) : null,
      links.ci ? el('a', { href: links.ci }, el('strong', { text: 'Ver o CI/CD' }), el('span', { text: 'Cada push valida, testa e publica.' })) : null),
  );
}

function rotuloResultado(r) {
  return ({ concluido: 'concluído', em_curso: 'em curso', falhou: 'falhou', bloqueado: 'bloqueado', pausado: 'pausado', sem_alteracoes: 'sem alterações' })[r] ?? r ?? '—';
}

function desenharReunioes(d, quem) {
  const lista = document.getElementById('lista-reunioes');
  const reunioes = [...(d.reunioes ?? [])].reverse();
  if (!reunioes.length) { lista.replaceChildren(el('p', { class: 'vazio', text: 'Ainda não houve reuniões.' })); return; }
  lista.replaceChildren(...reunioes.map((r, i) => el('details', { class: 'reuniao', open: i === 0 },
    el('summary', {},
      el('h3', { text: r.titulo }),
      el('span', { class: 'meta' },
        el('span', { text: quando(r.data) }),
        r.ciclo !== undefined ? el('span', { text: `ciclo ${r.ciclo}` }) : null,
        r.tipo ? el('span', { class: 'chip', text: r.tipo }) : null,
        el('span', { text: `${(r.intervencoes ?? []).length} intervenções` }))),
    el('div', { class: 'corpo' },
      r.resumo ? el('p', { class: 'resumo', text: r.resumo }) : null,
      ...(r.intervencoes ?? []).map((iv) => {
        const m = quem(iv.quem);
        return el('div', { class: 'fala' }, avatar(m),
          el('div', {}, el('div', { class: 'quem' }, m.nome, ' ', el('span', { text: `· ${m.papel}` })), el('div', { class: 'texto', text: iv.texto })));
      }),
      r.decisao ? el('p', { class: 'decisao-reuniao', text: `Decisão: ${r.decisao}` }) : null),
  )));
}

function desenharDecisoes(d, quem) {
  const lista = document.getElementById('lista-decisoes');
  const decisoes = [...(d.decisoes ?? [])].reverse();
  if (!decisoes.length) { lista.replaceChildren(el('p', { class: 'vazio', text: 'Sem decisões registadas.' })); return; }
  lista.replaceChildren(...decisoes.map((x) => el('article', { class: 'cartao decisao' },
    el('div', { class: 'cabeca' }, el('span', { class: 'id', text: x.id }), el('span', { class: 'chip', 'data-estado': x.estado, text: x.estado })),
    el('h3', { text: x.titulo }),
    el('p', { class: 'intro', style: 'margin:0', text: `${quem(x.autor).nome} · ${x.data}` }),
    el('dl', {},
      ...[['Contexto', x.contexto], ['Decisão', x.decisao], ['Consequências', x.consequencias]]
        .filter(([, v]) => v).flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })])),
  )));
}

function urlSegura(u) { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } }

function desenharMercado(d) {
  const m = d.mercado;
  const caixa = document.getElementById('mercado-conteudo');
  if (!m) { caixa.replaceChildren(el('p', { class: 'vazio', text: 'Ainda não houve reunião de mercado.' })); return; }
  const cartoes = (lista, desenhar) => el('div', { class: 'grelha-cartoes' }, (lista ?? []).map((x) => el('article', { class: 'cartao item-mercado' }, desenhar(x))));
  const campo = (rotulo, valor) => valor ? el('p', {}, el('span', { class: 'rotulo-campo', text: `${rotulo}: ` }), String(valor)) : null;
  const seg = new Map((m.segmentos ?? []).map((s) => [s.id, s.nome]));
  caixa.replaceChildren(
    m.resumo ? el('article', { class: 'cartao bloco-mercado' }, el('h2', { text: `Resumo · atualizado a ${m.atualizado_em ?? '—'}` }), el('p', { style: 'margin:0', text: m.resumo })) : null,
    el('section', { class: 'bloco-mercado' }, el('h2', { text: 'Grandes oportunidades' }),
      cartoes(m.oportunidades, (o) => [
        el('div', { class: 'topo-item' }, el('span', { text: o.id }), el('span', { class: 'chip', 'data-nivel': o.tamanho, text: `tamanho ${o.tamanho ?? '?'}` })),
        el('h3', { text: o.cliente }), el('p', { text: o.descricao }),
        campo('Porquê agora', o.porque_agora), campo('Primeiro passo', o.primeiro_passo), campo('Backlog', o.backlog)])),
    el('section', { class: 'bloco-mercado' }, el('h2', { text: 'Público-alvo' }),
      cartoes([...(m.segmentos ?? [])].sort((a, b) => (a.prioridade ?? 9) - (b.prioridade ?? 9)), (s) => [
        el('div', { class: 'topo-item' }, el('span', { text: s.id }), el('span', { text: `prioridade ${s.prioridade ?? '?'}` })),
        el('h3', { text: s.nome }), el('p', { text: s.descricao }),
        campo('Dor principal', s.dor_principal), campo('Dimensão', s.dimensao), campo('Como chegar', s.como_chegar)])),
    el('section', { class: 'bloco-mercado' }, el('h2', { text: 'Falhas que travam a adoção' }),
      cartoes(m.falhas, (f) => [
        el('div', { class: 'topo-item' }, el('span', { text: f.id }), el('span', { class: 'chip', 'data-nivel': f.impacto, text: `impacto ${f.impacto ?? '?'}` })),
        el('p', { text: f.descricao }),
        campo('Segmentos', (f.segmentos ?? []).map((s) => seg.get(s) ?? s).join(', ')), campo('Sugestão', f.sugestao), campo('Backlog', f.backlog)])),
    (m.concorrencia ?? []).length ? el('section', { class: 'bloco-mercado' }, el('h2', { text: 'Concorrência e alternativas' }),
      cartoes(m.concorrencia, (c) => [el('h3', { text: c.nome }), el('span', { class: 'chip', text: c.tipo }), campo('Força', c.forca), campo('Fraqueza', c.fraqueza)])) : null,
    (m.calendario ?? []).length ? el('section', { class: 'bloco-mercado cartao' }, el('h2', { text: 'Calendário' }),
      el('ul', { class: 'calendario' }, m.calendario.map((c) => el('li', {}, el('strong', { text: c.periodo }), el('span', { text: `${c.momento}${c.oportunidade ? ' · ' + c.oportunidade : ''}` }))))) : null,
    (m.fontes ?? []).length ? el('section', { class: 'bloco-mercado' }, el('h2', { text: 'Fontes' }),
      el('ol', { class: 'fontes' }, m.fontes.map((f) => { const u = urlSegura(f.url); return el('li', {}, u ? el('a', { href: u, rel: 'noopener', target: '_blank', text: f.titulo || u }) : (f.titulo ?? '')); }))) : null,
  );
}

function desenharBacklog(d) {
  const colunas = [['em_curso', 'Em curso'], ['a_fazer', 'A fazer'], ['feito', 'Feito'], ['ideia', 'Ideias']];
  const itens = [...(d.backlog ?? [])].sort((a, b) => (a.prioridade ?? 9) - (b.prioridade ?? 9));
  document.getElementById('quadro').replaceChildren(...colunas.map(([estado, titulo]) => {
    const daqui = itens.filter((i) => i.estado === estado);
    return el('section', { class: 'coluna-quadro', 'aria-label': titulo },
      el('h2', {}, el('span', { text: titulo }), el('span', { text: String(daqui.length) })),
      daqui.length ? daqui.map((i) => el('article', { class: 'item' },
        el('div', { class: 'topo-item' }, el('span', { text: i.id }), el('span', { text: `P${i.prioridade ?? '?'} · ${i.estimativa ?? '?'}${i.ciclo !== undefined ? ` · ciclo ${i.ciclo}` : ''}` })),
        el('h3', { text: i.titulo }),
        i.porque ? el('p', { text: `${i.quem ? i.quem + ': ' : ''}${i.porque}` }) : null,
        (i.criterios ?? []).length ? el('details', {}, el('summary', { text: `${i.criterios.length} critérios de aceitação` }), el('ul', {}, i.criterios.map((c) => el('li', { text: c })))) : null,
      )) : el('p', { class: 'vazio', text: 'Nada aqui.' }));
  }));
}

function desenharCiclos(d, quem) {
  const ciclos = [...(d.ciclos ?? [])].reverse();
  const lista = document.getElementById('lista-ciclos');
  if (!ciclos.length) { lista.replaceChildren(el('li', { class: 'vazio', text: 'Ainda não correu nenhum ciclo.' })); return; }
  lista.replaceChildren(...ciclos.map((c) => el('li', { 'data-resultado': c.resultado },
    el('article', { class: 'cartao' },
      el('div', { class: 'cabeca', style: 'display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap' },
        el('h3', { style: 'margin:0', text: `Ciclo ${c.n}${c.tipo ? ' · ' + c.tipo : ''}` }),
        el('span', { class: 'chip', text: rotuloResultado(c.resultado) })),
      el('p', { class: 'intro', style: 'margin:.3rem 0 .5rem', text: `${quando(c.inicio)}${c.fim ? ' → ' + quando(c.fim) : ''}` }),
      el('p', {}, el('strong', { text: 'Objetivo: ' }), c.objetivo),
      c.entregue ? el('p', {}, el('strong', { text: 'Entregue: ' }), c.entregue) : null,
      c.retro ? el('p', {}, el('strong', { text: 'Retro: ' }), c.retro) : null,
      (c.agentes ?? []).length ? el('p', { class: 'intro', style: 'margin:0', text: `Agentes: ${c.agentes.map((a) => quem(a).nome).join(', ')}${c.chamadas_agentes ? ` (${c.chamadas_agentes} chamadas)` : ''}` }) : null,
      c.commit ? el('p', { class: 'intro', style: 'margin:0' }, 'Commit ', el('code', { text: String(c.commit).slice(0, 7) })) : null,
      c.notas ? el('p', { class: 'intro', style: 'margin:.4rem 0 0', text: c.notas }) : null,
    ))));
}

function desenharEquipa(d) {
  document.getElementById('lista-equipa').replaceChildren(...(d.equipa ?? []).map((m) => el('article', { class: 'cartao membro' },
    avatar(m),
    el('div', {}, el('h3', { style: 'margin:0', text: m.nome }), el('span', { class: 'chip', text: m.papel }), el('p', { text: m.resumo ?? '' })))));
}

function mostrarSecao() {
  const pedida = (location.hash || '#geral').slice(1);
  const existe = document.querySelector(`section[data-sec="${CSS.escape(pedida)}"]`);
  const atual = existe ? pedida : 'geral';
  document.querySelectorAll('main > section').forEach((s) => { s.hidden = s.dataset.sec !== atual; });
  document.querySelectorAll('.separadores a').forEach((a) => {
    if (a.dataset.sec === atual) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

async function iniciar() {
  mostrarSecao();
  window.addEventListener('hashchange', () => { mostrarSecao(); document.getElementById('conteudo').focus({ preventScroll: true }); window.scrollTo({ top: 0 }); });
  try {
    const d = await carregar();
    if (!d.empresa && !d.reunioes) throw new Error('Sem dados');
    const quem = membroPorId(d.equipa);
    desenharGeral(d, quem);
    desenharReunioes(d, quem);
    desenharMercado(d);
    desenharDecisoes(d, quem);
    desenharBacklog(d);
    desenharCiclos(d, quem);
    desenharEquipa(d);
    const b = d.build;
    document.getElementById('rodape-build').textContent = b
      ? `Publicado ${quando(b.gerado_em)} · commit ${String(b.commit).slice(0, 7)} · fundada a ${fmtDia.format(new Date(d.empresa?.fundada_em ?? Date.now()))}`
      : 'Versão local';
  } catch (e) {
    document.getElementById('produto').replaceChildren(el('p', { class: 'erro', text: 'Não foi possível carregar os dados da sede. Tente recarregar a página.' }));
    document.getElementById('estado-empresa').textContent = 'Sem dados';
  } finally {
    document.body.dataset.pronto = 'sim';
  }
}

iniciar();
