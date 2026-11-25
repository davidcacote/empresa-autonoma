// Placa Certa: trocar de modelo, editar, pré-visualização, escape de HTML, sem scroll horizontal.
import { chromium, iniciarServidor, vigiarErros } from '../../scripts/servidor-teste.mjs';

const { base, fechar } = await iniciarServidor();
const browser = await chromium.launch();
const falhas = [];
const afirmar = (c, m) => { if (!c) falhas.push(m); };

const page = await browser.newPage({ viewport: { width: 360, height: 740 } });
const erros = vigiarErros(page);
await page.addInitScript(() => { window.print = () => { window.__impressoes = (window.__impressoes ?? 0) + 1; }; });
await page.goto(base + '/placa-certa/');
await page.waitForSelector('[data-pronto="sim"]');
const folha = page.locator('#folha');

afirmar((await folha.innerText()).includes('ABERTO'), 'modelo inicial sem ABERTO');
afirmar((await folha.innerText()).includes('Entre, esteja à vontade.'), 'mensagem por defeito em falta');
afirmar(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'scroll horizontal a 360px');
afirmar(await page.locator('table').count() === 0, 'há <table> no HTML');

await page.selectOption('#campo-palavra', 'VOLTO JÁ');
await page.fill('#campo-hora', '14:30');
afirmar((await folha.innerText()).includes('Volto às 14:30'), 'VOLTO JÁ sem "Volto às 14:30"');

await page.selectOption('#modelo', 'horario');
afirmar((await folha.innerText()).includes('Domingo: Fechado'), 'horário por defeito em falta');
await page.fill('#campo-titulo', 'Nosso horário');
afirmar((await folha.innerText()).includes('Nosso horário'), 'edição do título não aparece na folha');

await page.selectOption('#modelo', 'horario-natal');
const txtNatal = await folha.innerText();
for (const d of ['Horário de Natal', '24 de dezembro', '25 de dezembro', '31 de dezembro', '1 de janeiro']) afirmar(txtNatal.includes(d), `Natal: falta "${d}"`);
afirmar(await page.locator('#campos .campo').count() === 3, 'Natal: esperados 3 campos');
afirmar(await page.locator('#modelo option').count() === 5, 'seletor: 4 modelos + variante de Natal');
await page.fill('#campo-nota', 'Reabrimos a 3 de janeiro.');
afirmar((await folha.innerText()).includes('Reabrimos a 3 de janeiro.'), 'Natal: nota editável');
afirmar(await page.evaluate(() => { const f = document.getElementById('folha'); return f.scrollHeight <= f.clientHeight + 1; }), 'Natal: texto transborda a folha');

await page.selectOption('#modelo', 'precos');
afirmar(await page.locator('.folha__item').count() === 3, 'preços: esperados 3 itens');
afirmar((await page.locator('.folha__preco').first().innerText()) === '0,80 €', 'preço do café');
await page.fill('#campo-itens', 'Sem preço aqui\nBica - 1 €');
afirmar((await page.locator('.folha__item').first().innerText()).trim() === 'Sem preço aqui', 'linha sem " - " deve imprimir inteira');

await page.selectOption('#modelo', 'aviso');
await page.fill('#campo-mensagem', '<script>window.__xss=1</script><img src=x onerror="window.__xss=1">');
afirmar((await folha.innerText()).includes('<script>'), 'script deve aparecer como texto');
afirmar(await page.locator('#folha script, #folha img').count() === 0, 'HTML foi interpretado na folha');
afirmar(await page.evaluate(() => window.__xss === undefined), 'XSS executou');
afirmar((await page.locator('#campo-titulo').getAttribute('maxlength')) === '40', 'limite do título');

await page.click('#imprimir');
afirmar(await page.evaluate(() => window.__impressoes) === 1, 'Imprimir não chamou window.print()');

await page.emulateMedia({ media: 'print' });
afirmar(await page.locator('.editor').isHidden(), 'em impressão o formulário devia estar escondido');
afirmar(await page.locator('#folha').isVisible(), 'em impressão a folha devia estar visível');

// Memória do último texto (localStorage): volta ao reabrir; sem localStorage a app funciona e imprime.
{
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const pedidosExternos = [];
  const p1 = await ctx.newPage();
  p1.on('request', (r) => { if (!r.url().startsWith(base)) pedidosExternos.push(r.url()); });
  const e1 = vigiarErros(p1);
  await p1.goto(base + '/placa-certa/');
  await p1.waitForSelector('[data-pronto="sim"]');
  await p1.selectOption('#modelo', 'aviso');
  await p1.fill('#campo-mensagem', 'Volto às 15h, obrigado');
  await p1.close();
  const p2 = await ctx.newPage();
  const e2 = vigiarErros(p2);
  await p2.goto(base + '/placa-certa/');
  await p2.waitForSelector('[data-pronto="sim"]');
  afirmar(await p2.inputValue('#modelo') === 'aviso', 'memória: modelo não voltou');
  afirmar(await p2.inputValue('#campo-mensagem') === 'Volto às 15h, obrigado', 'memória: texto não voltou preenchido');
  afirmar((await p2.locator('#folha').innerText()).includes('Volto às 15h, obrigado'), 'memória: folha sem o texto lembrado');
  afirmar(e1().length === 0 && e2().length === 0, `memória: erros na consola: ${[...e1(), ...e2()].join(' | ')}`);
  afirmar(pedidosExternos.length === 0, `memória: pedidos fora da origem: ${pedidosExternos.join(' ')}`);
  await ctx.close();

  const falhasArm = {
    'métodos lançam (quota/modo privado)': () => { const f = () => { throw new DOMException('x', 'QuotaExceededError'); }; Storage.prototype.getItem = f; Storage.prototype.setItem = f; },
    'acesso bloqueado': () => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('x', 'SecurityError'); } }); },
  };
  for (const [nome, simular] of Object.entries(falhasArm)) {
    const c = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const p = await c.newPage();
    const e = vigiarErros(p);
    const alertas = [];
    p.on('dialog', (d) => { alertas.push(d.message()); d.dismiss(); });
    await p.addInitScript(simular);
    await p.addInitScript(() => { window.print = () => { window.__impressoes = (window.__impressoes ?? 0) + 1; }; });
    await p.goto(base + '/placa-certa/');
    await p.waitForSelector('[data-pronto="sim"]');
    await p.selectOption('#modelo', 'aviso');
    await p.fill('#campo-mensagem', 'Sem memória');
    afirmar((await p.locator('#folha').innerText()).includes('Sem memória'), `sem localStorage (${nome}): edição não aparece`);
    await p.click('#imprimir');
    afirmar(await p.evaluate(() => window.__impressoes) === 1, `sem localStorage (${nome}): Imprimir deixou de funcionar`);
    afirmar(e().length === 0, `sem localStorage (${nome}): erros na consola: ${e().join(' | ')}`);
    afirmar(alertas.length === 0, `sem localStorage (${nome}): diálogo visível`);
    await c.close();
  }
}

afirmar(erros().length === 0, `erros na consola: ${erros().join(' | ')}`);
await browser.close();
fechar();
if (falhas.length) { console.error('✗ E2E placa-certa falhou:\n- ' + falhas.join('\n- ')); process.exit(1); }
console.log('✓ E2E placa-certa OK');
