// Modelos da Placa Certa: lógica pura (sem DOM), testável com node --test.
// Cada modelo tem campos e valores por defeito; `montarFolha` devolve uma lista de blocos de texto
// que a app desenha com textContent (nunca innerHTML).

export const PALAVRAS = ['ABERTO', 'FECHADO', 'VOLTO JÁ'];

export const MODELOS = [
  {
    id: 'aberto-fechado', nome: 'Aberto / Fechado',
    campos: [
      { id: 'palavra', rotulo: 'Palavra grande', tipo: 'escolha', opcoes: PALAVRAS, defeito: 'ABERTO' },
      { id: 'mensagem', rotulo: 'Mensagem (opcional)', tipo: 'linha', max: 80, defeito: 'Entre, esteja à vontade.' },
      { id: 'hora', rotulo: 'Hora de regresso (opcional)', tipo: 'hora', defeito: '' },
    ],
  },
  {
    id: 'horario', nome: 'Horário',
    campos: [
      { id: 'titulo', rotulo: 'Título', tipo: 'linha', max: 40, defeito: 'Horário' },
      { id: 'linhas', rotulo: 'Dias e horas (uma linha por entrada)', tipo: 'area', max: 400, maxLinhas: 8,
        defeito: 'Segunda a sexta: 9h00 às 19h00\nSábado: 9h00 às 13h00\nDomingo: Fechado' },
      { id: 'nota', rotulo: 'Nota', tipo: 'linha', max: 80, defeito: 'Encerramos em feriados.' },
    ],
  },
  {
    id: 'precos', nome: 'Preços / Lista',
    campos: [
      { id: 'titulo', rotulo: 'Título', tipo: 'linha', max: 40, defeito: 'Preços' },
      { id: 'itens', rotulo: 'Itens (um por linha: nome - preço)', tipo: 'area', max: 600, maxLinhas: 12,
        defeito: 'Café - 0,80 €\nPão com queijo - 1,50 €\nSumo natural - 2,50 €' },
      { id: 'nota', rotulo: 'Nota', tipo: 'linha', max: 80, defeito: 'Preços com IVA incluído.' },
    ],
  },
  {
    id: 'aviso', nome: 'Aviso',
    campos: [
      { id: 'titulo', rotulo: 'Título', tipo: 'linha', max: 40, defeito: 'Aviso' },
      { id: 'mensagem', rotulo: 'Mensagem', tipo: 'area', max: 300, maxLinhas: 6,
        defeito: 'Por favor, deixe aqui o seu recado. Obrigado pela compreensão.' },
    ],
  },
];

// Variantes: entradas do seletor que reutilizam um modelo existente com valores pré-preenchidos (não são modelos novos).
export const VARIANTES = [
  {
    id: 'horario-natal', nome: 'Horário de Natal / fecho', modelo: 'horario',
    valores: {
      titulo: 'Horário de Natal',
      linhas: '24 de dezembro: 9h00 às 13h00\n25 de dezembro: Fechado\n31 de dezembro: 9h00 às 14h00\n1 de janeiro: Fechado',
      nota: 'Boas Festas! Reabrimos a 2 de janeiro.',
    },
  },
];

export const varianteModeloPorId = (id) => VARIANTES.find((v) => v.id === id) ?? null;

/** Id do modelo que define os campos: o próprio, ou o modelo-base de uma variante. */
export const modeloBase = (id) => varianteModeloPorId(id)?.modelo ?? id;

export const modeloPorId = (id) => MODELOS.find((m) => m.id === id) ?? null;

/** Valores por defeito do modelo ou variante (objeto novo de cada vez). */
export function valoresPorDefeito(id) {
  const m = modeloPorId(modeloBase(id));
  if (!m) return {};
  return { ...Object.fromEntries(m.campos.map((c) => [c.id, c.defeito])), ...varianteModeloPorId(id)?.valores };
}

/** Corta o texto ao limite de caracteres do campo. */
export const limitar = (valor, max) => {
  const t = String(valor ?? '');
  return max ? [...t].slice(0, max).join('') : t;
};

/** Linhas não vazias (já aparadas). */
export const dividirLinhas = (texto, maxLinhas = Infinity) =>
  String(texto ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, maxLinhas);

/** "nome - preço" -> {nome, preco}; sem " - " devolve {nome: linha inteira, preco: ''}. Divide no último " - ". */
export function dividirItem(linha) {
  const l = String(linha ?? '').trim();
  const i = l.lastIndexOf(' - ');
  if (i <= 0 || !l.slice(i + 3).trim()) return { nome: l, preco: '', inteira: true };
  return { nome: l.slice(0, i).trim(), preco: l.slice(i + 3).trim(), inteira: false };
}

export const horaValida = (h) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(h ?? ''));

/** Blocos da folha: {tipo: 'grande'|'titulo'|'texto'|'linha'|'item'|'nota', texto | nome, preco}. */
export function montarFolha(idEntrada, valores = {}) {
  const id = modeloBase(idEntrada);
  const m = modeloPorId(id);
  if (!m) return [];
  const v = Object.fromEntries(m.campos.map((c) => [c.id, c.tipo === 'escolha' ? valores[c.id] : limitar(valores[c.id], c.max)]));
  const blocos = [];
  const texto = (tipo, t) => { const s = String(t ?? '').trim(); if (s) blocos.push({ tipo, texto: s }); };
  if (id === 'aberto-fechado') {
    const palavra = PALAVRAS.includes(v.palavra) ? v.palavra : PALAVRAS[0];
    texto('grande', palavra);
    if (palavra === 'VOLTO JÁ' && horaValida(v.hora)) texto('titulo', `Volto às ${v.hora}`);
    texto('texto', v.mensagem);
  } else if (id === 'horario') {
    texto('titulo', v.titulo);
    dividirLinhas(v.linhas, 8).forEach((l) => blocos.push({ tipo: 'linha', texto: l }));
    texto('nota', v.nota);
  } else if (id === 'precos') {
    texto('titulo', v.titulo);
    dividirLinhas(v.itens, 12).forEach((l) => { const { nome, preco } = dividirItem(l); blocos.push({ tipo: 'item', nome, preco }); });
    texto('nota', v.nota);
  } else if (id === 'aviso') {
    texto('titulo', v.titulo);
    dividirLinhas(v.mensagem, 6).forEach((l) => blocos.push({ tipo: 'texto', texto: l }));
  }
  return blocos;
}
