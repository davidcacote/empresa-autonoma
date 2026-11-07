// Diálogo de confirmação reutilizável (substitui window.confirm, que não é estilizável nem acessível em todo o lado).
import { h } from './dom.js';

/** Pergunta "tem a certeza?". Devolve uma promessa com true/false. */
export function confirmar({ titulo, texto, rotulo, perigo = false }) {
  return new Promise((resolve) => {
    const dialogo = h('dialog', { class: 'folha', 'aria-labelledby': 'confirmar-titulo' });
    const fechar = (resultado) => { dialogo.close(); dialogo.remove(); resolve(resultado); };
    dialogo.append(
      h('div', { class: 'folha__corpo' },
        h('h2', { id: 'confirmar-titulo', class: 'folha__titulo' }, titulo),
        h('p', { class: 'folha__resumo' }, texto),
        h('div', { class: 'folha__acoes' },
          h('button', { type: 'button', class: 'botao botao--secundario', onclick: () => fechar(false) }, 'Voltar'),
          h('button', { type: 'button', class: `botao ${perigo ? 'botao--perigo' : 'botao--primario'}`, onclick: () => fechar(true) }, rotulo),
        ),
      ),
    );
    dialogo.addEventListener('cancel', (e) => { e.preventDefault(); fechar(false); });
    dialogo.addEventListener('click', (e) => { if (e.target === dialogo) fechar(false); });
    document.body.append(dialogo);
    dialogo.showModal();
  });
}
