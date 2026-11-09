// Monta o site publicado em _site/:
//   /          -> site/ (a montra do estúdio + redirecionamentos antigos)
//   /<nome>/   -> apps/<nome>/ (cada produto; ex.: /barraca/)
//   /hq/       -> hq/ (o painel da empresa) + dados da empresa
import { cpSync, rmSync, mkdirSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const raiz = new URL('..', import.meta.url).pathname;
const saida = join(raiz, '_site');

rmSync(saida, { recursive: true, force: true });
mkdirSync(saida, { recursive: true });

cpSync(join(raiz, 'site'), saida, { recursive: true });
const pastaApps = join(raiz, 'apps');
for (const nome of readdirSync(pastaApps)) {
  if (!statSync(join(pastaApps, nome)).isDirectory()) continue;
  if (nome === 'hq') throw new Error('apps/hq colide com o painel em /hq/');
  cpSync(join(pastaApps, nome), join(saida, nome), { recursive: true });
}
cpSync(join(raiz, 'hq'), join(saida, 'hq'), { recursive: true });
cpSync(join(raiz, 'empresa/dados'), join(saida, 'hq/dados'), { recursive: true });
if (existsSync(join(raiz, 'empresa/atas'))) cpSync(join(raiz, 'empresa/atas'), join(saida, 'hq/atas'), { recursive: true });

let commit = process.env.GITHUB_SHA ?? '';
if (!commit) { try { commit = execSync('git rev-parse HEAD', { cwd: raiz }).toString().trim(); } catch { commit = 'local'; } }
writeFileSync(join(saida, 'hq/dados/build.json'), JSON.stringify({
  commit,
  gerado_em: new Date().toISOString(),
  run_id: process.env.GITHUB_RUN_ID ?? null,
}, null, 2));

// GitHub Pages: não processar com Jekyll
writeFileSync(join(saida, '.nojekyll'), '');
console.log('✓ Site gerado em _site/');
