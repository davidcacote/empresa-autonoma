// Montra do estúdio na raiz e redirecionamentos dos URLs antigos (B-018).
import { chromium, iniciarServidor, simularApi, vigiarErros } from '../../scripts/servidor-teste.mjs';

const { base, fechar } = await iniciarServidor();
const browser = await chromium.launch();
const falhas = [];
const afirmar = (c, m) => { if (!c) falhas.push(m); };

for (const [antigo, novo] of [
  ['/festa.html?f=demonstracao', '/barraca/festa.html?f=demonstracao'],
  ['/criar.html', '/barraca/criar.html'],
  ['/gerir.html?f=demonstracao#chave-de-teste-123456', '/barraca/gerir.html?f=demonstracao#chave-de-teste-123456'],
]) {
  const page = await browser.newPage();
  await simularApi(page);
  await page.goto(base + antigo);
  await page.waitForURL(base + novo, { timeout: 5000 }).catch(() => {});
  afirmar(page.url() === base + novo, `redirecionamento ${antigo} -> ${page.url()} (esperado ${novo})`);
  await page.close();
}

{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const erros = vigiarErros(page);
  await simularApi(page);
  await page.goto(base + '/');
  await page.waitForSelector('[data-pronto="sim"]');
  const hrefs = await page.$$eval('a', (as) => as.map((a) => a.getAttribute('href')));
  afirmar(hrefs.includes('barraca/'), 'montra sem link para barraca/');
  afirmar(hrefs.includes('hq/'), 'montra sem link para hq/');
  afirmar(await page.locator('#produtos li').first().innerText().then((t) => /Barraca/.test(t)), 'montra sem o produto Barraca');
  afirmar(erros().length === 0, `erros na consola: ${erros().join(' | ')}`);
  await page.close();
}

{
  // B-036: cartão da Placa Certa na montra, gerado da lista de produtos.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await simularApi(page);
  await page.goto(base + '/');
  await page.waitForSelector('[data-pronto="sim"]');
  const cartao = page.locator('#produtos li').filter({ has: page.locator('h3', { hasText: /^Placa Certa$/ }) });
  afirmar(await cartao.count() === 1, 'montra sem um (único) cartão da Placa Certa');
  if (await cartao.count() === 1) {
    afirmar(/MVP/.test(await cartao.innerText()), 'cartão da Placa Certa sem o estado MVP');
    const link = cartao.locator('a');
    afirmar(await link.getAttribute('href') === 'placa-certa/', 'link da Placa Certa não aponta para placa-certa/');
    afirmar(/Placa Certa/.test(await link.innerText()), 'texto do link da Placa Certa não é descritivo');
    const caixa = await link.boundingBox();
    afirmar(caixa && caixa.height >= 44 && caixa.width >= 44, `alvo de toque da Placa Certa pequeno: ${JSON.stringify(caixa)}`);
    await link.focus();
    afirmar(await link.evaluate((a) => a === document.activeElement), 'link da Placa Certa não é focável por teclado');
    const r = await page.request.get(await link.evaluate((a) => a.href));
    afirmar(r.status() === 200, `/placa-certa/ responde ${r.status()}`);
    await link.press('Enter');
    await page.waitForURL(base + '/placa-certa/', { timeout: 5000 }).catch(() => {});
    afirmar(page.url() === base + '/placa-certa/', `Enter no link levou a ${page.url()}`);
  }
  await page.close();
}

{
  // Links do rodapé da Barraca para fora da app (ex.: ../hq/) têm de resolver.
  const page = await browser.newPage();
  await simularApi(page);
  await page.goto(base + '/barraca/');
  const href = await page.locator('footer a[href*="hq/"]').first().evaluate((a) => a.href);
  afirmar(href === base + '/hq/', `link do rodapé da Barraca aponta para ${href}`);
  const r = await page.request.get(href);
  afirmar(r.status() === 200, `link do rodapé da Barraca responde ${r.status()}`);
  await page.close();
}

await browser.close();
fechar();
if (falhas.length) { console.error('✗ E2E montra falhou:\n- ' + falhas.join('\n- ')); process.exit(1); }
console.log('✓ E2E montra OK (3 redirecionamentos + montra)');
