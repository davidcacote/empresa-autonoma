// Criar festa a partir de um modelo de postos (API simulada, sem rede).
import { chromium, iniciarServidor, simularApi, vigiarErros } from '../../scripts/servidor-teste.mjs';

const { base, fechar } = await iniciarServidor();
const browser = await chromium.launch();
const falhas = [];
const afirmar = (c, m) => { if (!c) falhas.push(m); };

const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const erros = vigiarErros(page);
const pedidos = await simularApi(page);
await page.goto(`${base}/barraca/criar.html`);
await page.waitForSelector('[data-pronto="sim"]');

const seletor = page.getByLabel('Começar de um modelo');
afirmar(await seletor.count() === 1, 'seletor com rótulo "Começar de um modelo" em falta');
afirmar((await seletor.locator('option').allInnerTexts()).join('|') === 'Sem modelo|Festa de aldeia|Recolha de alimentos', 'opções do seletor inesperadas');

await page.fill('[data-campo="nome"]', 'Festa de teste');
await page.fill('[data-campo="localidade"]', 'Aldeia');
await page.fill('[data-campo="data_inicio"]', '2031-06-22');
await page.fill('[data-campo="data_fim"]', '2031-06-22');

// Só com teclado: focar o seletor, escolher e ativar o botão
await seletor.focus();
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Tab');
afirmar(await page.evaluate(() => document.activeElement.id) === 'usar-modelo', 'Tab não chega ao botão "Usar modelo"');
afirmar(pedidos.filter((p) => p.metodo === 'POST').length === 0, 'escolher o modelo não pode gravar');
await page.keyboard.press('Enter');

const nomes = await page.locator('[data-parte="nome"]').evaluateAll((els) => els.map((e) => e.value));
afirmar(nomes.join('|') === 'Bar|Comes e bebes|Bilheteira|Montagem', `postos inesperados: ${nomes}`);
afirmar(pedidos.filter((p) => p.metodo === 'POST').length === 0, 'aplicar o modelo não pode gravar');

// Editável: muda um nome e remove um posto
await page.locator('[data-parte="nome"]').nth(0).fill('Bar principal');
await page.locator('[data-remover-posto]').nth(3).click();

await page.click('#criar');
await page.locator('#sucesso').waitFor({ state: 'visible' });
const envio = pedidos.filter((p) => p.metodo === 'POST' && p.url.endsWith('/rpc/criar_festa'));
afirmar(envio.length === 1, `esperava 1 criar_festa, houve ${envio.length}`);
if (envio.length) {
  const postos = JSON.parse(envio[0].corpo).p_festa.postos;
  afirmar(postos.map((p) => p.nome).join('|') === 'Bar principal|Comes e bebes|Bilheteira', `payload inesperado: ${postos.map((p) => p.nome)}`);
}
afirmar(erros().length === 0, `erros na consola: ${erros().join(' | ')}`);

await browser.close();
fechar();
if (falhas.length) { console.error('✗ E2E modelos falhou:\n- ' + falhas.join('\n- ')); process.exit(1); }
console.log('✓ E2E modelos OK');
