// O Node 22 não aceita uma pasta em `node --test tests/`; resolvendo a pasta para este ficheiro,
// o comando funciona e corre todos os testes unitários (*.test.mjs) desta pasta.
import { readdirSync } from 'node:fs';

for (const f of readdirSync(new URL('.', import.meta.url)).filter((n) => n.endsWith('.test.mjs')).sort()) {
  await import(new URL(f, import.meta.url));
}
