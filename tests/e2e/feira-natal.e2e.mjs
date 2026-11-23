// Criar festa a partir do modelo "Feira de Natal de escola" (API simulada, sem rede).
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

await page.fill('[data-campo="nome"]', 'Feira de Natal da Escola');
await page.fill('[data-campo="localidade"]', 'Aldeia');
await page.fill('[data-campo="data_inicio"]', '2031-12-06');
await page.fill('[data-campo="data_fim"]', '2031-12-07');

await page.getByLabel('Começar de um modelo').selectOption({ label: 'Feira de Natal de escola' });
const botao = page.locator('#usar-modelo');
afirmar((await botao.boundingBox()).height >= 44, 'botão "Usar modelo" com menos de 44px');
await botao.click();
afirmar(pedidos.filter((p) => p.metodo === 'POST').length === 0, 'aplicar o modelo não pode gravar');

const nomes = await page.locator('[data-parte="nome"]').evaluateAll((els) => els.map((e) => e.value));
afirmar(nomes.join('|') === 'Bolos|Chocolate quente|Rifas|Montagem e desmontagem', `bancas inesperadas: ${nomes}`);
afirmar(await page.locator('.turno-form').count() === 9, 'esperava 9 turnos');
afirmar(await page.locator('[data-campo="postos.3.turnos.0.dia"]').inputValue() === '2031-12-06', 'montagem deve ser no 1.º dia');
afirmar(await page.locator('[data-campo="postos.3.turnos.1.dia"]').inputValue() === '2031-12-07', 'desmontagem deve ser no último dia');

// Editar um turno (Bolos, 1.º turno): vagas e fim
await page.fill('[data-campo="postos.0.turnos.0.vagas"]', '4');
await page.fill('[data-campo="postos.0.turnos.0.fim"]', '11:30');

await page.click('#criar');
await page.locator('#sucesso').waitFor({ state: 'visible' });
const envio = pedidos.filter((p) => p.metodo === 'POST' && p.url.endsWith('/rpc/criar_festa'));
afirmar(envio.length === 1, `esperava 1 criar_festa, houve ${envio.length}`);
if (envio.length) {
  const postos = JSON.parse(envio[0].corpo).p_festa.postos;
  afirmar(postos.length === 4 && postos[0].turnos.length === 3, 'estrutura do payload inesperada');
  const t = postos[0].turnos[0];
  afirmar(t.vagas === 4 && JSON.stringify(t).includes('11:30'), `edição não chegou ao payload: ${JSON.stringify(t)}`);
}
afirmar(erros().length === 0, `erros na consola: ${erros().join(' | ')}`);

await browser.close();
fechar();
if (falhas.length) { console.error('✗ E2E feira de natal falhou:\n- ' + falhas.join('\n- ')); process.exit(1); }
console.log('✓ E2E feira de natal OK');
