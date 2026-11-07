// Servidor estático + browser com a API do Supabase simulada (testes herméticos, sem rede).
// Contrato das fixtures (tests/fixtures/):
//   GET  .../rest/v1/<tabela>?...   -> <tabela>.json   (lista)
//   POST .../rest/v1/rpc/<funcao>   -> rpc-<funcao>.json
//   Qualquer outro pedido externo (CDN, fontes, websockets) é abortado.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const { chromium } = require('playwright');

const RAIZ_SITE = new URL('../_site', import.meta.url).pathname;
const RAIZ_FIXTURES = new URL('../tests/fixtures', import.meta.url).pathname;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/markdown; charset=utf-8', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };

export async function iniciarServidor() {
  const servidor = createServer(async (req, res) => {
    let caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (caminho.endsWith('/')) caminho += 'index.html';
    const ficheiro = normalize(join(RAIZ_SITE, caminho));
    if (!ficheiro.startsWith(RAIZ_SITE)) { res.writeHead(403).end(); return; }
    try {
      const corpo = await readFile(ficheiro);
      res.writeHead(200, { 'content-type': TIPOS[extname(ficheiro)] ?? 'application/octet-stream' }).end(corpo);
    } catch { res.writeHead(404).end('404'); }
  });
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  return { base: `http://127.0.0.1:${servidor.address().port}`, fechar: () => servidor.close() };
}

function fixture(nome) {
  const p = join(RAIZ_FIXTURES, nome);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

/** Simula o Supabase numa página. `extra(url, metodo, corpo)` pode devolver {status, body} para sobrepor. */
export async function simularApi(page, extra) {
  const pedidos = [];
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    pedidos.push({ metodo: req.method(), url: req.url(), corpo: req.postData() });
    const sobreposto = extra?.(url, req.method(), req.postData());
    if (sobreposto) return route.fulfill({ status: sobreposto.status ?? 200, contentType: 'application/json', body: sobreposto.body });
    const m = url.pathname.match(/\/rest\/v1\/(rpc\/)?([a-z_]+)$/);
    if (m) {
      const corpo = fixture(m[1] ? `rpc-${m[2]}.json` : `${m[2]}.json`);
      if (corpo !== null) return route.fulfill({ status: 200, contentType: 'application/json', body: corpo });
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"fixture em falta"}' });
    }
    return route.abort();
  });
  return pedidos;
}

/** Recolhe erros da consola relevantes (ignora falhas de rede, que são esperadas sem internet). */
export function vigiarErros(page) {
  const erros = [];
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('pageerror', (e) => erros.push(String(e)));
  return () => erros.filter((e) => !/net::ERR|Failed to load resource|WebSocket|fetch dynamically imported module|Failed to fetch/i.test(e));
}
