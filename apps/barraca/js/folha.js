// Folha A4 para afixar na sede (B-007): um bloco por dia, só texto, pensada para o @media print.
// O bloco fica escondido no ecrã; o botão só chama window.print() (sem backend).
import { h, $, preencher } from './dom.js';
import { resumoNomes } from './logica.js';

/** Estado por escrito para o papel: "Livre" se ainda há vagas, "Ocupado" se está cheio. */
export function estadoParaPapel({ vagas, ocupadas }) {
  const livres = Math.max(0, vagas - ocupadas);
  return { livres, texto: livres > 0 ? 'Livre' : 'Ocupado' };
}

function linhaTurno({ turno, intervalo, nomes }) {
  const { livres, texto } = estadoParaPapel(turno);
  return h('li', { class: 'imp-turno' },
    h('p', { class: 'imp-turno__hora' }, intervalo),
    h('p', { class: 'imp-turno__estado' }, `${texto} · ${turno.ocupadas} de ${turno.vagas} vagas`
      + (livres > 0 ? ` (${livres === 1 ? 'falta 1 pessoa' : `faltam ${livres} pessoas`})` : '')),
    h('p', { class: 'imp-turno__nomes' }, nomes.length ? `Inscritos: ${resumoNomes(nomes)}` : 'Inscritos: ninguém'));
}

/** Desenha um bloco por dia (todos os dias, não só o escolhido no ecrã). */
export function desenharFolha(festa, dias) {
  const raiz = $('impressao');
  if (!raiz) return;
  const subtitulo = `${festa.localidade} · ${festa.intervalo}`;
  preencher(raiz, dias.map((d) => h('section', { class: 'imp-dia', 'aria-label': d.longo },
    h('header', { class: 'imp-dia__cab' },
      h('p', { class: 'imp-festa' }, festa.nome),
      h('p', { class: 'imp-festa__detalhes' }, subtitulo),
      h('h2', { class: 'imp-dia__titulo' }, d.longo)),
    d.postos.map(({ posto, turnos }) => h('section', { class: 'imp-posto' },
      h('h3', { class: 'imp-posto__titulo' }, posto.nome),
      h('ul', { class: 'imp-turnos' }, turnos.map(linhaTurno)))))));
}

/** Liga o botão "Imprimir folha A4". */
export function ligarImpressao() {
  $('imprimir')?.addEventListener('click', () => window.print());
}
