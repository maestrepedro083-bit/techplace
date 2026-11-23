const profreeTemplate = /* BUILT_PROFREEHOST_TEMPLATE */ {};
const profreeSchema = /* BUILT_PROFREEHOST_SCHEMA */ '';
const profreeSqlPath = '/exportar/dados-da-loja-profreehost.sql';
const profreeExportPaths = new Set(['/exportar', '/exportar/profreehost.zip', profreeSqlPath]);
const exportTables = [
  'products', 'stock_moves', 'sales', 'sale_items', 'cash_entries', 'service_orders', 'service_media',
  'film_families', 'knowledge_guides', 'knowledge_events', 'part_prices', 'shop_revision', 'staff_accounts', 'staff_invites'
];
const defaultImportKey = { columns: ['id'], charset: 'ascii', collation: 'ascii_bin' };
const importKeys = {
  sale_items: { ...defaultImportKey, columns: ['sale_id', 'product_id'] },
  part_prices: { columns: ['part_key'], charset: 'utf8mb4', collation: 'utf8mb4_bin' },
  shop_revision: { columns: ['id'] }
};
const importBatchSize = 50;
const exportLimit = 44 * 1048576;
const portableMediaLimit = 8 * 1048576;
const exportEncoder = new TextEncoder();
const exportDecoder = new TextDecoder();

function isExportOwner(request, env) {
  // These identity headers are populated by the Sites dispatch after ChatGPT sign-in.
  const owner = typeof env.TP_OWNER_EMAIL === 'string' ? env.TP_OWNER_EMAIL.trim().toLowerCase() : '';
  const email = request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  return Boolean(owner && email === owner && request.headers.get('oai-authenticated-user-id'));
}

function profreeExportPage(owner) {
  const action = owner
    ? '<p>Importe o SQL no phpMyAdmin. O ZIP contém os arquivos da loja e o guia de instalação.</p>' +
      '<a class="btn primary" href="' + profreeSqlPath + '">Baixar SQL para importar</a>' +
      '<a class="btn" href="/exportar/profreehost.zip">Baixar ZIP completo</a>'
    : '<p>Entre com a conta do ChatGPT que é proprietária do Site para baixar os dados da loja.</p><a class="btn primary" target="_top" href="/signin-with-chatgpt?return_to=%2Fexportar">Entrar com ChatGPT</a>';
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Exportar Tech Place Store</title>' +
    '<link rel="stylesheet" href="/style.css"></head><body><main class="auth-page"><section class="panel auth-card">' +
    '<h1>Exportar para a ProFreeHost</h1>' + action + '<a class="btn text" href="/">Voltar para a loja</a></section></main></body></html>';
  return new Response(html, { headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; style-src 'self'; frame-ancestors 'self' https://chatgpt.com https://chat.openai.com; base-uri 'none'"
  } });
}

function mysqlLiteral(value) {
  if (value == null) return 'NULL';
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  if (typeof value === 'string') {
    const hex = Array.from(exportEncoder.encode(value), (byte) => byte.toString(16).padStart(2, '0')).join('');
    return hex ? "CONVERT(X'" + hex + "' USING utf8mb4)" : "''";
  }
  throw new InputError('O banco contém um tipo de valor que precisa ser convertido antes da exportação.', 409);
}

function mysqlDump(results) {
  const identifier = (value) => {
    if (!/^[a-z_][a-z_0-9]*$/.test(value)) throw new InputError('A estrutura do banco precisa ser revisada.', 409);
    return '`' + value + '`';
  };
  const result = [profreeSchema, 'START TRANSACTION;'];
  for (const [index, table] of exportTables.entries()) {
    const records = results[index].results;
    if (!records.length) continue;
    const tableName = identifier(table);
    const fields = Object.keys(records[0]);
    const columns = fields.map(identifier);
    const key = importKeys[table] ?? defaultImportKey;
    const keyColumns = key.columns.map(identifier);
    const keyMatches = keyColumns.map(column => {
      const incoming = 'incoming_row.' + column;
      const typedKey = key.charset ? 'CONVERT(' + incoming + ' USING ' + key.charset + ') COLLATE ' + key.collation : incoming;
      return 'saved_row.' + column + ' = ' + typedKey;
    });
    const conditions = [
      ...keyMatches,
      ...columns.map(column => 'CAST(saved_row.' + column + ' AS BINARY) <=> CAST(incoming_row.' + column + ' AS BINARY)')
    ].join(' AND ');
    // Select only rows that have not already been imported. A differing row with
    // the same key still raises an error, so restarting never overwrites it.
    for (let offset = 0; offset < records.length; offset += importBatchSize) {
      const incoming = records.slice(offset, offset + importBatchSize).map((record, rowIndex) => 'SELECT ' +
        fields.map((field, columnIndex) => mysqlLiteral(record[field]) + (rowIndex === 0 ? ' AS ' + columns[columnIndex] : '')).join(','));
      result.push('INSERT INTO ' + tableName + ' (' + columns.join(',') + ')\n' +
        'SELECT ' + columns.map(column => 'incoming_row.' + column).join(',') + '\n' +
        'FROM (' + incoming.join('\nUNION ALL ') + ') AS incoming_row\n' +
        'LEFT JOIN ' + tableName + ' AS saved_row ON ' + conditions + '\n' +
        'WHERE saved_row.' + keyColumns[0] + ' IS NULL;');
    }
  }
  result.push('COMMIT;', '');
  return result.join('\n');
}

function readExportTables(db) {
  return db.batch(exportTables.map((table) => db.prepare('SELECT * FROM ' + table)));
}

