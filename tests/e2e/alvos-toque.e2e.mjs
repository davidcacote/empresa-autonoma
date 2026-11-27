// B-015/B-047: todos os links e controlos visíveis medem ≥44×44 px a 390 px de largura (WCAG 2.5.5/2.5.8).
// Uso: node scripts/build.mjs && node tests/e2e/alvos-toque.e2e.mjs
import { chromium, iniciarServidor, simularApi, vigiarErros } from '../../scripts/servidor-teste.mjs';

const { base, fechar } = await iniciarServidor();
const browser = await chromium.launch();
const falhas = [];
const MIN = 44;

const PAGINAS = [
  // A montra (site/index.html) fica fora: não é uma app e este papel não escreve em site/ (ver relatório).
  ['/barraca/', 'Barraca: início'],
  ['/barraca/criar.html', 'Barraca: criar'],
  ['/barraca/festa.html?f=demonstracao', 'Barraca: festa'],
  ['/barraca/festa.html?f=nao-existe', 'Barraca: festa inexistente', (url) => (url.pathname.endsWith('/rest/v1/festas') ? { body: '[]' } : null)],
  ['/barraca/gerir.html?f=demonstracao#chave-de-teste-123456', 'Barraca: gerir'],
  ['/placa-certa/', 'Placa Certa'],
  ['/turno-certo/', 'Turno Certo'],
];

/** Medidas (no browser) de cada elemento interativo visível; caixas de seleção medem-se pela etiqueta. */
function medir(min) {
  const sel = 'a[href], button, summary, select, textarea, input:not([type="hidden"])';
  const saida = [];
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest('[hidden], [inert]') || el.disabled) continue;
    const estilo = getComputedStyle(el);
    if (estilo.display === 'none' || estilo.visibility === 'hidden') continue;
    let alvo = el;
    if (el.matches('input[type="checkbox"], input[type="radio"]')) alvo = el.closest('label') ?? el.labels?.[0] ?? el;
    const r = alvo.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue; // fora do ecrã ou colapsado, mas sem caixa
    if (r.width + 0.5 < min || r.height + 0.5 < min) {
      const nome = (el.getAttribute('aria-label') || el.textContent || el.id || el.name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      saida.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} "${nome}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
  }
  return saida;
}

console.log('E2E Alvos de toque (390 px)');
for (const [caminho, nome, extra] of PAGINAS) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const erros = vigiarErros(page);
  await simularApi(page, extra);
  try {
    await page.goto(base + caminho);
    await page.waitForSelector('[data-pronto="sim"]', { timeout: 4000 }).catch(() => {});
    const pequenos = await page.evaluate(medir, MIN);
    if (pequenos.length) throw new Error(`${pequenos.length} abaixo de ${MIN}px: ${pequenos.join('; ')}`);
    if (erros().length) throw new Error(`erros na consola: ${erros().join(' | ')}`);
    console.log(`  ok   ${nome}`);
  } catch (e) {
    falhas.push(`${nome}: ${e.message}`);
    console.log(`  FALHOU ${nome}`);
  } finally { await page.close(); }
}

// Os elementos pedidos têm de existir e medir ≥44×44 (garante que a verificação acima não passa por vazio).
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await simularApi(page);
for (const [caminho, nome] of [
  ['/barraca/criar.html', 'Saltar para o formulário'], ['/barraca/criar.html', 'Voltar ao início'], ['/barraca/criar.html', 'Barraca'],
  ['/barraca/gerir.html?f=demonstracao#chave-de-teste-123456', 'Saltar para os turnos'],
]) {
  await page.goto(base + caminho);
  const caixa = await page.getByRole('link', { name: nome, exact: true }).first().boundingBox();
  if (!caixa || caixa.width < MIN || caixa.height < MIN) falhas.push(`link "${nome}" em ${caminho}: ${caixa ? `${caixa.width}×${caixa.height}` : 'inexistente'}`);
}
await page.close();

await browser.close();
fechar();
if (falhas.length) { console.error('✗ E2E falhou:\n- ' + falhas.join('\n- ')); process.exit(1); }
console.log('✓ E2E OK');
