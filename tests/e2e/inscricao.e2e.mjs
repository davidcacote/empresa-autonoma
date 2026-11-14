// Cenários de browser da Barraca (API simulada, sem rede). Termina com código 1 se algo falhar.
// Uso: node scripts/build.mjs && node tests/e2e/inscricao.e2e.mjs
import { chromium, iniciarServidor, simularApi, vigiarErros } from '../../scripts/servidor-teste.mjs';

const { base, fechar } = await iniciarServidor();
const browser = await chromium.launch();
const falhas = [];
let feitos = 0;

/** Corre um cenário numa página nova (telemóvel) e regista a falha em vez de parar tudo. */
async function cenario(nome, corpo, extra) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const erros = vigiarErros(page);
  const pedidos = await simularApi(page, extra);
  try {
    await corpo(page, pedidos);
    if (erros().length) throw new Error(`erros na consola: ${erros().join(' | ')}`);
    feitos++;
    console.log(`  ok   ${nome}`);
  } catch (e) {
    falhas.push(`${nome}: ${e.message.split('\n')[0]}`);
    console.log(`  FALHOU ${nome}`);
  } finally {
    await page.close();
  }
}

function afirmar(condicao, mensagem) { if (!condicao) throw new Error(mensagem); }

async function abrirFesta(page) {
  await page.goto(`${base}/barraca/festa.html?f=demonstracao`);
  await page.waitForSelector('[data-pronto="sim"]');
}

/** Abre a folha de inscrição no primeiro turno livre. */
async function abrirPrimeiroLivre(page) {
  await abrirFesta(page);
  await page.locator('.turno button:not([disabled])').first().click();
  await page.waitForSelector('dialog#dlg[open]');
}

const eInscricao = (url, metodo) => metodo === 'POST' && url.pathname.endsWith('/rpc/inscrever');

console.log('E2E Barraca');

await cenario('(a) inscrever-se no primeiro turno livre mostra a confirmação escrita', async (page, pedidos) => {
  await abrirPrimeiroLivre(page);
  await page.fill('#dlg-nome', 'Ana');
  await page.check('#dlg-maior');
  await page.click('#dlg-confirmar');
  const conf = page.locator('#confirmacao');
  await conf.waitFor({ state: 'visible' });
  const texto = await conf.innerText();
  afirmar(texto.includes('Está inscrito(a), Ana!'), `confirmação inesperada: "${texto}"`);
  afirmar(/Bar · Sábado 22 · 20h–22h/.test(texto), `falta o resumo do turno: "${texto}"`);
  const envio = pedidos.find((p) => p.metodo === 'POST' && p.url.endsWith('/rpc/inscrever'));
  afirmar(envio, 'não foi enviado nenhum pedido de inscrição');
  const corpo = JSON.parse(envio.corpo);
  afirmar(corpo.p_nome === 'Ana' && corpo.p_maior_idade === true && corpo.p_dispositivo.length >= 16, `corpo inesperado: ${envio.corpo}`);
  afirmar(await page.locator('#minhas').isVisible(), '"As minhas inscrições" não apareceu');
  afirmar(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), 'scroll horizontal');
});

await cenario('(a2) a confirmação oferece "Adicionar ao calendário" e descarrega um .ics certo', async (page) => {
  await abrirPrimeiroLivre(page);
  await page.fill('#dlg-nome', 'Ana');
  await page.check('#dlg-maior');
  await page.click('#dlg-confirmar');
  const botao = page.locator('#confirmacao button[data-acao="calendario"]');
  await botao.waitFor({ state: 'visible' });
  afirmar((await botao.innerText()) === 'Adicionar ao calendário', 'texto do botão');
  const [descarga] = await Promise.all([page.waitForEvent('download'), botao.click()]);
  afirmar(descarga.suggestedFilename() === 'turno-festas-de-verao-da-ribeira.ics', `ficheiro: ${descarga.suggestedFilename()}`);
  const { readFile } = await import('node:fs/promises');
  const ics = await readFile(await descarga.path(), 'utf8');
  // Primeiro turno livre: Bar, sábado 22, 20h–22h em Lisboa (verão) = 19:00Z–21:00Z
  afirmar(ics.includes('DTSTART:20300622T190000Z\r\n') && ics.includes('DTEND:20300622T210000Z\r\n'), `datas: ${ics}`);
  afirmar(ics.includes('SUMMARY:Festas de Verão da Ribeira · Bar\r\n') && ics.includes('LOCATION:Aldeia da Ribeira\r\n'), `texto: ${ics}`);
  afirmar(ics.includes('UID:00000000-0000-4000-8000-000000009000@barraca\r\n') && /DTSTAMP:\d{8}T\d{6}Z/.test(ics), `uid/dtstamp: ${ics}`);
  afirmar(!ics.includes('Ana'), 'o nome do voluntário não devia estar no .ics');
});

