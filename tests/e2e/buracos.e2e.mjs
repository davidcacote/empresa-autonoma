// "Buracos por preencher" na gestão (B-048), com o relógio fixo e a API simulada.
// Uso: node scripts/build.mjs && node tests/e2e/buracos.e2e.mjs
import { readFileSync } from 'node:fs';
import { chromium, iniciarServidor, simularApi, vigiarErros } from '../../scripts/servidor-teste.mjs';

const { base, fechar } = await iniciarServidor();
const browser = await chromium.launch();
const falhas = [];
let feitos = 0;
const AGORA = '2030-06-21T10:00:00.000Z'; // as fixtures têm turnos a 22 e 23 de junho de 2030
const afirmar = (c, m) => { if (!c) throw new Error(m); };
const turnosFixture = JSON.parse(readFileSync(new URL('../fixtures/turnos.json', import.meta.url), 'utf8'));

async function cenario(nome, corpo, extra) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const erros = vigiarErros(page);
  await simularApi(page, extra);
  await page.clock.setFixedTime(new Date(AGORA));
  try {
    await page.goto(`${base}/barraca/gerir.html?f=demonstracao#chave-de-teste-123456`);
    await page.waitForSelector('[data-pronto="sim"]');
    await corpo(page);
    if (erros().length) throw new Error(`erros na consola: ${erros().join(' | ')}`);
    feitos++;
    console.log(`  ok   ${nome}`);
  } catch (e) {
    falhas.push(`${nome}: ${e.message.split('\n')[0]}`);
    console.log(`  FALHOU ${nome}`);
  } finally { await page.close(); }
}

console.log('E2E Buracos por preencher');

await cenario('(a) turnos urgentes (≤48 h) e não urgentes aparecem, do mais próximo para o mais distante', async (page) => {
  afirmar((await page.locator('#buracos-titulo').innerText()) === 'Buracos por preencher', 'título da secção');
  const limite = new Date(AGORA).getTime() + 48 * 3600 * 1000;
  const comVagas = turnosFixture.filter((t) => t.ocupadas < t.vagas).sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
  const urgentes = comVagas.filter((t) => new Date(t.inicio).getTime() <= limite);
  afirmar(urgentes.length > 0 && urgentes.length < comVagas.length, 'a fixture devia ter urgentes e não urgentes');
  const itens = page.locator('.buraco');
  afirmar(await itens.count() === comVagas.length, `itens: ${await itens.count()} em vez de ${comVagas.length}`);
  afirmar(await page.locator('.buraco--urgente').count() === urgentes.length, 'número de urgentes');
  const resumo = await page.locator('.buracos__resumo').innerText();
  afirmar(resumo.startsWith(`${comVagas.length} turnos com vagas, do mais próximo para o mais distante.`), `resumo: "${resumo}"`);
  afirmar(resumo.includes(`${urgentes.length} começam nas próximas 48 horas.`), `resumo: "${resumo}"`);
  // Primeiro (turno mais próximo, 07h/08h de dia 22) é urgente; o último (dia 23 à noite) não.
  const primeiro = itens.first();
  const ultimo = itens.last();
  afirmar((await primeiro.getAttribute('class')).includes('buraco--urgente'), 'o primeiro devia ser urgente');
  afirmar((await primeiro.innerText()).includes('Urgente · próximas 48 h'), 'falta a etiqueta "Urgente" por escrito');
  afirmar((await primeiro.getAttribute('aria-label')).startsWith('Urgente, nas próximas 48 horas.'), 'aria-label do urgente');
  afirmar(!(await ultimo.getAttribute('class')).includes('buraco--urgente'), 'o último não devia ser urgente');
  afirmar(!(await ultimo.innerText()).includes('Urgente'), 'o não urgente não devia dizer "Urgente"');
  afirmar(!(await ultimo.getAttribute('aria-label')).startsWith('Urgente'), 'aria-label do não urgente');
  afirmar(/\d+ de \d+/.test(await ultimo.innerText()), 'falta a lotação "x de y"');
  // Turnos cheios (100) não aparecem
  afirmar(await page.locator('.buracos__lista li').count() === comVagas.length, 'a lista inclui turnos cheios');
  // Clicar leva ao turno
  await primeiro.click();
  afirmar(await page.locator('.turno:focus').count() === 1, 'o turno não ficou focado');
});

await cenario('(b) sem buracos mostra "Não há turnos com vagas"', async (page) => {
  const resumo = await page.locator('.buracos__resumo').innerText();
  afirmar(resumo.includes('Não há turnos com vagas'), `resumo: "${resumo}"`);
  afirmar(await page.locator('.buraco').count() === 0, 'há buracos apesar de tudo cheio');
}, (url) => (url.pathname.endsWith('/rest/v1/turnos')
  ? { body: JSON.stringify(turnosFixture.map((t) => ({ ...t, ocupadas: t.vagas }))) }
  : null));

await browser.close();
fechar();
if (falhas.length) { console.error('✗ E2E falhou:\n- ' + falhas.join('\n- ')); process.exit(1); }
console.log(`✓ E2E OK (${feitos} cenários)`);
