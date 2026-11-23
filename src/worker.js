const assets = /* BUILT_ASSETS */ {};
const topics = new Set(/* BUILT_KNOWLEDGE_TOPICS */ []);
const types = ['in', 'out'];
const serviceStatuses = ['open', 'working', 'done', 'canceled'];
const currencyLimit = 99999999999;
const revisionQuery = 'SELECT version FROM shop_revision WHERE id=1';

async function write(db, ...statements) {
  const [result] = await db.batch([
    ...statements, db.prepare('UPDATE shop_revision SET version=version+1 WHERE id=1')
  ]);
  return result;
}

class InputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: {
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ...headers
  } });
}

function field(data, key, label, limit, required = false) {
  const value = typeof data[key] === 'string' ? data[key].trim() : '';
  if ((required && !value) || value.length > limit) throw new InputError('Confira o campo ' + label + '.');
  return value;
}

function integer(data, key, label, limit, minimum = 0) {
  const value = data[key];
  if (!Number.isSafeInteger(value) || value < minimum || value > limit) {
    throw new InputError('Informe um valor válido para ' + label + '.');
  }
  return value;
}

function identifier(value) {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) throw new InputError('Identificador inválido.');
  return value;
}

function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new InputError('Informe uma data válida.');
  const parsed = new Date(value + 'T12:00:00Z');
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value || value < '1900-01-01') {
    throw new InputError('Informe uma data válida.');
  }
  return value;
}

function matchDateRange(start, end) {
  if (start > end) throw new InputError('A data final deve ser igual ou posterior à inicial.');
}

function productFields(data) {
  return [
    field(data, 'code', 'código', 45, true),
    field(data, 'name', 'nome', 100, true),
    field(data, 'category', 'categoria', 60, true),
    field(data, 'supplier', 'fornecedor', 100),
    field(data, 'unit', 'unidade', 20, true),
    integer(data, 'min_qty', 'estoque mínimo', 100000000),
    integer(data, 'cost', 'custo unitário', currencyLimit),
    integer(data, 'price', 'preço de venda', currencyLimit),
    field(data, 'notes', 'observações', 500)
  ];
}

function cashFields(data) {
  if (!types.includes(data.kind)) throw new InputError('Escolha entrada ou saída.');
  return [
    data.kind,
    integer(data, 'amount', 'valor', currencyLimit, 1),
    date(data.day),
    field(data, 'description', 'descrição', 120, true),
    field(data, 'category', 'categoria', 60, true),
    field(data, 'payment', 'forma de pagamento', 40, true),
    field(data, 'contact', 'cliente ou fornecedor', 100),
    field(data, 'reference', 'número do documento', 70),
    field(data, 'notes', 'observações', 500)
  ];
}

function serviceFields(data) {
  if (!serviceStatuses.includes(data.status)) throw new InputError('Escolha a situação da ordem de serviço.');
  return [
    field(data, 'title', 'serviço', 120, true),
    field(data, 'customer', 'cliente', 100, true),
    field(data, 'phone', 'telefone', 32),
    data.status,
    data.due_day ? date(data.due_day) : null,
    data.amount === null ? null : integer(data, 'amount', 'valor', currencyLimit),
    field(data, 'notes', 'observações', 500)
  ];
}

