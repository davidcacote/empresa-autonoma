import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = new URL('../apps/turno-certo/', import.meta.url).pathname;
const ficheiros = (d = RAIZ) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? ficheiros(join(d, n)) : [join(d, n)]));
const ler = (n) => readFileSync(join(RAIZ, n), 'utf8');

test('nenhum ficheiro referencia URLs externas (sem CDN, sem rede)', () => {
  for (const f of ficheiros()) {
    const t = readFileSync(f, 'utf8').replaceAll('http://www.w3.org/2000/svg', '');
    assert.doesNotMatch(t, /https?:\/\/|\/\/cdn\.|XMLHttpRequest|WebSocket|sendBeacon/, f);
    if (!f.endsWith('sw.js')) assert.doesNotMatch(t, /fetch\(/, f); // o sw só repõe pedidos da mesma origem
  }
});

test('HTML: lang pt-PT, título não vazio, viewport, manifest e print.css', () => {
  const h = ler('index.html');
  assert.match(h, /<html lang="pt-PT">/);
  assert.match(h, /<title>\s*\S[^<]*<\/title>/);
  assert.match(h, /name="viewport"/);
  assert.match(h, /rel="manifest" href="manifest\.webmanifest"/);
  assert.match(h, /print\.css" media="print"/);
  assert.match(h, /Carregar festa de exemplo/);
});

test('manifest mínimo válido e service worker só com caminhos relativos do app', () => {
  const m = JSON.parse(ler('manifest.webmanifest'));
  assert.equal(m.name, 'Turno Certo'); assert.equal(m.lang, 'pt-PT'); assert.ok(m.start_url);
  const sw = ler('sw.js');
  assert.match(sw, /origin !== self\.location\.origin/);
  for (const f of [...sw.matchAll(/'([^']+\.(?:js|css|html|svg|webmanifest))'/g)].map((x) => x[1])) assert.doesNotMatch(f, /^\//), assert.ok(statSync(join(RAIZ, f)).isFile(), f);
});

test('CSS de impressão: A4, preto e branco, letra grande, destaque não só por cor', () => {
  const p = ler('styles/print.css');
  assert.match(p, /size:\s*A4/);
  assert.match(p, /color:\s*#000 !important/);
  assert.match(p, /font-size:\s*16pt/);
  assert.match(p, /\.posto--falta\s*\{[^}]*(double|dashed)/);
  assert.match(p, /\.faltam[^}]*(underline|::before)/s);
});

test('JS da interface: sem innerHTML', () => {
  assert.doesNotMatch(ler('js/app.js'), /innerHTML|insertAdjacentHTML|eval\(/);
});

test('contraste AA das cores de texto principais', () => {
  const lum = (hex) => { const c = hex.match(/\w\w/g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const razao = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const css = ler('styles/app.css');
  for (const v of ['tinta', 'erro', 'linha', 'realce']) {
    const cor = css.match(new RegExp(`--${v}:\\s*#([0-9a-f]{6})`, 'i'))[1];
    assert.ok(razao(cor, 'ffffff') >= 4.5, `--${v} contra branco: ${razao(cor, 'ffffff').toFixed(2)}`);
  }
  assert.ok(razao('111111', 'f4f1ea') >= 4.5);
  assert.ok(razao('a40000', 'ffffff') >= 4.5);
});
