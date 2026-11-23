import { knowledgeTopics } from '../src/knowledge.js';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const load = (name) => readFile(new URL('../' + name, import.meta.url), 'utf8');
const worker = await load('src/worker.js');
const resources = [
  ['/', 'index.html', 'text/html'], ['/style.css', 'style.css', 'text/css'], ['/app.js', 'app.js', 'text/javascript'],
  ['/assistant.js', 'assistant.js', 'text/javascript'], ['/films.js', 'films.js', 'text/javascript'],
  ['/film-catalog.json', 'film-catalog.json', 'application/json'], ['/knowledge.js', 'knowledge.js', 'text/javascript'], ['/sales.js', 'sales.js', 'text/javascript'],
  ['/session.js', 'session.js', 'text/javascript'], ['/parts-pricing.js', 'parts-pricing.js', 'text/javascript'], ['/parts-catalog.json', 'parts-catalog.json', 'application/json'],
  ['/manifest.webmanifest', 'manifest.webmanifest', 'application/manifest+json']
];
const assets = Object.fromEntries(await Promise.all(resources.map(async ([route, file, type]) =>
  [route, [await load('src/' + file), type]])));
for (const size of [180, 192, 512]) {
  const path = '/icons/tech-place-' + size + '.png';
  const icon = await readFile(new URL('../src' + path, import.meta.url));
  assets[path] = [icon.toString('base64'), 'image/png', true];
}
const backupWorker = await load('src/backup.js');
const accessWorker = await load('src/auth-worker.js');
const partsWorker = await load('src/parts-worker.js');
const mysqlSchema = await load('profreehost/schema.mysql.sql');
async function portableFiles(directory, prefix = '') {
  const records = [];
  for (const entry of await readdir(new URL('../profreehost/' + directory, import.meta.url), { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isDirectory()) records.push(...await portableFiles(directory + entry.name + '/', path + '/'));
    else if (entry.isFile()) {
      const buffer = await readFile(new URL('../profreehost/' + directory + entry.name, import.meta.url));
      records.push(['htdocs/' + path, buffer.toString('base64')]);
    }
  }
  return records;
}
const profreeFiles = Object.fromEntries(await portableFiles('htdocs/'));
for (const [route, [body, type, binary]] of Object.entries(assets)) {
  const filename = route === '/' ? 'index.html' : route.slice(1);
  const privateData = route === '/parts-catalog.json' || route === '/film-catalog.json';
  let content = route === '/app.js' ? body
    .replace('Fotos JPG, PNG, WebP ou HEIC até 12 MB. Vídeos MP4, WebM ou MOV até 50 MB.', 'Fotos e vídeos até 8 MB por arquivo.')
    .replace("const limit = type.startsWith('video/') ? 50 : 12;", 'const limit = 8;') : body;
  if (route === '/session.js') {
    content = content.replace("  const auth = document.querySelector('#shop-auth');", `  if (location.protocol !== 'https:') {
    document.querySelector('#auth-waiting').textContent = 'Use o endereço HTTPS para entrar.';
    const link = document.querySelector('#auth-open-tab');
    const secureUrl = new URL(location.href);
    secureUrl.protocol = 'https:';
    link.href = secureUrl.href;
    link.textContent = 'Abrir com HTTPS';
    link.hidden = false;
    return;
  }
  const auth = document.querySelector('#shop-auth');`);
  }
  profreeFiles['htdocs/' + (privateData ? '_tecnologia/' : '') + filename] = binary ? body : Buffer.from(content).toString('base64');
}
profreeFiles['htdocs/_tecnologia/topics.json'] = Buffer.from(JSON.stringify(Object.keys(knowledgeTopics))).toString('base64');
profreeFiles['LEIA-ME.txt'] = Buffer.from(await load('profreehost/LEIA-ME.txt')).toString('base64');
const profreeWorker = (await load('src/profreehost-export.js'))
  .replace('/* BUILT_PROFREEHOST_TEMPLATE */ {}', () => JSON.stringify(profreeFiles))
  .replace("/* BUILT_PROFREEHOST_SCHEMA */ ''", () => JSON.stringify(mysqlSchema));
const source = worker.replace('/* BACKUP_WORKER */', () => backupWorker)
  .replace('/* AUTH_WORKER */', () => accessWorker)
  .replace('/* PARTS_WORKER */', () => partsWorker)
  .replace('/* MIGRATION_EXPORT */', () => profreeWorker)
  .replace('/* BUILT_ASSETS */ {}', () => JSON.stringify(assets))
  .replace('/* BUILT_KNOWLEDGE_TOPICS */ []', () => JSON.stringify(Object.keys(knowledgeTopics)));
await Promise.all(['dist/server', 'dist/.openai', 'dist/drizzle'].map((path) => mkdir(path, { recursive: true })));
const migrations = (await readdir('drizzle')).filter((file) => file.endsWith('.sql'));
await Promise.all([
  writeFile('dist/server/index.js', source),
  copyFile('.openai/hosting.json', 'dist/.openai/hosting.json'),
  ...migrations.map((file) => copyFile('drizzle/' + file, 'dist/drizzle/' + file))
]);
const built = await import('../dist/server/index.js');
if (typeof built.default.fetch !== 'function') throw Error('Invalid Worker entrypoint');