function optionalSource(data) {
  const source = field(data, 'source_url', 'link da fonte', 350);
  if (!source) return '';
  let url;
  try { url = new URL(source); } catch { throw new InputError('Informe um link válido da fonte.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new InputError('Use um link HTTPS da fonte.');
  return source;
}

function knowledgeTopic(data) {
  if (!topics.has(data.topic)) throw new InputError('Escolha um assunto da base de conhecimento.');
  return data.topic;
}

function guideFields(data) {
  if (!['draft', 'published'].includes(data.status)) throw new InputError('Escolha a situação do guia.');
  const evidence = field(data, 'evidence', 'origem ou confirmação', 220, data.status === 'published');
  return [
    knowledgeTopic(data), field(data, 'title', 'título', 120, true),
    field(data, 'body', 'conteúdo', 3000, data.status === 'published'), evidence, optionalSource(data), data.status
  ];
}

async function knowledgeSummary(db) {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [guides, stats] = await db.batch([
    db.prepare('SELECT * FROM knowledge_guides WHERE deleted_at IS NULL ORDER BY updated_at DESC'),
    db.prepare(`SELECT e.topic, COUNT(*) total,
        SUM(CASE WHEN e.feedback='helpful' THEN 1 ELSE 0 END) helpful,
        SUM(CASE WHEN e.feedback='improve' AND COALESCE(e.feedback_at,e.created_at)>COALESCE(a.reviewed_at,'') THEN 1 ELSE 0 END) improvement,
        SUM(CASE WHEN (e.feedback='improve' OR (e.outcome='unanswered' AND COALESCE(e.feedback,'')<>'helpful'))
          AND COALESCE(e.feedback_at,e.created_at)>COALESCE(a.reviewed_at,'') THEN 1 ELSE 0 END) pending
      FROM knowledge_events e LEFT JOIN (
        SELECT topic, MAX(updated_at) AS reviewed_at FROM knowledge_guides WHERE status='published' AND deleted_at IS NULL GROUP BY topic
      ) a ON a.topic=e.topic WHERE e.created_at>=? GROUP BY e.topic`).bind(since)
  ]);
  return { guides: guides.results, stats: stats.results };
}

function filmFields(data) {
  const types = ['Vidro temperado', 'Vidro 3D', 'Vidro 3D de privacidade', 'Cerâmica', 'Cerâmica de privacidade', 'Hidrogel', 'Filme UV', 'TPU', 'Outro'];
  if (!types.includes(data.type)) throw new InputError('Escolha o tipo de película.');
  const models = [...new Set(field(data, 'models', 'modelos', 2800, true)
    .split(/\r?\n/).map((model) => model.trim()).filter(Boolean))];
  if (!models.length || models.length > 40 || models.some((model) => model.length > 75)) {
    throw new InputError('Informe até 40 modelos, um por linha, com até 75 caracteres por modelo.');
  }
  const source = optionalSource(data);
  return [
    field(data, 'label', 'nome da película', 120, true), data.type, JSON.stringify(models),
    data.product_id ? identifier(data.product_id) : null, source, field(data, 'notes', 'observações', 500)
  ];
}

const salePayments = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Boleto', 'Outro'];

async function readSales(db, url) {
  const selected = url.searchParams.get('id');
  const single = Boolean(selected);
  const args = single ? [identifier(selected)] : [date(url.searchParams.get('start')), date(url.searchParams.get('end'))];
  if (!single) matchDateRange(...args);
  const match = single ? 's.id=?' : 's.day BETWEEN ? AND ?';
  const [sales, items] = await db.batch([
    db.prepare('SELECT s.* FROM sales s WHERE s.finalized=1 AND ' + match + ' ORDER BY s.day DESC, s.number DESC').bind(...args),
    db.prepare('SELECT i.* FROM sale_items i JOIN sales s ON i.sale_id=s.id WHERE s.finalized=1 AND ' + match +
      ' ORDER BY i.name COLLATE NOCASE, i.code').bind(...args)
  ]);
  if (single && !sales.results.length) throw new InputError('Venda não encontrada.', 404);
  return { sales: sales.results, items: items.results };
}

async function createSale(db, data, id, actor, stamp) {
  if (await db.prepare('SELECT id FROM sales WHERE id=? AND finalized=1').bind(id).first()) return;
  if (!Array.isArray(data.items) || !data.items.length || data.items.length > 20) {
    throw new InputError('Selecione de 1 a 20 produtos na venda.');
  }
  const day = date(data.day);
  if (!salePayments.includes(data.payment)) throw new InputError('Escolha a forma de pagamento.');
  const customer = field(data, 'customer', 'cliente', 100);
  const notes = field(data, 'notes', 'observações', 500);
  const lines = data.items.map((item) => {
    if (!item || typeof item !== 'object') throw new InputError('Confira os produtos da venda.');
    return {
      product: identifier(item.product_id),
      qty: integer(item, 'qty', 'quantidade', 100000000, 1),
      unitCost: integer(item, 'unit_cost', 'custo unitário da venda', currencyLimit),
      unitPrice: integer(item, 'unit_price', 'preço unitário da venda', currencyLimit)
    };
  });
  if (new Set(lines.map((line) => line.product)).size !== lines.length) {
    throw new InputError('Some as quantidades de cada produto em uma única linha.');
  }
  const amount = lines.reduce((total, line) => total + line.qty * line.unitPrice, 0);
  const cost = lines.reduce((total, line) => total + line.qty * line.unitCost, 0);
  if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(cost) || amount < 1 || amount > currencyLimit || cost > currencyLimit) {
    throw new InputError('Informe um total de venda positivo e confira o limite dos valores.');
  }
  const placeholders = lines.map(() => '?').join(',');
  const count = await db.prepare('SELECT COUNT(*) AS count FROM products WHERE deleted_at IS NULL AND id IN (' + placeholders + ')')
    .bind(...lines.map((line) => line.product)).first();
  if (count?.count !== lines.length) throw new InputError('Um dos produtos não está disponível.', 404);
  const statements = [db.prepare(`INSERT INTO sales (id, day, payment, customer, notes, amount, cost, actor, created_at)
    VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`).bind(id, day, data.payment, customer, notes, amount, cost, actor, stamp)];
  for (const line of lines) {
    statements.push(db.prepare(`INSERT INTO sale_items (sale_id,product_id,code,name,unit,qty,unit_cost,unit_price)
      SELECT s.id,p.id,p.code,p.name,p.unit,?,?,? FROM products p JOIN sales s ON s.id=?
      WHERE p.id=? AND p.deleted_at IS NULL AND s.finalized=0`).bind(line.qty, line.unitCost, line.unitPrice, id, line.product));
  }
  statements.push(
    db.prepare(`UPDATE products SET qty=qty-(SELECT qty FROM sale_items WHERE sale_id=? AND product_id=products.id), updated_at=?
      WHERE id IN (SELECT i.product_id FROM sale_items i JOIN sales s ON s.id=i.sale_id WHERE s.id=? AND s.finalized=0)`)
      .bind(id, stamp, id),
    db.prepare(`INSERT INTO stock_moves (id,product_id,delta,reason,notes,actor,created_at)
      SELECT s.id || ':' || i.product_id,i.product_id,-i.qty,'Venda','Venda #' || printf('%04d', s.number),s.actor,s.created_at
      FROM sale_items i JOIN sales s ON s.id=i.sale_id WHERE s.id=? AND s.finalized=0`).bind(id),
    db.prepare(`INSERT INTO cash_entries
      (id,kind,amount,day,description,category,payment,contact,reference,notes,actor,created_at,updated_by,updated_at,revision,sale_id)
      SELECT id,'in',amount,day,'Venda #' || printf('%04d', number) || ' · ' ||
        CASE WHEN ?=1 THEN (SELECT name FROM sale_items WHERE sale_id=sales.id LIMIT 1) ELSE ? END,
        'Venda de produto',payment,customer,'Venda #' || printf('%04d', number),notes,actor,created_at,actor,created_at,id,id
        FROM sales WHERE id=? AND finalized=0`).bind(lines.length, lines.length + ' produtos', id),
    db.prepare(`UPDATE sales SET finalized=CASE
      WHEN (SELECT COUNT(*) FROM sale_items WHERE sale_id=sales.id)=? THEN 1 ELSE 2 END
      WHERE id=? AND finalized=0`).bind(lines.length, id)
  );
  await write(db, ...statements);
}

async function voidSale(db, data, id, actor, stamp) {
  const sale = await db.prepare('SELECT id, voided_at FROM sales WHERE id=? AND finalized=1').bind(id).first();
  if (!sale) throw new InputError('Venda não encontrada.', 404);
  if (sale.voided_at) return;
  const reason = field(data, 'reason', 'motivo do estorno', 120, true);
  const statements = [
    db.prepare(`UPDATE products SET qty=qty+(SELECT qty FROM sale_items WHERE sale_id=? AND product_id=products.id), updated_at=?
      WHERE id IN (SELECT i.product_id FROM sale_items i JOIN sales s ON s.id=i.sale_id WHERE s.id=? AND s.voided_at IS NULL)`)
      .bind(id, stamp, id),
    db.prepare(`INSERT INTO stock_moves (id,product_id,delta,reason,notes,actor,created_at)
      SELECT s.id || ':void:' || i.product_id,i.product_id,i.qty,'Estorno de venda',
        'Venda #' || printf('%04d', s.number) || ' · ' || ?,?,? FROM sale_items i JOIN sales s ON s.id=i.sale_id
      WHERE s.id=? AND s.voided_at IS NULL`).bind(reason, actor, stamp, id),
    db.prepare(`UPDATE cash_entries SET voided_at=?, updated_by=?, updated_at=?, revision=?
      WHERE sale_id=? AND voided_at IS NULL`).bind(stamp, actor, stamp, crypto.randomUUID(), id),
    db.prepare('UPDATE sales SET voided_at=?, voided_by=?, void_reason=? WHERE id=? AND voided_at IS NULL').bind(stamp, actor, reason, id)
  ];
  await write(db, ...statements);
}

async function ensureManualCash(db, id) {
  const row = await db.prepare('SELECT sale_id FROM cash_entries WHERE id=?').bind(id).first();
  if (row?.sale_id) throw new InputError('Use a aba Vendas para estornar este lançamento vinculado.', 409);
}

async function summary(db, url) {
  const start = date(url.searchParams.get('start'));
  const end = date(url.searchParams.get('end'));
  matchDateRange(start, end);
  const [products, movements, cash, orders, films, sales, revision] = await db.batch([
    db.prepare('SELECT * FROM products WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE, code'),
    db.prepare(`SELECT m.*, p.name, p.code, p.unit
      FROM stock_moves m JOIN products p ON p.id=m.product_id
      ORDER BY m.created_at DESC LIMIT 300`),
    db.prepare('SELECT * FROM cash_entries WHERE day BETWEEN ? AND ? ORDER BY day DESC, created_at DESC').bind(start, end),
    db.prepare(`SELECT o.*, (SELECT COUNT(*) FROM service_media m WHERE m.order_id=o.id AND m.status='ready'
      AND m.deleted_at IS NULL) AS media_count FROM service_orders o WHERE o.deleted_at IS NULL ORDER BY o.number DESC`),
    db.prepare('SELECT * FROM film_families WHERE deleted_at IS NULL ORDER BY label COLLATE NOCASE'),
    db.prepare(`SELECT COUNT(*) count, COALESCE(SUM(amount),0) amount, COALESCE(SUM(cost),0) cost
      FROM sales WHERE finalized=1 AND voided_at IS NULL AND day BETWEEN ? AND ?`).bind(start, end),
    db.prepare(revisionQuery)
  ]);
  return { version: revision.results[0].version, products: products.results, movements: movements.results, cash: cash.results, orders: orders.results, salesSummary: sales.results[0], films: films.results.map((film) => ({ ...film, models: JSON.parse(film.models) })) };
}

async function savedUpdate(statement, db, table, id, expectedRevision) {
  const result = await write(db, statement);
  if (result.meta.changes) return;
  const row = await db.prepare('SELECT revision FROM ' + table + ' WHERE id=?').bind(id).first();
  if (row?.revision === expectedRevision) return;
  throw new InputError('O registro mudou. Atualize o painel e tente novamente.', 409);
}

const deletable = {
  'product-delete': 'products',
  'service-delete': 'service_orders',
  'film-delete': 'film_families',
  'guide-delete': 'knowledge_guides'
};

async function save(db, data, actor) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new InputError('Dados inválidos.');
  const id = identifier(data.id);
  const stamp = new Date().toISOString();
  if (Object.hasOwn(deletable, data.action)) {
    const table = deletable[data.action];
    const revision = identifier(data.operation);
    await savedUpdate(db.prepare('UPDATE ' + table +
      ' SET deleted_at=?, updated_at=?, revision=? WHERE id=? AND revision=? AND deleted_at IS NULL')
      .bind(stamp, stamp, revision, id, identifier(data.revision)), db, table, id, revision);
    return;
  }
  switch (data.action) {
    case 'sale-add': await createSale(db, data, id, actor, stamp); return;
    case 'sale-void': await voidSale(db, data, id, actor, stamp); return;
    case 'product-add': {
      const qty = integer(data, 'qty', 'estoque inicial', 100000000);
      const statements = [db.prepare(`INSERT INTO products
        (id, code, name, category, supplier, unit, min_qty, cost, price, notes, qty, revision, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`).bind(id, ...productFields(data), qty, id, stamp)];
      if (qty) statements.push(db.prepare(`INSERT INTO stock_moves
        (id, product_id, delta, reason, notes, actor, created_at)
        VALUES (?,?,?,'Saldo inicial','',?,?) ON CONFLICT(id) DO NOTHING`).bind(id, id, qty, actor, stamp));
      await write(db, ...statements);
      return;
    }
    case 'product-edit': {
      const revision = identifier(data.operation);
      await savedUpdate(db.prepare(`UPDATE products SET code=?, name=?, category=?, supplier=?, unit=?, min_qty=?,
        cost=?, price=?, notes=?, revision=?, updated_at=? WHERE id=? AND revision=? AND deleted_at IS NULL`)
        .bind(...productFields(data), revision, stamp, id, identifier(data.revision)), db, 'products', id, revision);
      return;
    }
    case 'stock-move': {
      const product = identifier(data.product_id);
      if (!types.includes(data.kind)) throw new InputError('Escolha entrada ou saída.');
      const qty = integer(data, 'qty', 'quantidade', 100000000, 1);
      const delta = data.kind === 'out' ? -qty : qty;
      const reason = field(data, 'reason', 'motivo', 80, true);
      const notes = field(data, 'notes', 'observações', 500);
      const result = await write(db,
        db.prepare(`UPDATE products SET qty=qty+?, updated_at=?
          WHERE id=? AND deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM stock_moves WHERE id=?)`).bind(delta, stamp, product, id),
        db.prepare(`INSERT INTO stock_moves (id, product_id, delta, reason, notes, actor, created_at)
          SELECT ?,id,?,?,?,?,? FROM products WHERE id=? AND deleted_at IS NULL
          ON CONFLICT(id) DO NOTHING`).bind(id, delta, reason, notes, actor, stamp, product)
      );
      if (!result.meta.changes && !await db.prepare('SELECT id FROM stock_moves WHERE id=? AND product_id=?').bind(id, product).first()) {
        throw new InputError('Produto não encontrado.', 404);
      }
      return;
    }
    case 'cash-add':
      await write(db, db.prepare(`INSERT INTO cash_entries
        (id, kind, amount, day, description, category, payment, contact, reference, notes, actor,
        created_at, updated_by, updated_at, revision)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`)
        .bind(id, ...cashFields(data), actor, stamp, actor, stamp, id));
      return;
    case 'cash-edit': {
      await ensureManualCash(db, id);
      const revision = identifier(data.operation);
      await savedUpdate(db.prepare(`UPDATE cash_entries SET kind=?, amount=?, day=?, description=?, category=?,
        payment=?, contact=?, reference=?, notes=?, updated_by=?, updated_at=?, revision=?
        WHERE id=? AND revision=? AND voided_at IS NULL`)
        .bind(...cashFields(data), actor, stamp, revision, id, identifier(data.revision)), db, 'cash_entries', id, revision);
      return;
    }
    case 'knowledge-event':
      if (!['guide', 'records', 'draft', 'unanswered'].includes(data.outcome)) throw new InputError('Resultado inválido.');
      await write(db, db.prepare(`INSERT INTO knowledge_events (id, topic, outcome, created_at)
        VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING`).bind(id, knowledgeTopic(data), data.outcome, stamp));
      return;
    case 'knowledge-feedback':
      if (!['helpful', 'improve'].includes(data.feedback)) throw new InputError('Avaliação inválida.');
      {
        const result = await write(db, db.prepare('UPDATE knowledge_events SET feedback=?, feedback_at=? WHERE id=?').bind(data.feedback, stamp, id));
        if (!result.meta.changes) throw new InputError('Consulta não encontrada.', 404);
      }
      return;
    case 'guide-add':
      await write(db, db.prepare(`INSERT INTO knowledge_guides
        (id, topic, title, body, evidence, source_url, status, actor, updated_at, revision)
        VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`)
        .bind(id, ...guideFields(data), actor, stamp, id));
      return;
    case 'guide-edit': {
      const revision = identifier(data.operation);
      await savedUpdate(db.prepare(`UPDATE knowledge_guides SET topic=?, title=?, body=?, evidence=?,
        source_url=?, status=?, actor=?, updated_at=?, revision=? WHERE id=? AND revision=? AND deleted_at IS NULL`)
        .bind(...guideFields(data), actor, stamp, revision, id, identifier(data.revision)), db, 'knowledge_guides', id, revision);
      return;
    }
    case 'film-add':
      await write(db, db.prepare(`INSERT INTO film_families
        (id, label, type, models, product_id, source_url, notes, actor, updated_at, revision)
        VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`)
        .bind(id, ...filmFields(data), actor, stamp, id));
      return;
    case 'film-edit': {
      const revision = identifier(data.operation);
      await savedUpdate(db.prepare(`UPDATE film_families SET label=?, type=?, models=?, product_id=?, source_url=?,
        notes=?, actor=?, updated_at=?, revision=? WHERE id=? AND revision=? AND deleted_at IS NULL`)
        .bind(...filmFields(data), actor, stamp, revision, id, identifier(data.revision)), db, 'film_families', id, revision);
      return;
    }
    case 'service-add':
      await write(db, db.prepare(`INSERT INTO service_orders
        (id, title, customer, phone, status, due_day, amount, notes, actor, created_at, updated_by, updated_at, revision)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`)
        .bind(id, ...serviceFields(data), actor, stamp, actor, stamp, id));
      return;
    case 'service-edit': {
      const revision = identifier(data.operation);
      await savedUpdate(db.prepare(`UPDATE service_orders SET title=?, customer=?, phone=?, status=?, due_day=?,
        amount=?, notes=?, updated_by=?, updated_at=?, revision=? WHERE id=? AND revision=? AND deleted_at IS NULL`)
        .bind(...serviceFields(data), actor, stamp, revision, id, identifier(data.revision)), db, 'service_orders', id, revision);
      return;
    }
    case 'cash-void': {
      await ensureManualCash(db, id);
      const revision = identifier(data.operation);
      await savedUpdate(db.prepare(`UPDATE cash_entries SET voided_at=?, updated_by=?, updated_at=?, revision=?
        WHERE id=? AND revision=? AND voided_at IS NULL`)
        .bind(stamp, actor, stamp, revision, id, identifier(data.revision)), db, 'cash_entries', id, revision);
      return;
    }
    default:
      throw new InputError('Operação inválida.');
  }
}