await cenario('(a3) .ics escapa vírgulas e ponto e vírgula do nome da festa e da localidade', async (page) => {
  await abrirPrimeiroLivre(page);
  await page.fill('#dlg-nome', 'Ana');
  await page.check('#dlg-maior');
  await page.click('#dlg-confirmar');
  const botao = page.locator('#confirmacao button[data-acao="calendario"]');
  await botao.waitFor({ state: 'visible' });
  const [descarga] = await Promise.all([page.waitForEvent('download'), botao.click()]);
  const { readFile } = await import('node:fs/promises');
  const ics = await readFile(await descarga.path(), 'utf8');
  afirmar(ics.includes('SUMMARY:Festa\\, do Zé\\; Norte · Bar\r\n'), `summary: ${ics}`);
  afirmar(ics.includes('LOCATION:Vila\\, Alta\\; PT\r\n'), `location: ${ics}`);
}, (url) => (url.pathname.endsWith('/rest/v1/festas')
  ? { body: JSON.stringify([{ id: '00000000-0000-4000-8000-000000000001', slug: 'demonstracao', nome: 'Festa, do Zé; Norte', localidade: 'Vila, Alta; PT', data_inicio: '2030-06-22', data_fim: '2030-06-23', descricao: '', demo: true }]) }
  : null));

await cenario('(b) sem a caixa de maioridade não envia', async (page, pedidos) => {
  await abrirPrimeiroLivre(page);
  await page.fill('#dlg-nome', 'Ana');
  await page.click('#dlg-confirmar');
  const erro = await page.locator('#dlg-erro').innerText();
  afirmar(erro.includes('18 anos ou mais'), `mensagem inesperada: "${erro}"`);
  afirmar(await page.locator('dialog#dlg[open]').count() === 1, 'a folha fechou');
  afirmar(!pedidos.some((p) => p.metodo === 'POST'), 'foi enviado um pedido sem a caixa marcada');
});

await cenario('(b2) nome inválido não envia', async (page, pedidos) => {
  await abrirPrimeiroLivre(page);
  await page.fill('#dlg-nome', 'Ana123');
  await page.check('#dlg-maior');
  await page.click('#dlg-confirmar');
  afirmar((await page.locator('#dlg-erro').innerText()).includes('só o primeiro nome'), 'faltou a mensagem de nome inválido');
  afirmar(!pedidos.some((p) => p.metodo === 'POST'), 'foi enviado um pedido com nome inválido');
});

await cenario('(c) turno_cheio mostra a mensagem humana', async (page) => {
  await abrirPrimeiroLivre(page);
  await page.fill('#dlg-nome', 'Ana');
  await page.check('#dlg-maior');
  await page.click('#dlg-confirmar');
  const aviso = page.getByText('Este turno ficou completo agora mesmo. Escolha outro, por favor.');
  await aviso.waitFor({ state: 'visible' });
  afirmar(await page.locator('#confirmacao').isHidden(), 'apareceu uma confirmação apesar do erro');
}, (url, metodo) => (eInscricao(url, metodo) ? { status: 400, body: '{"message":"turno_cheio"}' } : null));

await cenario('(d) nomes com HTML ficam como texto', async (page) => {
  await abrirFesta(page);
  const xss = await page.evaluate(() => window.__xss);
  afirmar(xss === undefined, `window.__xss = ${xss}`);
  const imgs = await page.locator('.turno__nomes img, .turno img').count();
  afirmar(imgs === 0, `há ${imgs} <img> dentro dos turnos`);
  const nomes = await page.locator('.turno__nomes').allInnerTexts();
  afirmar(nomes.some((t) => t.includes('<img src=x onerror="window.__xss=1">')), 'o nome malicioso não aparece como texto');
  afirmar(nomes.some((t) => t.includes('Zé, Fátima e Rui')), 'resumo "Zé, Fátima e Rui" em falta');
  // Na página de gestão também
  await page.goto(`${base}/barraca/gerir.html?f=demonstracao#chave-de-teste-123456`);
  await page.waitForSelector('[data-pronto="sim"]');
  afirmar(await page.locator('.turno img').count() === 0, 'há <img> na gestão');
  afirmar(await page.evaluate(() => window.__xss) === undefined, 'window.__xss definido na gestão');
  afirmar(await page.locator('button', { hasText: 'Remover' }).count() > 0, 'sem botões "Remover" na gestão');
});

