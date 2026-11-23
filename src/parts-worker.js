const partCategories = ['Telas', 'Baterias', 'Conectores', 'Outras peças'];
const priceColumns = 'part_key, name, category, supplier, cost, service_price, revision';
const supplierCatalog = JSON.parse(assets['/parts-catalog.json'][0]);
const supplierNames = new Set(supplierCatalog.map((vendor) => vendor.name));
const catalogPartKeys = new Set(supplierCatalog.flatMap((vendor) => vendor.products.map((part) => part.href)));
const manualPartKey = /^manual:[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;

async function handlePartPrices(request, url, env, actor) {
  const db = env.DB;
  if (request.method === 'GET') {
    const result = await db.prepare('SELECT ' + priceColumns + ' FROM part_prices').all();
    return json({ prices: result.results, categories: partCategories });
  }
  if (request.method !== 'POST') return json({ error: 'Método inválido.' }, 405);
  const data = await accessPayload(request, url.origin);
  const key = field(data, 'part_key', 'peça', 500, true);
  const manual = manualPartKey.test(key);
  if (!manual && !catalogPartKeys.has(key)) throw new InputError('Peça não encontrada no catálogo.', 404);
  const expectedRevision = integer(data, 'revision', 'versão do preço', 2147483646);
  const cost = data.cost === null ? null : integer(data, 'cost', 'custo da peça', currencyLimit);
  const servicePrice = data.service_price === null ? null : integer(data, 'service_price', 'valor da troca', currencyLimit);
  const name = manual ? field(data, 'name', 'nome da peça', 160, true) : null;
  const category = manual ? data.category : null;
  const supplier = manual ? data.supplier : null;
  if (manual && (!partCategories.includes(category) || !supplierNames.has(supplier))) {
    throw new InputError('Escolha uma categoria e um fornecedor.');
  }
  const record = { part_key: key, name, category, supplier, cost, service_price: servicePrice, revision: expectedRevision + 1 };
  const values = [name, category, supplier, cost, servicePrice, record.revision, actor, new Date().toISOString()];
  const statement = expectedRevision ?
    db.prepare(`UPDATE part_prices SET name=?, category=?, supplier=?, cost=?, service_price=?, revision=?, updated_by=?, updated_at=?
      WHERE part_key=? AND revision=?`).bind(...values, key, expectedRevision) :
    db.prepare(`INSERT INTO part_prices (name,category,supplier,cost,service_price,revision,updated_by,updated_at,part_key)
      VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(part_key) DO NOTHING`).bind(...values, key);
  await ensureDailyBackup(env);
  const saved = await write(db, statement);
  if (!saved.meta.changes) {
    throw new InputError('Os valores desta peça mudaram. Reabra o preço para ver a última versão.', 409);
  }
  return json(record, expectedRevision ? 200 : 201);
}