const mediaTypes = {
  'image/jpeg': 12, 'image/png': 12, 'image/webp': 12, 'image/heic': 12, 'image/heif': 12,
  'video/mp4': 50, 'video/webm': 50, 'video/quicktime': 50
};
const mediaLimit = 20;

function mediaMatches(bytes, type) {
  const picture = String.fromCharCode(...bytes.slice(0, 12));
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === 'image/png') return picture.startsWith('\x89PNG\r\n\x1a\n');
  if (type === 'image/webp') return picture.startsWith('RIFF') && picture.slice(8, 12) === 'WEBP';
  if (type === 'video/webm') return picture.startsWith('\x1a\x45\xdf\xa3');
  return picture.slice(4, 8) === 'ftyp';
}

async function mediaStream(request, type) {
  if (!request.body) throw new InputError('Arquivo vazio.');
  const [check, stream] = request.body.tee();
  const reader = check.getReader();
  const bytes = new Uint8Array(12);
  let offset = 0;
  try {
    while (offset < bytes.length) {
      const chunk = await reader.read();
      if (chunk.done) break;
      const head = chunk.value.subarray(0, bytes.length - offset);
      bytes.set(head, offset);
      offset += head.length;
    }
  } finally {
    void reader.cancel().catch(() => {});
  }
  if (!mediaMatches(bytes.subarray(0, offset), type)) {
    void stream.cancel().catch(() => {});
    throw new InputError('O conteúdo do arquivo não corresponde ao formato selecionado.', 415);
  }
  return stream;
}

