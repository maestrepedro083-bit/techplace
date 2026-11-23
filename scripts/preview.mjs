import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import worker from '../dist/server/index.js';

const portArg = process.argv.indexOf('--port');
const port = portArg > -1 ? Number(process.argv[portArg + 1]) : 4173;
mkdirSync('.preview', { recursive: true });
const db = new DatabaseSync('.preview/state.sqlite');
for (const [table, file] of [['products', '0000_loja.sql'], ['service_orders', '0001_service_orders.sql'], ['film_families', '0002_film_families.sql'], ['knowledge_guides', '0003_knowledge.sql'], ['sales', '0004_sales_media.sql'], ['staff_accounts', '0005_staff_access.sql'], ['shop_revision', '0006_shared_panel.sql'], ['part_prices', '0007_part_prices.sql']]) {
  if (!db.prepare('SELECT name FROM sqlite_schema WHERE name=?').get(table)) {
    db.exec(readFileSync('drizzle/' + file, 'utf8'));
  }
}

function prepare(sql, args = []) {
  const method = /^(SELECT|PRAGMA)/i.test(sql.trim()) ? 'all' : 'run';
  const stmt = db.prepare(sql);
  return {
    bind: (...values) => prepare(sql, values),
    first: () => stmt.get(...args),
    all: () => ({ results: stmt.all(...args) }),
    run() {
      if (method === 'all') return { results: stmt.all(...args) };
      const result = stmt.run(...args);
      return { meta: { changes: result.changes }, results: [] };
    }
  };
}

const filePath = (key) => '.preview/media/' + encodeURIComponent(key);
mkdirSync('.preview/media', { recursive: true });
const bucket = {
  head(key) { return existsSync(filePath(key)) ? { key } : null; },
  put(key, data, options) {
    try {
      writeFileSync(filePath(key), Buffer.from(data), { flag: options?.onlyIf ? 'wx' : 'w' });
    } catch (error) {
      if (error.code !== 'EEXIST' || !options?.onlyIf) throw error;
    }
  },
  get(key, { range } = {}) {
    try {
      const data = readFileSync(filePath(key));
      return { body: range ? data.subarray(range.offset, range.offset + range.length) : data };
    } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
};

const env = { TP_AUTH_PEPPER: 'segredo-local-da-demonstracao-do-painel', BUCKET: bucket, DB: {
  prepare,
  batch(statements) {
    db.exec('BEGIN');
    try {
      const result = statements.map((statement) => statement.run());
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
} };

createServer(async (incoming, outgoing) => {
  try {
    const base = incoming.headers.origin || 'http://' + incoming.headers.host;
    const url = new URL(incoming.url, base);
    const headers = new Headers(incoming.headers);
    const body = ['POST', 'PUT'].includes(incoming.method) ? Buffer.concat(await Array.fromAsync(incoming)) : undefined;
    const response = await worker.fetch(new Request(url, { method: incoming.method, headers, body }), env);
    const outgoingHeaders = Object.fromEntries(response.headers);
    const cookies = response.headers.getSetCookie();
    if (cookies.length) outgoingHeaders['set-cookie'] = cookies;
    outgoing.writeHead(response.status, outgoingHeaders);
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500).end();
  }
}).listen(port, '0.0.0.0');
