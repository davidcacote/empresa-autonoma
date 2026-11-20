// Turno Certo: primeira abertura -> festa de exemplo -> turno cheio, falta + substituto validado, e offline.
import { chromium, iniciarServidor, vigiarErros } from '../../scripts/servidor-teste.mjs';

const { base, fechar } = await iniciarServidor();
const browser = await chromium.launch();
const falhas = [];
const afirmar = (c, m) => { if (!c) falhas.push(m); };

const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
const page = await ctx.newPage();
const erros = vigiarErros(page);
await page.goto(base + '/turno-certo/');
await page.waitForSelector('[data-pronto="sim"]');

// primeira abertura: botão visível, com alvo de toque >= 44px
const caixa = await page.locator('#exemplo').boundingBox();
afirmar(await page.locator('#exemplo').isVisible(), 'sem dados guardados o botão de exemplo devia estar visível');
afirmar(caixa && caixa.height >= 44 && caixa.width >= 44, `alvo de toque do botão de exemplo pequeno: ${JSON.stringify(caixa)}`);
await page.click('#exemplo');
afirmar((await page.locator('#estado').innerText()).includes('exemplo carregada'), 'mensagem de exemplo carregada');

// turno cheio: o primeiro posto tem 3 vagas e 3 inscrições
const p0 = page.locator('.posto').first();
const campo = p0.locator('input[id^="ficha-"]');
await campo.fill('99'); await campo.press('Enter');
afirmar((await page.locator('#estado').innerText()).includes('Turno cheio'), 'o exemplo devia ter um turno cheio que recusa nova ficha');
afirmar(!(await p0.innerText()).includes('Ficha 99'), 'ficha 99 não devia ter entrado no turno cheio');

// falta + substituto: validar o substituto da ficha 27 fecha uma pendência
afirmar(await page.locator('#pendencias li:not(.vazio)').count() === 2, 'exemplo com 2 pendências');
await page.click('button[aria-label="Validar o substituto 44 da ficha 27"]');
afirmar(await page.locator('#pendencias li:not(.vazio)').count() === 1, 'validar o substituto devia fechar uma pendência');
afirmar((await page.locator('.posto').first().innerText()).includes('3/3 ocupadas'), 'posto 1 devia ficar 3/3 com o substituto validado');

// offline: recarregar sem rede mantém a folha
await page.evaluate(async () => { await navigator.serviceWorker.ready; });
await ctx.setOffline(true);
await page.reload();
await page.waitForSelector('[data-pronto="sim"]', { timeout: 8000 }).catch(() => falhas.push('offline: página não abriu a partir da cache'));
afirmar((await page.locator('#t-folha').innerText()).includes('Exemplo'), 'offline: festa de exemplo não carregou');
afirmar(await page.locator('#pendencias li:not(.vazio)').count() === 1, 'offline: estado não persistiu');
await ctx.setOffline(false);
afirmar(erros().length === 0, `erros na consola: ${erros().join(' | ')}`);

await browser.close();
fechar();
if (falhas.length) { console.error('✗ E2E turno-certo-exemplo falhou:\n- ' + falhas.join('\n- ')); process.exit(1); }
console.log('✓ E2E turno-certo-exemplo OK');