function attachmentRange(header, size) {
  if (!header) return null;
  const match = header.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || !match[1] && !match[2]) return false;
  if (!match[1]) {
    const length = Math.min(size, Number(match[2]));
    return length > 0 ? { offset: size - length, length } : false;
  }
  const offset = Number(match[1]);
  const end = match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  return offset < size && end >= offset ? { offset, length: end - offset + 1 } : false;
}

function mediaStorageKey(order, id) {
  return 'orders/' + order + '/' + id;
}

async function uploadMedia(request, env, order, id, actor) {
  const type = request.headers.get('content-type')?.split(';')[0];
  if (!Object.hasOwn(mediaTypes, type)) throw new InputError('Escolha uma foto ou um vídeo em formato compatível.', 415);
  const stated = request.headers.get('x-file-size');
  const length = request.headers.get('content-length');
  const size = Number(length ?? stated);
  if (length != null && stated != null && Number(length) !== Number(stated)) throw new InputError('O tamanho do arquivo não confere.');
  if (!Number.isSafeInteger(size) || size < 1 || size > mediaTypes[type] * 1048576) {
    throw new InputError('O limite é de ' + mediaTypes[type] + ' MB por arquivo desse tipo.', 413);
  }
  let name;
  try { name = decodeURIComponent(request.headers.get('x-file-name') || '').trim(); } catch { name = ''; }
  if (!name || name.length > 180 || /[\x00-\x1f\x7f/\\]/.test(name)) throw new InputError('Informe um nome de arquivo válido.');
  const db = env.DB;
  const lookup = db.prepare('SELECT * FROM service_media WHERE id=? AND order_id=?').bind(id, order);
  const previous = await lookup.first();
  if (previous && (previous.type !== type || previous.size !== size || previous.name !== name)) {
    throw new InputError('O arquivo já foi reservado com outros dados. Selecione-o novamente.', 409);
  }
  if (previous?.deleted_at) throw new InputError('O anexo foi removido. Selecione o arquivo novamente.', 409);
  if (previous?.status === 'ready') return json({ ok: true }, 200);
  const stream = await mediaStream(request, type);
  try {
    if (!previous) {
      const now = new Date();
      const fresh = new Date(now.getTime() - 86400000).toISOString();
      await db.prepare(`INSERT INTO service_media (id,order_id,name,type,size,actor,created_at,status)
        SELECT ?,?,?,?,?,?,?,'pending' WHERE EXISTS (SELECT 1 FROM service_orders WHERE id=? AND deleted_at IS NULL)
        AND (SELECT COUNT(*) FROM service_media
          WHERE order_id=? AND deleted_at IS NULL AND (status='ready' OR created_at>=?)) < ? ON CONFLICT(id) DO NOTHING`)
        .bind(id, order, name, type, size, actor, now.toISOString(), order, order, fresh, mediaLimit).run();
      const reserved = await lookup.first();
      if (!reserved) throw new InputError('Cada ordem pode ter até ' + mediaLimit + ' anexos.', 409);
      if (reserved.type !== type || reserved.size !== size || reserved.name !== name) {
        throw new InputError('O arquivo já foi reservado com outros dados. Selecione-o novamente.', 409);
      }
      if (reserved.deleted_at) throw new InputError('O anexo foi removido. Selecione o arquivo novamente.', 409);
      if (reserved.status === 'ready') return json({ ok: true });
    }
    const key = mediaStorageKey(order, id);
    const meta = { httpMetadata: { contentType: type } };
    if (typeof FixedLengthStream === 'function') {
      const exact = new FixedLengthStream(size);
      await Promise.all([env.BUCKET.put(key, exact.readable, meta), stream.pipeTo(exact.writable)]);
    } else {
      const data = new Uint8Array(size);
      const reader = stream.getReader();
      let offset = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          if (offset + chunk.value.length > size) throw new InputError('O tamanho do arquivo não confere.');
          data.set(chunk.value, offset);
          offset += chunk.value.length;
        }
      } finally {
        await reader.cancel();
      }
      if (offset !== size) throw new InputError('O arquivo chegou incompleto.');
      await env.BUCKET.put(key, data, meta);
    }
    await write(db, db.prepare("UPDATE service_media SET status='ready' WHERE id=? AND order_id=? AND deleted_at IS NULL").bind(id, order));
    return json({ ok: true }, 201);
  } finally {
    if (!stream.locked) void stream.cancel().catch(() => {});
  }
}

