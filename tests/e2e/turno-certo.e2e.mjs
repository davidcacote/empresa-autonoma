// Turno Certo: criar folha, inscrever, turno cheio, falta + substituto, persistência, memória, offline, impressão.
import { chromium, iniciarServidor, vigiarErros } from '../../scripts/servidor-teste.mjs';

const { base, fechar } = await iniciarServidor();
const browser = await chromium.launch();
const falhas = [];
const afirmar = (c, m) => { if (!c) falhas.push(m); };
const URL = base + '/turno-certo/';

const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
const page = await ctx.newPage();
const erros = vigiarErros(page);
const externos = [];
page.on('request', (r) => { if (!r.url().startsWith(base) && !r.url().startsWith('data:')) externos.push(r.url()); });
await page.addInitScript(() => { window.print = () => { window.__impressoes = (window.__impressoes ?? 0) + 1; }; });
await page.goto(URL);
await page.waitForSelector('[data-pronto="sim"]');

afirmar((await page.title()).trim().length > 0, 'título vazio');
afirmar(await page.locator('#aviso-memoria').isHidden(), 'aviso de memória visível com localStorage disponível');
afirmar(await page.locator('#sec-criar').isVisible(), 'sem folhas devia mostrar o formulário de criação');

// 1. Criar folha (por teclado: preencher e submeter com Enter)
await page.fill('#c-nome', 'Festa de Teste');
await page.fill('#c-data', '2027-08-14');
await page.fill('#c-horario', '18:00 às 20:00'); await page.fill('#c-vagas', '2');
await page.click('#c-add');
await page.fill('#c-horario', '20:00 às 22:00'); await page.fill('#c-vagas', '31');
await page.click('#c-add');
afirmar((await page.locator('#c-erro').innerText()).includes('entre 1 e 30'), '31 vagas devia ser recusado');
await page.fill('#c-vagas', '1');
await page.press('#c-vagas', 'Enter');
afirmar(await page.locator('#sec-folha').isVisible(), 'folha não foi criada');
afirmar((await page.locator('#t-folha').innerText()) === 'Festa de Teste', 'nome da festa');
afirmar(await page.locator('.posto').count() === 2, 'esperados 2 postos (o pendente no formulário também entra)');
afirmar((await page.locator('.posto').first().innerText()).includes('0/2 ocupadas'), 'contador inicial');

// 2. Inscrever
const p1 = page.locator('.posto').first();
const ficha = p1.locator('input[id^="ficha-"]').first();
await ficha.fill('12'); await ficha.press('Enter');
afirmar((await p1.innerText()).includes('1/2 ocupadas'), 'contador depois de 1 inscrição');
afirmar((await page.locator('#estado').innerText()).includes('Ficha 12 inscrita'), 'mensagem de estado');
afirmar(await page.evaluate(() => document.activeElement.id.startsWith('ficha-')), 'foco devia voltar ao campo da ficha');
await ficha.fill('12'); await ficha.press('Enter');
afirmar((await page.locator('#estado').innerText()).includes('já está neste turno'), 'duplicado devia ser recusado');
await page.locator('.posto').first().locator('input[id^="ficha-"]').fill('Maria'); await page.keyboard.press('Enter');
afirmar((await page.locator('#estado').innerText()).includes('só o número da ficha'), 'nome devia ser recusado');
await page.locator('.posto').first().locator('input[id^="ficha-"]').fill('13'); await page.keyboard.press('Enter');
afirmar((await page.locator('.posto').first().innerText()).includes('2/2 ocupadas'), '2/2');
afirmar((await page.locator('.posto').first().innerText()).includes('COMPLETO'), 'posto completo');
await page.locator('.posto').first().locator('input[id^="ficha-"]').fill('14'); await page.keyboard.press('Enter');
afirmar((await page.locator('#estado').innerText()).includes('Turno cheio'), 'segunda ficha na última vaga devia dar "turno cheio"');
afirmar((await page.locator('.posto').first().innerText()).includes('2/2'), 'contador mudou após recusa');

// 3. Falta e substituto
await page.click('button[aria-label="Marcar a ficha 12 como faltou"]');
afirmar((await page.locator('.posto').first().innerText()).includes('1/2 ocupadas'), 'falta devia libertar a contagem');
afirmar((await page.locator('.posto').first().innerText()).includes('FALTAM 1 vaga'), 'FALTAM em texto');
afirmar((await page.locator('#pendencias').innerText()).includes('ficha 12 faltou'), 'pendência em falta');
await page.fill('input[aria-label="Ficha substituta da ficha 12"]', '13');
await page.click('button[aria-label="Registar a ficha substituta da ficha 12"]');
afirmar((await page.locator('#estado').innerText()).includes('já está neste turno'), 'substituto repetido devia ser recusado');
await page.fill('input[aria-label="Ficha substituta da ficha 12"]', '20');
await page.press('input[aria-label="Ficha substituta da ficha 12"]', 'Enter');
afirmar((await page.locator('#pendencias').innerText()).includes('Substituto 20 por validar'), 'substituto registado continua pendente');
afirmar(await page.locator('#pendencias li:not(.vazio)').count() === 1, 'pendência deve manter-se até validar');
await page.click('button[aria-label="Validar o substituto 20 da ficha 12"]');
afirmar((await page.locator('#pendencias').innerText()).includes('Nenhuma pendência'), 'sem pendências após validar');
afirmar((await page.locator('.posto').first().innerText()).includes('2/2 ocupadas'), 'validado: 2/2');

