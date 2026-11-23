const backupTables = [
  'products', 'stock_moves', 'sales', 'sale_items', 'cash_entries',
  'service_orders', 'service_media', 'film_families', 'knowledge_guides', 'knowledge_events', 'shop_revision', 'part_prices'
];
const backupCalendar = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' });
const backedUpDays = new WeakMap();

async function ensureDailyBackup(env) {
  const day = backupCalendar.format(new Date());
  if (backedUpDays.get(env.BUCKET) === day) return day;
  const key = 'backups/techplace/' + day + '.json';
  try {
    if (!await env.BUCKET.head(key)) {
      // One D1 batch reads a consistent snapshot. Attachment bytes stay in the
      // private bucket even when their orders or metadata are marked deleted.
      const results = await env.DB.batch(backupTables.map((table) => env.DB.prepare('SELECT * FROM ' + table)));
      const tables = Object.fromEntries(backupTables.map((table, i) => [table, results[i].results]));
      await env.BUCKET.put(key, JSON.stringify({ version: 1, createdAt: new Date().toISOString(), tables }), {
        onlyIf: { etagDoesNotMatch: '*' },
        httpMetadata: { contentType: 'application/json' }
      });
    }
    backedUpDays.set(env.BUCKET, day);
    return day;
  } catch (error) {
    console.error('TECHPLACE: falha no backup diário', error?.name);
    return null;
  }
}