async function handleMedia(request, url, env, match, actor) {
  const order = identifier(match[1]);
  const id = match[2] && identifier(match[2]);
  const read = request.method === 'GET' || request.method === 'HEAD';
  if (!read && request.headers.get('origin') !== url.origin) throw new InputError('Origem inválida.', 403);
  if (!await env.DB.prepare('SELECT id FROM service_orders WHERE id=? AND deleted_at IS NULL').bind(order).first()) {
    throw new InputError('Ordem de serviço não encontrada.', 404);
  }
  if (!id && request.method === 'GET') {
    const [list] = await env.DB.batch([env.DB.prepare(`SELECT id,name,type,size,actor,created_at FROM service_media
      WHERE order_id=? AND status='ready' AND deleted_at IS NULL ORDER BY created_at DESC, id`).bind(order)]);
    return json({ media: list.results });
  }
  if (!id) return json({ error: 'Método inválido.' }, 405);
  if (!env.BUCKET) throw new InputError('O armazenamento de anexos está indisponível.', 503);
  if (!read) await ensureDailyBackup(env);
  if (request.method === 'PUT') return uploadMedia(request, env, order, id, actor);
  const record = await env.DB.prepare("SELECT * FROM service_media WHERE id=? AND order_id=? AND status='ready' AND deleted_at IS NULL").bind(id, order).first();
  if (!record) {
    if (request.method === 'DELETE') return json({ ok: true });
    throw new InputError('Anexo não encontrado.', 404);
  }
  const key = mediaStorageKey(order, id);
  if (request.method === 'DELETE') {
    await write(env.DB, env.DB.prepare('UPDATE service_media SET deleted_at=? WHERE id=? AND order_id=? AND deleted_at IS NULL')
      .bind(new Date().toISOString(), id, order));
    return json({ ok: true });
  }
  if (!read) return json({ error: 'Método inválido.' }, 405);
  const range = attachmentRange(request.headers.get('range'), record.size);
  if (range === false) {
    return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + record.size, 'Cache-Control': 'private, no-store' } });
  }
  const headers = {
    'Content-Type': record.type, 'Content-Length': String(range?.length ?? record.size),
    'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': (url.searchParams.has('download') ? 'attachment' : 'inline') +
      "; filename*=UTF-8''" + encodeURIComponent(record.name).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16))
  };
  if (range) headers['Content-Range'] = 'bytes ' + range.offset + '-' + (range.offset + range.length - 1) + '/' + record.size;
  if (request.method === 'HEAD') return new Response(null, { status: range ? 206 : 200, headers });
  const object = await env.BUCKET.get(key, range ? { range } : {});
  if (!object) throw new InputError('Anexo não encontrado no armazenamento.', 404);
  return new Response(object.body, { status: range ? 206 : 200, headers });
}

