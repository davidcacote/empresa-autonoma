// Indicador de atualização sempre visível: "A atualizar…", "● Em direto" ou "Atualizado às 14:32".
import { horaCurta } from './logica.js';
import { preencher, h } from './dom.js';

export function criarIndicador(elemento) {
  const s = { modo: 'sondagem', aCarregar: false, falhou: false, ultima: null };

  function pintar() {
    const hora = s.ultima ? horaCurta(s.ultima) : null;
    if (s.aCarregar && (s.modo !== 'direto' || !hora)) return preencher(elemento, h('span', { 'aria-hidden': 'true' }, '↻ '), 'A atualizar…');
    if (s.falhou) return preencher(elemento, h('span', { 'aria-hidden': 'true' }, '! '), hora ? `Sem ligação · dados das ${hora}` : 'Sem ligação');
    if (s.modo === 'direto') return preencher(elemento, h('span', { class: 'ponto-direto', 'aria-hidden': 'true' }, '●'), ' Em direto');
    return preencher(elemento, `Atualizado às ${hora}`);
  }

  pintar();
  return {
    carregando() { s.aCarregar = true; pintar(); },
    sucesso() { s.aCarregar = false; s.falhou = false; s.ultima = new Date(); pintar(); },
    falha() { s.aCarregar = false; s.falhou = true; pintar(); },
    modo(m) { s.modo = m; pintar(); },
  };
}
