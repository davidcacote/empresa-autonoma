// Validação do repositório: corre no CI antes de qualquer deploy.
// Sem dependências: só Node 22.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const raiz = new URL('..', import.meta.url).pathname;
const erros = [];
const falha = (msg) => erros.push(msg);

function lerJson(rel) {
  const caminho = join(raiz, rel);
  if (!existsSync(caminho)) { falha(`${rel}: ficheiro em falta`); return null; }
  try { return JSON.parse(readFileSync(caminho, 'utf8')); }
  catch (e) { falha(`${rel}: JSON inválido (${e.message})`); return null; }
}

function exigir(obj, campos, onde) {
  for (const c of campos) if (obj?.[c] === undefined) falha(`${onde}: falta o campo "${c}"`);
}

// 1. Dados da empresa (alimentam o painel HQ)
const empresa = lerJson('empresa/dados/empresa.json');
if (empresa) exigir(empresa, ['nome', 'produto', 'missao', 'fundada_em', 'links'], 'empresa.json');

const orcamento = lerJson('empresa/dados/orcamento.json');
if (orcamento) {
  exigir(orcamento, ['pausado', 'max_agentes_por_ciclo', 'modelo_agentes'], 'orcamento.json');
  if (typeof orcamento.pausado !== 'boolean') falha('orcamento.json: "pausado" tem de ser true/false');
}

const equipa = lerJson('empresa/dados/equipa.json');
if (Array.isArray(equipa)) equipa.forEach((m, i) => exigir(m, ['id', 'nome', 'papel', 'cor'], `equipa.json[${i}]`));
else if (equipa) falha('equipa.json: tem de ser uma lista');

const ESTADOS_BACKLOG = ['ideia', 'a_fazer', 'em_curso', 'feito', 'cancelado'];
const backlog = lerJson('empresa/dados/backlog.json');
if (Array.isArray(backlog)) {
  const ids = new Set();
  backlog.forEach((b, i) => {
    exigir(b, ['id', 'titulo', 'estado', 'prioridade', 'criterios'], `backlog.json[${i}]`);
    if (ids.has(b.id)) falha(`backlog.json: id repetido ${b.id}`);
    ids.add(b.id);
    if (b.estado && !ESTADOS_BACKLOG.includes(b.estado)) falha(`backlog.json[${i}]: estado "${b.estado}" inválido`);
  });
} else if (backlog) falha('backlog.json: tem de ser uma lista');

const reunioes = lerJson('empresa/dados/reunioes.json');
if (Array.isArray(reunioes)) {
  const papeis = new Set((equipa ?? []).map((m) => m.id));
  reunioes.forEach((r, i) => {
    exigir(r, ['id', 'data', 'titulo', 'intervencoes'], `reunioes.json[${i}]`);
    (r.intervencoes ?? []).forEach((iv, j) => {
      exigir(iv, ['quem', 'texto'], `reunioes.json[${i}].intervencoes[${j}]`);
      if (papeis.size && iv.quem && !papeis.has(iv.quem) && iv.quem !== 'sistema' && iv.quem !== 'donos')
        falha(`reunioes.json[${i}].intervencoes[${j}]: "${iv.quem}" não é membro da equipa`);
    });
  });
} else if (reunioes) falha('reunioes.json: tem de ser uma lista');

const decisoes = lerJson('empresa/dados/decisoes.json');
if (Array.isArray(decisoes)) decisoes.forEach((d, i) => exigir(d, ['id', 'data', 'titulo', 'decisao', 'estado'], `decisoes.json[${i}]`));
else if (decisoes) falha('decisoes.json: tem de ser uma lista');

const ciclos = lerJson('empresa/dados/ciclos.json');
if (Array.isArray(ciclos)) ciclos.forEach((c, i) => exigir(c, ['n', 'inicio', 'objetivo', 'resultado'], `ciclos.json[${i}]`));
else if (ciclos) falha('ciclos.json: tem de ser uma lista');

if (existsSync(join(raiz, 'empresa/dados/mercado.json'))) {
  const mercado = lerJson('empresa/dados/mercado.json');
  if (mercado) {
    exigir(mercado, ['atualizado_em', 'segmentos', 'falhas', 'oportunidades'], 'mercado.json');
    for (const lista of ['segmentos', 'falhas', 'oportunidades', 'concorrencia', 'calendario', 'fontes'])
      if (mercado[lista] !== undefined && !Array.isArray(mercado[lista])) falha(`mercado.json: "${lista}" tem de ser uma lista`);
    (mercado.oportunidades ?? []).forEach((o, i) => exigir(o, ['id', 'cliente', 'descricao'], `mercado.json oportunidades[${i}]`));
    (mercado.falhas ?? []).forEach((f, i) => exigir(f, ['id', 'descricao'], `mercado.json falhas[${i}]`));
    (mercado.fontes ?? []).forEach((f, i) => { if (f.url && !/^https?:\/\//.test(f.url)) falha(`mercado.json fontes[${i}]: URL inválido`); });
  }
}

// 2. Nada de segredos no repositório
const PADROES_SEGREDO = [
  /sb_secret_[A-Za-z0-9_-]{10,}/,
  /service_role/i,
  /SUPABASE_SERVICE_ROLE/i,
  /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
  /ghp_[A-Za-z0-9]{30,}/,
];
const IGNORAR = new Set(['.git', 'node_modules', '_site', 'scripts']);
function percorrer(dir) {
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome)) continue;
    const p = join(dir, nome);
    const s = statSync(p);
    if (s.isDirectory()) { percorrer(p); continue; }
    if (!['.js', '.mjs', '.html', '.css', '.json', '.md', '.sql', '.yml', '.yaml', '.ts'].includes(extname(nome))) continue;
    const texto = readFileSync(p, 'utf8');
    for (const re of PADROES_SEGREDO) {
      // Permite mencionar "service_role" em documentação que proíbe o seu uso
      if (re.source.includes('service_role') && /nunca|proib|never/i.test(texto)) continue;
      if (re.test(texto)) falha(`${p.replace(raiz, '')}: possível segredo (${re})`);
    }
  }
}
percorrer(raiz);

// 3. Páginas HTML com língua definida
for (const pagina of ['app/index.html', 'hq/index.html']) {
  const caminho = join(raiz, pagina);
  if (!existsSync(caminho)) { falha(`${pagina}: em falta`); continue; }
  const html = readFileSync(caminho, 'utf8');
  if (!/<html[^>]*lang="pt(-PT)?"/.test(html)) falha(`${pagina}: falta lang="pt-PT" no <html>`);
  if (!/<title>[^<]+<\/title>/.test(html)) falha(`${pagina}: falta <title>`);
  if (!/name="viewport"/.test(html)) falha(`${pagina}: falta meta viewport`);
}

if (erros.length) {
  console.error(`✗ Validação falhou (${erros.length}):\n- ` + erros.join('\n- '));
  process.exit(1);
}
console.log('✓ Validação OK');
