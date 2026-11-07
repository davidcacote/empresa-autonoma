// Smoke test: todas as páginas abrem, ficam prontas, sem erros nem scroll horizontal, em mobile e desktop.
// Uso: node scripts/smoke.mjs [--screenshots pasta]
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, iniciarServidor, simularApi, vigiarErros } from './servidor-teste.mjs';

const PAGINAS = [
  { nome: 'inicio', url: '/' },
  { nome: 'festa', url: '/festa.html?f=demonstracao' },
  { nome: 'criar', url: '/criar.html' },
  { nome: 'gerir', url: '/gerir.html?f=demonstracao#chave-de-teste-123456' },
  { nome: 'hq', url: '/hq/' },
];

const pastaShots = process.argv.includes('--screenshots') ? process.argv[process.argv.indexOf('--screenshots') + 1] : null;
if (pastaShots) await mkdir(pastaShots, { recursive: true });

const { base, fechar } = await iniciarServidor();
const browser = await chromium.launch();
const falhas = [];

for (const vista of [{ nome: 'mobile', width: 390, height: 844 }, { nome: 'desktop', width: 1280, height: 860 }]) {
  for (const p of PAGINAS) {
    const page = await browser.newPage({ viewport: { width: vista.width, height: vista.height } });
    const errosRelevantes = vigiarErros(page);
    await simularApi(page);
    const r = await page.goto(base + p.url, { waitUntil: 'domcontentloaded' });
    if (!r || r.status() >= 400) { falhas.push(`${p.nome}: HTTP ${r?.status()}`); await page.close(); continue; }
    try { await page.waitForSelector('[data-pronto="sim"]', { timeout: 15000 }); }
    catch { falhas.push(`${p.nome} (${vista.nome}): a página não ficou pronta ([data-pronto="sim"])`); }
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1))
      falhas.push(`${p.nome} (${vista.nome}): scroll horizontal`);
    const erros = errosRelevantes();
    if (erros.length) falhas.push(`${p.nome} (${vista.nome}): erros na consola: ${erros.join(' | ')}`);
    if (pastaShots) await page.screenshot({ path: join(pastaShots, `${p.nome}-${vista.nome}.png`), fullPage: true });
    await page.close();
  }
}
await browser.close();
fechar();

if (falhas.length) { console.error('✗ Smoke test falhou:\n- ' + falhas.join('\n- ')); process.exit(1); }
console.log(`✓ Smoke test OK (${PAGINAS.length} páginas, mobile e desktop)`);
