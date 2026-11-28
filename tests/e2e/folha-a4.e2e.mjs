// Folha A4 da grelha (B-007): botão só chama window.print(); em impressão só se vê a folha, um bloco por dia.
// Uso: node scripts/build.mjs && node tests/e2e/folha-a4.e2e.mjs
import { chromium, iniciarServidor, simularApi, vigiarErros } from '../../scripts/servidor-teste.mjs';

const { base, fechar } = await iniciarServidor();
const browser = await chromium.launch();
const falhas = [];
let feitos = 0;
const afirmar = (c, m) => { if (!c) throw new Error(m); };

async function cenario(nome, url, corpo) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const erros = vigiarErros(page);
  await simularApi(page);
  await page.addInitScript(() => { window.__impressoes = 0; window.print = () => { window.__impressoes++; }; });
  await page.clock.setFixedTime(new Date('2030-06-21T10:00:00.000Z'));
  try {
    await page.goto(`${base}${url}`);
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

async function verificar(page) {
  // Ecrã: botão visível, com alvo >=44 px, e a folha escondida
  const botao = page.locator('#imprimir');
  afirmar(await botao.isVisible(), 'botão "Imprimir folha A4" não está visível');
  afirmar((await botao.innerText()).trim() === 'Imprimir folha A4', 'texto do botão');
  const caixa = await botao.boundingBox();
  afirmar(caixa.height >= 44 && caixa.width >= 44, `alvo pequeno: ${caixa.width}x${caixa.height}`);
  afirmar(await page.locator('#impressao').isHidden(), 'a folha devia estar escondida no ecrã');
  await botao.click();
  afirmar(await page.evaluate(() => window.__impressoes) === 1, 'o botão não chamou window.print() uma vez');

  await page.emulateMedia({ media: 'print' });
  // Elementos de ecrã escondidos
  for (const sel of ['header.cabecalho', 'main', 'footer', '#imprimir', '#dias', '.bandeirinhas', 'button']) {
    for (const el of await page.locator(sel).all()) afirmar(await el.isHidden(), `em impressão "${sel}" devia estar escondido`);
  }
  afirmar(await page.locator('#impressao').isVisible(), 'a folha devia ver-se em impressão');
  // Um bloco por dia (a fixture tem dois dias) e nenhum botão/formulário dentro
  const blocos = page.locator('.imp-dia');
  afirmar(await blocos.count() === 2, `blocos por dia: ${await blocos.count()} em vez de 2`);
  afirmar(await page.locator('#impressao button, #impressao input, #impressao form, #impressao a').count() === 0, 'a folha não devia ter controlos');
  for (let i = 0; i < 2; i++) {
    const b = blocos.nth(i);
    const texto = await b.innerText();
    afirmar((await b.locator('.imp-festa').innerText()).trim().length > 0, 'falta o nome da festa');
    afirmar((await b.locator('.imp-dia__titulo').innerText()).length > 3, 'falta o título do dia');
    afirmar(/Livre|Ocupado/.test(texto), 'estado em texto (Livre/Ocupado) em falta');
    afirmar(/Inscritos: /.test(texto), 'falta a linha de inscritos');
    afirmar(/\d+ de \d+ vagas/.test(texto), 'faltam as vagas');
    afirmar(await b.evaluate((el) => getComputedStyle(el).breakAfter) === (i === 1 ? 'auto' : 'page'), `quebra de página do bloco ${i}`);
  }
  const nomeFesta = await page.evaluate(() => document.querySelector('.imp-festa').textContent);
  afirmar(nomeFesta.trim().length > 0, 'nome da festa vazio');
  const turnos = await page.locator('.imp-turno').evaluateAll((els) => els.map((e) => getComputedStyle(e).breakInside));
  afirmar(turnos.length > 0 && turnos.every((v) => v === 'avoid'), 'turnos sem break-inside: avoid');
  const estados = await page.locator('.imp-turno__estado').allInnerTexts();
  afirmar(estados.every((t) => /^(Livre|Ocupado) · /.test(t)), `estados: ${estados.join(' | ')}`);
  afirmar(estados.some((t) => t.startsWith('Ocupado')) && estados.some((t) => t.startsWith('Livre')), 'a fixture devia ter Livre e Ocupado');
  // Legível a preto e branco: texto preto sobre branco, letra >= 14pt (18,6px) nos turnos
  const est = await page.evaluate(() => {
    const t = document.querySelector('.imp-turno__nomes');
    const c = getComputedStyle(t);
    return { cor: c.color, fundo: getComputedStyle(document.body).backgroundColor, px: parseFloat(c.fontSize), pt: document.querySelector('.imp-turno__hora') && parseFloat(getComputedStyle(document.querySelector('.imp-turno__hora')).fontSize) };
  });
  afirmar(est.cor === 'rgb(0, 0, 0)', `texto não é preto: ${est.cor}`);
  afirmar(est.fundo === 'rgb(255, 255, 255)', `fundo não é branco: ${est.fundo}`);
  afirmar(est.px >= 18, `letra pequena: ${est.px}px`);
  // O PDF (A4) produz uma página por dia, no mínimo
  const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true });
  const paginas = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  afirmar(paginas >= 2, `PDF com ${paginas} página(s)`);
  await page.emulateMedia({ media: 'screen' });
  afirmar(await page.locator('#impressao').isHidden(), 'a folha devia voltar a esconder-se no ecrã');
}

console.log('E2E Folha A4');
await cenario('(a) gerir.html: botão, folha e CSS de impressão', '/barraca/gerir.html?f=demonstracao#chave-de-teste-123456', verificar);
await cenario('(b) festa.html: botão, folha e CSS de impressão', '/barraca/festa.html?f=demonstracao', verificar);
await cenario('(c) gerir.html: nomes dos inscritos na folha', '/barraca/gerir.html?f=demonstracao#chave-de-teste-123456', async (page) => {
  await page.emulateMedia({ media: 'print' });
  const doDom = await page.evaluate(() => [...document.querySelectorAll('.imp-turno__nomes')].map((e) => e.textContent));
  afirmar(doDom.some((t) => t !== 'Inscritos: ninguém'), 'nenhum nome de inscrito na folha');
});

await browser.close();
fechar();
if (falhas.length) { console.error('✗ E2E falhou:\n- ' + falhas.join('\n- ')); process.exit(1); }
console.log(`✓ E2E OK (${feitos} cenários)`);
