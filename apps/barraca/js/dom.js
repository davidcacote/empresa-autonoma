// Ajudantes de DOM. Nunca se usa innerHTML: os dados entram sempre como texto.

/** Cria um elemento. `atributos`: class, dataset, onclick…, ou atributos normais. Filhos: texto, nós ou listas. */
export function h(tag, atributos = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [nome, valor] of Object.entries(atributos ?? {})) {
    if (valor == null || valor === false) continue;
    if (nome === 'class') el.className = valor;
    else if (nome === 'dataset') Object.assign(el.dataset, valor);
    else if (nome.startsWith('on') && typeof valor === 'function') el.addEventListener(nome.slice(2), valor);
    else el.setAttribute(nome, valor === true ? '' : String(valor));
  }
  juntar(el, filhos);
  return el;
}

function juntar(pai, filhos) {
  for (const f of filhos.flat(Infinity)) {
    if (f == null || f === false) continue;
    pai.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
}

/** Substitui o conteúdo de um elemento. */
export function preencher(el, ...filhos) {
  el.replaceChildren();
  juntar(el, filhos);
  return el;
}

export const $ = (id) => document.getElementById(id);

/** Marca a página como pronta (os testes de browser esperam por isto). */
export const marcarPronta = () => { document.body.dataset.pronto = 'sim'; };