// persistência
await page.reload(); await page.waitForSelector('[data-pronto="sim"]');
afirmar((await page.locator('#t-folha').innerText()) === 'Festa de Teste', 'folha não persistiu');
afirmar((await page.locator('.posto').first().innerText()).includes('2/2 ocupadas'), 'inscrições não persistiram');

// exemplo
await page.click('#exemplo');
afirmar((await page.locator('#t-folha').innerText()).includes('Exemplo'), 'festa de exemplo');
afirmar(await page.locator('#pendencias li:not(.vazio)').count() === 2, 'exemplo devia ter 2 pendências');

// 6. sem scroll horizontal, rótulos e teclado
afirmar(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'scroll horizontal a 360px');
const semRotulo = await page.evaluate(() => [...document.querySelectorAll('input, select')].filter((e) => !e.labels?.length && !e.getAttribute('aria-label')).map((e) => e.id));
afirmar(semRotulo.length === 0, `campos sem rótulo: ${semRotulo}`);
await page.focus('#nova'); await page.keyboard.press('Tab');
afirmar(await page.evaluate(() => document.activeElement.id === 'exemplo'), 'Tab devia ir para o botão seguinte');

// 5. impressão
await page.click('#imprimir');
afirmar(await page.evaluate(() => window.__impressoes) === 1, 'Imprimir não chamou window.print()');
await page.emulateMedia({ media: 'print' });
afirmar(await page.locator('#sec-escolha').isHidden(), 'em impressão a escolha devia estar escondida');
afirmar(await page.locator('#pendencias').isVisible(), 'em impressão as pendências devem ver-se');
const cor = await page.evaluate(() => getComputedStyle(document.querySelector('.faltam')).color);
afirmar(cor === 'rgb(0, 0, 0)', `texto de impressão não é preto: ${cor}`);
afirmar(await page.evaluate(() => getComputedStyle(document.querySelector('.posto--falta')).borderStyle.includes('double')), 'posto em falta sem borda dupla');
afirmar(await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize) >= 20), 'letra de impressão pequena (<15pt)');
await page.emulateMedia({ media: 'screen' });

// 4. offline: nenhum pedido externo; manifest e service worker
afirmar(externos.length === 0, `pedidos externos: ${externos.join(', ')}`);
afirmar(await page.evaluate(async () => (await fetch('manifest.webmanifest')).ok), 'manifest em falta');
const swPronto = await page.evaluate(async () => { try { await navigator.serviceWorker.ready; return true; } catch { return false; } });
afirmar(swPronto, 'service worker não ficou ativo');
await ctx.setOffline(true);
await page.reload(); await page.waitForSelector('[data-pronto="sim"]', { timeout: 8000 }).catch(() => falhas.push('offline: página não abriu a partir da cache'));
afirmar((await page.locator('#t-folha').innerText()).length > 0, 'offline: folha não carregou');
await ctx.setOffline(false);
afirmar(externos.length === 0, `pedidos externos (após offline): ${externos.join(', ')}`);
afirmar(erros().length === 0, `erros na consola: ${erros().join(' | ')}`);

// 1b. localStorage indisponível -> memória + aviso
const ctx2 = await browser.newContext({ viewport: { width: 360, height: 740 }, serviceWorkers: 'block' });
const p2 = await ctx2.newPage();
const erros2 = vigiarErros(p2);
await p2.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('bloqueado', 'SecurityError'); } }); });
await p2.goto(URL); await p2.waitForSelector('[data-pronto="sim"]');
afirmar(await p2.locator('#aviso-memoria').isVisible(), 'aviso de memória em falta sem localStorage');
await p2.click('#exemplo');
afirmar(await p2.locator('.posto').count() === 3, 'sem localStorage a app devia funcionar em memória');
const f2 = p2.locator('.posto').nth(2).locator('input[id^="ficha-"]');
await f2.fill('99'); await f2.press('Enter');
afirmar((await p2.locator('.posto').nth(2).innerText()).includes('2/2 ocupadas'), 'memória: contador');
afirmar(await p2.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'memória: scroll horizontal');
afirmar(erros2().length === 0, `erros na consola (memória): ${erros2().join(' | ')}`);

await browser.close();
fechar();
if (falhas.length) { console.error('✗ E2E turno-certo falhou:\n- ' + falhas.join('\n- ')); process.exit(1); }
console.log('✓ E2E turno-certo OK');
