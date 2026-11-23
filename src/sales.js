export const saleNumber = (sale) => '#' + String(sale.number).padStart(4, '0');
export const saleMargin = (amount, cost) => amount ? (amount - cost) / amount : 0;

export function saleMetrics(records) {
  const active = records.sales.filter((sale) => !sale.voided_at);
  const ids = new Set(active.map((sale) => sale.id));
  const products = new Map();
  const payments = new Map();
  let amount = 0;
  let cost = 0;
  let units = 0;
  for (const sale of active) {
    amount += sale.amount;
    cost += sale.cost;
    const payment = payments.get(sale.payment) ?? { name: sale.payment, amount: 0, count: 0 };
    payment.amount += sale.amount;
    payment.count++;
    payments.set(sale.payment, payment);
  }
  for (const item of records.items) {
    if (!ids.has(item.sale_id)) continue;
    units += item.qty;
    const product = products.get(item.product_id) ?? { code: item.code, name: item.name, unit: item.unit, qty: 0, amount: 0, cost: 0 };
    product.qty += item.qty;
    product.amount += item.unit_price * item.qty;
    product.cost += item.unit_cost * item.qty;
    products.set(item.product_id, product);
  }
  return {
    amount, cost, units, profit: amount - cost, active, count: active.length,
    average: active.length ? Math.round(amount / active.length) : 0,
    products: [...products.values()].sort((a, b) => b.amount - a.amount),
    payments: [...payments.values()].sort((a, b) => b.amount - a.amount)
  };
}

export function saleCalendar(sales, start, end) {
  const day = 86400000;
  const beginning = Date.parse(start + 'T00:00:00Z');
  const days = Math.floor((Date.parse(end + 'T00:00:00Z') - beginning) / day) + 1;
  if (!Number.isFinite(days) || days < 1) return [];
  const step = Math.ceil(days / 7);
  const buckets = Array.from({ length: Math.ceil(days / step) }, (_, index) => ({
    day: new Date(beginning + index * step * day).toISOString().slice(0, 10), amount: 0, cost: 0
  }));
  for (const sale of sales) {
    const bucket = buckets[Math.floor((Date.parse(sale.day + 'T00:00:00Z') - beginning) / (step * day))];
    if (bucket) { bucket.amount += sale.amount; bucket.cost += sale.cost; }
  }
  return buckets;
}