/* BACKUP_WORKER */
/* AUTH_WORKER */
/* PARTS_WORKER */
/* MIGRATION_EXPORT */

function serveAsset(path, { privateAsset, head }) {
  const [body, type, binary] = assets[path];
  const data = head ? null : binary ? Uint8Array.from(atob(body), (character) => character.charCodeAt(0)) : body;
  return new Response(data, { headers: {
    'Content-Type': type + (binary ? '' : '; charset=utf-8'),
    'Cache-Control': privateAsset ? 'private, no-store' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self' https://chatgpt.com https://chat.openai.com"
  } });
}

const privateAssets = new Set(['/parts-catalog.json', '/film-catalog.json']);
const apiPaths = new Set(['/api/acesso', '/api/alteracoes', '/api/loja', '/api/conhecimento', '/api/vendas', '/api/precos']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === '/favicon.ico') return new Response(null, { status: 204 });
    const exportPath = profreeExportPaths.has(path);
    const privateAsset = privateAssets.has(path);
    const head = request.method === 'HEAD';
    const readAsset = request.method === 'GET' || head;
    if (!privateAsset && Object.hasOwn(assets, path) && readAsset) return serveAsset(path, { head });
    const mediaMatch = path.match(/^\/api\/ordens\/([a-fA-F0-9-]{36})\/midia(?:\/([a-fA-F0-9-]{36}))?$/);
    if (!exportPath && !mediaMatch && !privateAsset && !apiPaths.has(path)) return json({ error: 'Página não encontrada.' }, 404);
    try {
      if (exportPath) return await handleProfreeExport(request, env, path);
      if (path === '/api/acesso') return await handleAccess(request, url, env);
      const identity = await accessIdentity(request, env);
      if (!identity) return json({ error: 'Entre com sua conta para acessar a loja.' }, 401);
      const actor = identity.name;
      if (privateAsset) return readAsset ? serveAsset(path, { privateAsset, head }) : json({ error: 'Método inválido.' }, 405);
      if (mediaMatch) return await handleMedia(request, url, env, mediaMatch, actor);
      if (path === '/api/precos') return await handlePartPrices(request, url, env, actor);
      if (request.method === 'GET') {
        if (url.pathname === '/api/alteracoes') return json(await env.DB.prepare(revisionQuery).first());
        if (url.pathname === '/api/conhecimento') return json(await knowledgeSummary(env.DB));
        if (url.pathname === '/api/vendas') return json(await readSales(env.DB, url));
        const data = await summary(env.DB, url);
        const backupDay = await ensureDailyBackup(env);
        return json(data, 200, backupDay ? { 'X-Techplace-Backup-Day': backupDay } : {});
      }
      if (url.pathname !== '/api/loja') return json({ error: 'Método inválido.' }, 405);
      if (request.method !== 'POST') return json({ error: 'Método inválido.' }, 405);
      if (request.headers.get('origin') !== url.origin) return json({ error: 'Origem inválida.' }, 403);
      if (!(request.headers.get('content-type') || '').includes('application/json')) {
        return json({ error: 'Formato de dados inválido.' }, 415);
      }
      const body = await request.text();
      if (body.length > 12000) return json({ error: 'Dados muito longos.' }, 413);
      let data;
      try { data = JSON.parse(body); } catch { throw new InputError('Formato de dados inválido.'); }
      await ensureDailyBackup(env);
      await save(env.DB, data, actor);
      return json({ ok: true });
    } catch (error) {
      if (error instanceof InputError) return json({ error: error.message }, error.status);
      const detail = String(error) + ' ' + String(error.cause || '');
      if (/UNIQUE constraint failed: products.code/i.test(detail)) return json({ error: 'Já existe um produto com esse código.' }, 409);
      if (/FOREIGN KEY constraint failed/i.test(detail)) return json({ error: 'O produto vinculado não está disponível.' }, 409);
      if (/CHECK constraint failed: qty/i.test(detail)) return json({ error: 'Quantidade indisponível ou acima do limite de estoque.' }, 409);
      if (/CHECK constraint failed: finalized/i.test(detail)) return json({ error: 'Um produto foi removido. Atualize a seleção da venda.', }, 409);
      console.error('Loja database error', error?.name);
      return json({ error: 'Não foi possível consultar ou salvar os dados. Tente novamente.' }, 500);
    }
  }
};