await cenario('(e) criar festa mostra os dois links', async (page, pedidos) => {
  await page.goto(`${base}/barraca/criar.html`);
  await page.waitForSelector('[data-pronto="sim"]');
  await page.fill('[data-campo="nome"]', 'Festa de Teste');
  await page.fill('[data-campo="localidade"]', 'Ribeira');
  await page.fill('[data-campo="data_inicio"]', '2030-06-22');
  await page.fill('[data-campo="data_fim"]', '2030-06-23');
  await page.fill('[data-campo="postos.0.nome"]', 'Bar');
  await page.fill('[data-campo="postos.0.turnos.0.inicio"]', '22:00');
  await page.fill('[data-campo="postos.0.turnos.0.fim"]', '00:00');
  await page.fill('[data-campo="postos.0.turnos.0.vagas"]', '4');
  await page.click('#criar');
  await page.locator('#sucesso').waitFor({ state: 'visible' });
  const vol = await page.locator('[data-link="voluntarios"]').getAttribute('href');
  const ger = await page.locator('[data-link="gestao"]').getAttribute('href');
  afirmar(vol === `${base}/barraca/festa.html?f=festa-de-teste-a1b2c3`, `link de voluntários: ${vol}`);
  afirmar(ger === `${base}/barraca/gerir.html?f=festa-de-teste-a1b2c3#chave-secreta-de-teste_0123456789`, `link de gestão: ${ger}`);
  const envio = JSON.parse(pedidos.find((p) => p.url.endsWith('/rpc/criar_festa')).corpo).p_festa;
  afirmar(envio.postos[0].turnos[0].fim === '00:00' && envio.slug_base === 'festa-de-teste', `payload inesperado: ${JSON.stringify(envio)}`);
  afirmar((await page.locator('#sucesso').innerText()).includes('não o partilhe'), 'falta o aviso de não partilhar');
  const wa = await page.locator('#sucesso a#partilhar').getAttribute('href');
  afirmar(wa.startsWith('https://wa.me/?text='), `href de partilha: ${wa}`);
  const msg = new URL(wa).searchParams.get('text');
  afirmar(msg.includes('Festa de Teste') && msg.includes(vol), `texto de partilha: ${msg}`);
  afirmar(!wa.includes('gerir.html') && !decodeURIComponent(wa).includes('gerir.html') && !msg.includes('chave-secreta'), 'a partilha inclui o link de gestão');
  afirmar(await page.locator('.link-caixa--gestao #partilhar').count() === 0, 'botão de partilha no bloco de gestão');
});

await cenario('(e3) festa tem o botão Partilhar no WhatsApp e meta Open Graph', async (page) => {
  await abrirFesta(page);
  const a = page.locator('a#partilhar');
  afirmar(await a.isVisible(), 'botão de partilha invisível');
  afirmar(await a.getAttribute('target') === '_blank' && (await a.getAttribute('rel')).includes('noopener'), 'target/rel em falta');
  const msg = new URL(await a.getAttribute('href')).searchParams.get('text');
  afirmar(msg.includes(`${base}/barraca/festa.html?f=demonstracao`), `link em falta: ${msg}`);
  afirmar(!msg.includes('gerir.html'), 'link de gestão na partilha');
  afirmar(await page.locator('meta[property="og:title"]').getAttribute('content') === 'Escolha o seu turno na festa · Barraca', 'og:title');
  afirmar(await page.locator('meta[property="og:image"]').count() === 0, 'og:image não devia existir');
});

await cenario('(e2) criar festa com dados em falta mostra erros e não envia', async (page, pedidos) => {
  await page.goto(`${base}/barraca/criar.html`);
  await page.waitForSelector('[data-pronto="sim"]');
  await page.click('#criar');
  await page.locator('#erros').waitFor({ state: 'visible' });
  afirmar((await page.locator('#erros').innerText()).includes('nome da festa'), 'faltou o erro do nome');
  afirmar(!pedidos.some((p) => p.metodo === 'POST'), 'foi enviado um pedido inválido');
});

await cenario('(f) festa inexistente mostra estado vazio com link para o início', async (page) => {
  await page.goto(`${base}/barraca/festa.html?f=nao-existe`);
  await page.waitForSelector('[data-pronto="sim"]');
  afirmar((await page.locator('#titulo').innerText()).includes('Não encontrámos esta festa'), 'falta o título do estado vazio');
  const href = await page.getByRole('link', { name: 'Voltar ao início' }).getAttribute('href');
  afirmar(href === 'index.html', `link inesperado: ${href}`);
}, (url) => (url.pathname.endsWith('/rest/v1/festas') ? { body: '[]' } : null));

await cenario('(g) sem CDN: modo sondagem com "Atualizado às"', async (page) => {
  await abrirFesta(page);
  const t = await page.locator('#ligacao').innerText();
  afirmar(/Atualizado às \d\d:\d\d/.test(t), `indicador inesperado: "${t}"`);
});

await browser.close();
fechar();

if (falhas.length) { console.error('✗ E2E falhou:\n- ' + falhas.join('\n- ')); process.exit(1); }
console.log(`✓ E2E OK (${feitos} cenários)`);