const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let step = 0; step < 8; step++) n = (n & 1) ? (n >>> 1) ^ 0xedb88320 : n >>> 1;
  return n;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(files) {
  const entries = [];
  const headers = [];
  let position = 0;
  let headersLength = 0;
  const now = new Date();
  const date = ((now.getUTCFullYear() - 1980) << 9) | ((now.getUTCMonth() + 1) << 5) | now.getUTCDate();
  const time = (now.getUTCHours() << 11) | (now.getUTCMinutes() << 5) | (now.getUTCSeconds() >> 1);
  for (const [filename, bytes] of files) {
    const name = exportEncoder.encode(filename);
    const sum = crc32(bytes);
    const entry = new Uint8Array(30 + name.length);
    const e = new DataView(entry.buffer);
    e.setUint32(0, 0x04034b50, true);
    e.setUint16(4, 20, true);
    e.setUint16(6, 0x0800, true);
    e.setUint16(10, time, true);
    e.setUint16(12, date, true);
    e.setUint32(14, sum, true);
    e.setUint32(18, bytes.length, true);
    e.setUint32(22, bytes.length, true);
    e.setUint16(26, name.length, true);
    entry.set(name, 30);
    entries.push(entry, bytes);
    const central = new Uint8Array(46 + name.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(12, time, true);
    c.setUint16(14, date, true);
    c.setUint32(16, sum, true);
    c.setUint32(20, bytes.length, true);
    c.setUint32(24, bytes.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, position, true);
    central.set(name, 46);
    headers.push(central);
    headersLength += central.length;
    position += entry.length + bytes.length;
  }
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, files.size, true);
  view.setUint16(10, files.size, true);
  view.setUint32(12, headersLength, true);
  view.setUint32(16, position, true);
  return new Blob([...entries, ...headers, end], { type: 'application/zip' });
}

async function profreeDownload(env) {
  if (typeof env.TP_AUTH_PEPPER !== 'string' || env.TP_AUTH_PEPPER.length < 32) {
    throw new InputError('A configuração necessária para migrar as contas está indisponível.', 503);
  }
  const results = await readExportTables(env.DB);
  const files = new Map(Object.entries(profreeTemplate).map(([name, bytes]) => [
    name, Uint8Array.from(atob(bytes), (char) => char.charCodeAt(0))
  ]));
  const phpConfig = 'htdocs/_tecnologia/config.php';
  const pepper = btoa(String.fromCharCode(...exportEncoder.encode(env.TP_AUTH_PEPPER)));
  files.set(phpConfig, exportEncoder.encode(exportDecoder.decode(files.get(phpConfig)).replace('__TP_EXPORT_PEPPER_B64__', pepper)));
  files.set('dados-da-loja.sql', exportEncoder.encode(mysqlDump(results)));
  let total = [...files.values()].reduce((sum, bytes) => sum + bytes.length, 0);
  if (total > exportLimit) throw new InputError('O banco ultrapassa o limite de tamanho do pacote.', 413);

  const media = results[exportTables.indexOf('service_media')].results.filter((item) => item.status === 'ready');
  for (const item of media) {
    if (item.size > portableMediaLimit) throw new InputError('Existe um anexo acima de 8 MB. A ProFreeHost exige uma migração separada para esse arquivo.', 409);
    if (total + item.size > exportLimit) throw new InputError('Os anexos ultrapassam o limite de tamanho do pacote.', 413);
    const order = identifier(item.order_id);
    const id = identifier(item.id);
    const object = await env.BUCKET.get(mediaStorageKey(order, id));
    if (!object || object.size !== item.size) throw new InputError('Um anexo cadastrado está indisponível. Confira o armazenamento antes de migrar.', 409);
    files.set('htdocs/_tecnologia/anexos/' + order + '/' + id + '.bin', new Uint8Array(await object.arrayBuffer()));
    total += item.size;
  }

  if (env.BUCKET) {
    const prefix = 'backups/techplace/';
    let cursor;
    do {
      const page = await env.BUCKET.list({ prefix, cursor, limit: 100 });
      for (const item of page.objects) {
        const filename = item.key.slice(prefix.length);
        if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(filename)) continue;
        if (total + item.size > exportLimit) throw new InputError('O histórico de backups ultrapassa o limite de tamanho do pacote.', 413);
        const object = await env.BUCKET.get(item.key);
        if (!object) throw new InputError('Um backup está indisponível. Tente baixar novamente.', 409);
        files.set('historico-de-backups/' + filename, new Uint8Array(await object.arrayBuffer()));
        total += object.size;
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }

  return new Response(storedZip(files), { headers: {
    'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="tech-place-store-profreehost.zip"',
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'
  } });
}

async function handleProfreeExport(request, env, path) {
  if (request.method !== 'GET') throw new InputError('Método inválido.', 405);
  const owner = isExportOwner(request, env);
  if (path === '/exportar') return profreeExportPage(owner);
  if (!owner) throw new InputError('Entre com a conta proprietária para baixar o pacote.', 403);
  if (path === profreeSqlPath) {
    const sql = exportEncoder.encode(mysqlDump(await readExportTables(env.DB)));
    if (sql.length > exportLimit) throw new InputError('O banco ultrapassa o limite de tamanho da exportação.', 413);
    return new Response(sql, { headers: {
      'Content-Type': 'application/sql', 'Content-Disposition': 'attachment; filename="tech-place-store.sql"',
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'
    } });
  }
  return profreeDownload(env);
}
