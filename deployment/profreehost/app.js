import { saleCalendar, saleMargin, saleMetrics, saleNumber } from '/sales.js';
import { featureIdeas, guideIdeas, knowledgeAreas, knowledgeTopics, prefersKnowledge, relevantGuides, starterGuides, topicForRequest } from '/knowledge.js';
import { buildFilmIndex, compatibleFilmGroups, filmModelKey, filmTypes, fold, lookupFilmModels, parsedFilmQuestion } from '/films.js';
import { assistantExamples, classifyShopRequest, extractCashInput, interpretRequest, monthPeriod, searchShopRecords } from '/assistant.js';
import { createPartsPricing } from '/parts-pricing.js';
import { startSession } from '/session.js';
import { createUniversalAgent } from '/universal-agent.js';

const paths = {
  trash: '<path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  cart: '<path d="M3 4h2l2.5 10.5h10L21 7H6m3 13h.01m8 0h.01"/><circle cx="9" cy="19" r="1"/><circle cx="17" cy="19" r="1"/>',
  percent: '<path d="m5 19 14-14"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  book: '<path d="M12 6c-2-2-5-3-9-2v14c4-1 7 0 9 2 2-2 5-3 9-2V4c-4-1-7 0-9 2Zm0 0v14M6 8h3m6 0h3"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10 5.5h4m-2 13h.01"/>',
  store: '<path d="M3 9l2-5h14l2 5v2a2 2 0 0 1-4 0 2 2 0 0 1-4 0 2 2 0 0 1-4 0 2 2 0 0 1-4 0 2 2 0 0 1-2-2zM5 13v7h14v-7m-9 7v-5h4v5"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M10 9v12"/>',
  box: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 18v-9m-8-4.5 8 4.5 8-4.5M8 5.3l8 4.5"/>',
  wallet: '<path d="M20 8V6a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h13a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a3 3 0 0 1-3-3V7m18 7h-4m0 0h.01"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14-5L4 8m0-4v4h4m-4 5a8 8 0 0 0 14 5l2-2m0 4v-4h-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  trend: '<path d="M4 18h16M7 14l4-4 3 3 5-6m-4 0h4v4"/>',
  down: '<path d="M12 4v13m-5-5 5 5 5-5M5 21h14"/>',
  up: '<path d="M12 20V7m-5 5 5-5 5 5M5 3h14"/>',
  alert: '<path d="m10.4 4.8-7.3 13A1.5 1.5 0 0 0 4.4 20h15.2a1.5 1.5 0 0 0 1.3-2.2l-7.3-13a1.8 1.8 0 0 0-3.2 0ZM12 9v4m0 3.5h.01"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
  receipt: '<path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Zm4 5h6m-6 4h6"/>',
  search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
  swap: '<path d="M4 8h15l-3-3m4 11H5l3 3"/>',
  clipboard: '<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 3h6v5H9zM9 12h6m-6 4h6"/>',
  sparkles: '<path d="M10 2l2.3 6.7L19 11l-6.7 2.3L10 20l-2.3-6.7L1 11l6.7-2.3L10 2Zm9 12v7m-3.5-3.5h7M19 2v5m-2.5-2.5h5"/>',
  mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11v1a7 7 0 0 0 14 0v-1m-7 8v3m-4 0h8"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>'
};

const icon = (name) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[name] + '</svg>';
const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const number = (n) => new Intl.NumberFormat('pt-BR').format(n);
const shortDay = (day) => day.split('-').slice(1).reverse().join('/');
const displayDay = (day) => day.split('-').reverse().join('/');
const dateFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
const displayTime = (value) => dateFormat.format(new Date(value));
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const monthStart = today.slice(0, 7) + '-01';
const [year, month] = today.split('-').map(Number);
const monthEnd = today.slice(0, 7) + '-' + new Date(Date.UTC(year, month, 0)).getUTCDate();
const monthName = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', month: 'long', year: 'numeric' }).format(new Date());
const labels = { inicio: 'Início', estoque: 'Estoque', vendas: 'Vendas', caixa: 'Fluxo de caixa', servicos: 'Ordens de serviço', precos: 'Preços de peças', peliculas: 'Películas', conhecimento: 'Conhecimento', assistente: 'Assistente', agente: 'Agente Universal' };
const types = { in: 'Entrada', out: 'Saída' };
const payments = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Boleto', 'Outro'];
const units = ['un', 'cx', 'pct', 'par', 'kg', 'L', 'm'];
const state = {
  page: 'inicio', stockTab: 'products', productSearch: '', productCategory: '', productStatus: '',
  salesStart: monthStart, salesEnd: monthEnd, sales: { sales: [], items: [] }, salesReady: false, salesError: '',
  saleSearch: '', saleStatus: 'all', salesSummary: { amount: 0, cost: 0, count: 0 },
  cashSearch: '', cashType: '', cashStatus: 'active', start: monthStart, end: monthEnd,
  products: [], movements: [], cash: [], orders: [], films: [], ready: false,
  orderSearch: '', orderStatus: '', knowledgeSearch: '', knowledgeArea: '', knowledgeStatus: 'published', filmQuery: '', filmCompare: '', filmBrand: '', filmType: '', filmStore: false, assistantMode: 'auto', assistantText: '', assistantBusy: false
};

const content = document.querySelector('#content');
const dialog = document.querySelector('#dialog');
const errorBox = document.querySelector('#error');
const toast = document.querySelector('#toast');
const mobileMenu = document.querySelector('#mobile-menu');
const primaryNav = document.querySelector('#primary-nav');
const syncStatus = document.querySelector('#sync-status');
let partsPricing;
let signedIn = false;
const universalAgent = createUniversalAgent({ request, notify });

function setMobileMenu(open) {
  mobileMenu.setAttribute('aria-expanded', String(open));
  primaryNav.closest('.sidebar').dataset.menu = open ? 'open' : 'closed';
}
let toastTimer;
let loadCount = 0;

for (const el of document.querySelectorAll('[data-icon]')) el.innerHTML = icon(el.dataset.icon);

function button(text, opts = {}) {
  const { symbol, action, id, style = '', disabled = false, type = 'button' } = opts;
  return '<button class="btn ' + style + '" type="' + type + '"' + (action ? ' data-action="' + action + '"' : '') +
    (id ? ' data-id="' + esc(id) + '"' : '') + (disabled ? ' disabled' : '') + '>' +
    (symbol ? icon(symbol) : '') + esc(text) + '</button>';
}

function pageHead(title, description, actions) {
  return '<div class="page-head"><div><h1>' + title + '</h1>' +
    (description ? '<p class="subtitle">' + description + '</p>' : '') + '</div>' +
    (actions ? '<div class="actions">' + actions + '</div>' : '') + '</div>';
}

function metric(label, value, symbol, color = '', hint = '') {
  return '<article class="metric"><div class="top"><span class="tag-icon ' + color + '">' + icon(symbol) + '</span>' +
    esc(label) + '</div><strong>' + esc(value) + '</strong>' + (hint ? '<small>' + esc(hint) + '</small>' : '') + '</article>';
}

function empty(title, detail, symbol = 'box', action = '') {
  return '<div class="empty"><span class="empty-icon">' + icon(symbol) + '</span><strong>' +
    esc(title) + '</strong><p>' + esc(detail) + '</p>' + action + '</div>';
}

function table(headers, rows) {
  return '<div class="table-wrap" tabindex="0" role="region" aria-label="Tabela com rolagem"><table><thead><tr>' +
    headers.map((head) => '<th scope="col">' + esc(head) + '</th>').join('') +
    '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
}

function productStatus(product) {
  if (product.qty === 0) return { key: 'zero', label: 'Sem estoque', tone: 'rose' };
  if (product.qty <= product.min_qty) return { key: 'low', label: 'Estoque baixo', tone: 'orange' };
  return { key: 'good', label: 'Disponível', tone: 'green' };
}

function chip(label, tone = '') {
  return '<span class="chip ' + tone + '">' + esc(label) + '</span>';
}

function sums(entries) {
  const result = { in: 0, out: 0 };
  for (const entry of entries) if (!entry.voided_at) result[entry.kind] += entry.amount;
  return { ...result, balance: result.in - result.out };
}

function chart(entries) {
  const buckets = Array.from({ length: 5 }, (_, i) => ({ start: String(i * 7 + 1).padStart(2, '0'), in: 0, out: 0 }));
  for (const entry of entries) {
    if (entry.voided_at) continue;
    const week = Math.floor((Number(entry.day.slice(8)) - 1) / 7);
    buckets[week][entry.kind] += entry.amount;
  }
  const max = Math.max(...buckets.flatMap((week) => [week.in, week.out]), 1000);
  const scale = max / 100;
  const format = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  const ticks = [scale, scale * .75, scale / 2, scale * .25, 0]
    .map((value) => '<span>' + format.format(value) + '</span>').join('');
  const groups = buckets.map((week) => {
    const label = week.start + '/' + monthStart.slice(5, 7);
    const bar = (type) => '<div class="bar ' + type + '" style="--height:' + 100 * week[type] / max +
      '%" title="' + types[type] + ' ' + esc(money(week[type])) + '"></div>';
    return '<div class="group"><div class="bars" role="img" aria-label="' +
      esc(label + ', entradas ' + money(week.in) + ', saídas ' + money(week.out)) + '">' +
      bar('in') + bar('out') + '</div><small>' + label + '</small></div>';
  }).join('');
  return '<article class="chart-panel"><div class="section-head"><div><h2>Movimento do mês</h2><small>' +
    monthName + ' · valores em R$</small></div><div class="legend"><span><i></i>Entradas</span><span><i></i>Saídas</span></div></div>' +
    '<div class="chart"><div class="axis" aria-hidden="true">' + ticks +
    '</div><div class="plot" style="--groups:5">' + groups + '</div></div></article>';
}

function home() {
  const { products, cash } = state;
  const activeCash = cash.filter((entry) => !entry.voided_at);
  const total = sums(cash);
  const low = products.filter((p) => productStatus(p).key !== 'good').sort((a, b) => a.qty - b.qty);
  const alertRows = low.slice(0, 5).map((p) => '<li><div><strong>' + esc(p.name) + '</strong><small>' + esc(p.code) +
    '</small></div>' + chip(number(p.qty) + ' ' + p.unit, p.qty ? 'orange' : 'rose') + '</li>').join('');
  const expanded = content.querySelector('.home-details')?.open;
  return pageHead('Início', '', button('Nova ordem', { symbol: 'clipboard', action: 'service-add' }) +
    button('Nova venda', { symbol: 'plus', action: 'sale-add', style: 'primary' })) +
    '<div class="metrics three">' + metric('Saldo do mês', money(total.balance), 'wallet') +
    metric('Vendas do mês', money(state.salesSummary.amount), 'cart') +
    metric('Estoque baixo', number(low.length), 'box', 'orange') +
    '</div><div class="home-shortcuts">' +
    '<a class="btn" href="#precos">Consultar preços</a><a class="btn" href="#estoque">Conferir estoque</a><a class="btn" href="#caixa">Abrir caixa</a></div>' +
    '<details class="home-details"' + (expanded ? ' open' : '') + '><summary>Detalhes do mês</summary><div class="overview-grid">' + chart(cash) +
    '<article class="panel"><div class="section-head"><h2>Alertas de estoque</h2><a class="btn text" href="#estoque">Ver estoque</a></div>' +
    (alertRows ? '<ul class="alert-list">' + alertRows + '</ul>' :
      empty(products.length ? 'Estoque em dia' : 'Estoque vazio', products.length ?
        'Os produtos estão acima do mínimo cadastrado.' : 'Cadastre produtos para acompanhar as quantidades e os alertas.', products.length ? 'check' : 'box')) +
    '</article></div><section class="panel overview-sales"><div class="section-head"><div><h2>Resultado das vendas do mês</h2>' +
    '<p>' + number(state.salesSummary.count) + ' vendas registradas em ' + monthName + '</p></div>' +
    go('Abrir painel de vendas', 'vendas') + '</div><div class="metrics">' + salesKpis(state.salesSummary) + '</div></section>' +
    '<section class="panel"><div class="section-head"><h2>Últimos lançamentos</h2><a class="btn text" href="#caixa">Ver fluxo de caixa</a></div>' +
    (activeCash.length ? cashRows(activeCash.slice(0, 5), true) :
      empty('Nenhum lançamento neste mês', 'Registre um recebimento ou pagamento para acompanhar o saldo.', 'receipt')) + '</section></details>';
}

function options(items, selected) {
  return items.map((item) => {
    const [value, label] = Array.isArray(item) ? item : [item, item];
    return '<option value="' + esc(value) + '"' + (value === selected ? ' selected' : '') + '>' + esc(label) + '</option>';
  }).join('');
}

function search(id, label, term) {
  return '<label class="input search">' + icon('search') + '<input type="search" id="' + id + '" placeholder="' + label +
    '" aria-label="' + label + '" value="' + esc(term) + '"></label>';
}

function matches(query, fields) {
  const normalize = (s) => String(s || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{Diacritic}/gu, '');
  return normalize(fields.join(' ')).includes(normalize(query.trim()));
}

function filteredProducts() {
  return state.products.filter((p) => matches(state.productSearch, [p.name, p.code, p.supplier, p.category]) &&
    (!state.productCategory || p.category === state.productCategory) &&
    (!state.productStatus || productStatus(p).key === state.productStatus));
}

function productRows() {
  const visible = filteredProducts();
  if (!visible.length) return state.products.length ? empty('Nenhum produto encontrado', 'Altere os filtros ou o termo da busca.', 'search') :
    empty('Nenhum produto cadastrado', 'Adicione o primeiro produto da sua loja.', 'box', button('Cadastrar produto', { action: 'product-add', style: 'text' }));
  return table(['Produto', 'Categoria', 'Estoque', 'Custo', 'Preço', 'Situação', 'Detalhes'], visible.map((p) => {
    const s = productStatus(p);
    return '<tr><td><strong>' + esc(p.name) + '</strong><small>' + esc(p.code) + '</small></td><td>' + esc(p.category) +
      '</td><td>' + number(p.qty) + ' ' + esc(p.unit) + '<small>Mín. ' + number(p.min_qty) + '</small></td><td class="money">' +
      money(p.cost) + '</td><td class="money">' + money(p.price) + '</td><td>' + chip(s.label, s.tone) + '</td><td>' +
      button('Ver produto', { action: 'product-view', id: p.id, style: 'text' }) + '</td></tr>';
  }));
}

function stockMoves() {
  if (!state.movements.length) return empty('Nenhuma movimentação registrada', 'As entradas e saídas de produtos aparecem aqui.', 'swap');
  return table(['Data e hora', 'Produto', 'Movimento', 'Motivo', 'Responsável'], state.movements.map((m) => {
    const type = m.delta > 0 ? 'in' : 'out';
    return '<tr><td>' + displayTime(m.created_at) + '</td><td><strong>' + esc(m.name) + '</strong><small>' + esc(m.code) +
      '</small></td><td class="money ' + type + '">' + (m.delta > 0 ? '+' : '−') + number(Math.abs(m.delta)) + ' ' + esc(m.unit) +
      '</td><td>' + esc(m.reason) + (m.notes ? '<small>' + esc(m.notes) + '</small>' : '') + '</td><td>' + esc(m.actor) + '</td></tr>';
  }));
}

function stock() {
  const active = state.stockTab === 'products';
  const categories = [...new Set(state.products.map((p) => p.category))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const statuses = [['', 'Todas as situações'], ['good', 'Disponível'], ['low', 'Estoque baixo'], ['zero', 'Sem estoque']];
  return pageHead('Estoque', 'Cadastre mercadorias e controle as entradas e saídas.', button('Ditar produto', { symbol: 'mic', action: 'assist-product' }) + button('Movimentar estoque', {
    symbol: 'swap', action: 'stock-move', disabled: !state.products.length
  }) + button('Novo produto', { symbol: 'plus', action: 'product-add', style: 'primary' })) +
    '<div class="tabs"><button class="tab" data-action="tab-products" aria-pressed="' + active +
    '">Produtos</button><button class="tab" data-action="tab-movements" aria-pressed="' + !active + '">Movimentações</button></div>' +
    '<section class="panel"><div class="section-head"><h2>' + (active ? 'Planilha de estoque' : 'Últimas movimentações de estoque') +
    '</h2>' + (active ? button('Exportar CSV', { symbol: 'download', action: 'export-stock', disabled: !state.products.length }) : '') +
    '</div>' + (active ? '<div class="controls">' + search('productSearch', 'Buscar por produto ou código', state.productSearch) +
      '<select id="productCategory" aria-label="Categoria">' + options([['', 'Todas as categorias'], ...categories], state.productCategory) +
      '</select><select id="productStatus" aria-label="Situação">' + options(statuses, state.productStatus) +
      '</select></div><div id="product-rows">' + productRows() + '</div>' : stockMoves()) + '</section>';
}

function filteredCash() {
  return state.cash.filter((entry) => (!state.cashType || entry.kind === state.cashType) &&
    (state.cashStatus === 'all' || (state.cashStatus === 'void' ? entry.voided_at : !entry.voided_at)) &&
    matches(state.cashSearch, [entry.description, entry.category, entry.payment, entry.contact, entry.reference]));
}

function cashRows(entries = filteredCash(), compact = false) {
  if (!entries.length) return empty('Nenhum lançamento encontrado', 'Altere os filtros ou registre uma entrada ou saída.', 'receipt');
  const heads = ['Data', 'Descrição', 'Tipo', 'Pagamento', 'Valor', 'Detalhes'];
  return table(heads, entries.map((entry) => '<tr><td>' + displayDay(entry.day) + '</td><td><strong>' +
    esc(entry.description) + '</strong><small>' + esc(entry.category) + '</small></td><td>' +
    (entry.voided_at ? chip('Estornado') : chip(types[entry.kind], entry.kind === 'in' ? 'green' : 'rose')) +
    '</td><td>' + esc(entry.payment) + '</td><td class="money ' + (entry.voided_at ? '' : entry.kind) + '">' +
    (entry.kind === 'out' ? '− ' : '+ ') + money(entry.amount) + '</td><td>' +
    button(compact ? 'Ver' : 'Ver detalhes', { action: 'cash-view', id: entry.id, style: 'text' }) + '</td></tr>'));
}

function cashPage() {
  const total = sums(state.cash);
  return pageHead('Fluxo de caixa', 'Registre recebimentos e pagamentos e confira o saldo do período.', button('Nova saída', {
    symbol: 'up', action: 'cash-out'
  }) + button('Nova entrada', { symbol: 'plus', action: 'cash-add', style: 'primary' })) +
    '<form class="period" id="period"><div class="controls inline"><label>Data inicial<input type="date" name="start" aria-label="Data inicial" required value="' +
    state.start + '"></label><label>Data final<input type="date" name="end" aria-label="Data final" required value="' + state.end +
    '"></label><div class="actions">' + button('Aplicar período', { type: 'submit' }) +
    button('Este mês', { action: 'this-month' }) + '</div></div></form><div class="metrics three">' +
    metric('Saldo do período', money(total.balance), 'wallet') + metric('Entradas', money(total.in), 'down', 'green') +
    metric('Saídas', money(total.out), 'up', 'rose') + '</div><section class="panel"><div class="section-head"><h2>Lançamentos</h2>' +
    button('Exportar CSV', { symbol: 'download', action: 'export-cash', disabled: !state.cash.length }) + '</div><div class="controls">' +
    search('cashSearch', 'Buscar lançamento', state.cashSearch) + '<select id="cashType" aria-label="Tipo de lançamento">' +
    options([['', 'Entradas e saídas'], ...Object.entries(types)], state.cashType) + '</select><select id="cashStatus" aria-label="Situação do lançamento">' +
    options([['active', 'Ativos'], ['all', 'Todas as situações'], ['void', 'Estornados']], state.cashStatus) +
    '</select></div><div id="cash-rows">' + cashRows() + '</div></section>';
}

function notify(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3800);
}

function setError(message = '') {
  errorBox.textContent = message;
  errorBox.hidden = !message;
}

function render({ loading = false, live = false } = {}) {
  for (const link of document.querySelectorAll('[data-page]')) {
    if (link.dataset.page === state.page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (state.page === 'agente') {
    const agent = universalAgent.mount();
    if (content.firstElementChild !== agent) content.replaceChildren(agent);
    content.setAttribute('aria-busy', 'false');
    return;
  }
  if (state.page === 'precos') {
    partsPricing ??= createPartsPricing({ amountField, cents, displayDay, esc, fold, money, notify, number, options, pageHead, request });
    if (content.firstElementChild !== partsPricing.element) content.replaceChildren(partsPricing.element);
    content.setAttribute('aria-busy', 'false');
    return;
  }
  if (!state.ready) {
    content.innerHTML = '<h1>' + labels[state.page] + '</h1><p class="loading">' +
      (loading ? 'Carregando dados da loja…' : 'Use Atualizar dados para tentar novamente.') + '</p>';
    return;
  }
  const focused = live && content.contains(document.activeElement) ? document.activeElement : null;
  const dates = live ? [...content.querySelectorAll('input[type=date]')].map((input) => [input.name, input.value]) : [];
  content.innerHTML = { inicio: home, estoque: stock, vendas: salesPage, caixa: cashPage, servicos: servicesPage, peliculas: filmsPage, conhecimento: knowledgePage, assistente: assistantPage }[state.page]();
  for (const [name, value] of dates) {
    const input = content.querySelector('input[type=date][name="' + CSS.escape(name) + '"]');
    if (input) input.value = value;
  }
  if (focused) {
    const replacement = focused.id ? document.getElementById(focused.id) :
      focused.name ? content.querySelector('[name="' + CSS.escape(focused.name) + '"]') :
      [...content.querySelectorAll('[data-action]')].find((el) =>
        el.dataset.action === focused.dataset.action && el.dataset.id === focused.dataset.id);
    replacement?.focus({ preventScroll: true });
    if (focused.selectionStart != null && replacement?.setSelectionRange) {
      replacement.setSelectionRange(focused.selectionStart, focused.selectionEnd);
    }
  }
  if (state.page === 'assistente') updateAssistantControls();
}

async function request(url, params) {
  const res = await fetch(url, params);
  if (res.status === 401 && signedIn && url !== '/api/acesso') {
    signedIn = false;
    location.reload();
  }
  const type = res.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw Error('O painel está indisponível. Tente atualizar a página.');
  const data = await res.json();
  if (!res.ok) {
    const error = Error(data.error || 'Não foi possível concluir a operação.');
    error.status = res.status;
    throw error;
  }
  return data;
}

async function load({ feedback = false, live = false } = {}) {
  const attempt = ++loadCount;
  if (!live) content.setAttribute('aria-busy', 'true');
  if (!live) setError();
  const onCash = state.page === 'caixa';
  const start = onCash ? state.start : monthStart;
  const end = onCash ? state.end : monthEnd;
  try {
    const data = await request('/api/loja?' + new URLSearchParams({ start, end }));
    if (attempt !== loadCount) return;
    Object.assign(state, data, { ready: true });
    if (!live) setSyncStatus('ok', 'Dados sincronizados');
    if (!live || state.page !== 'assistente') render({ live });
    if (feedback) notify('Dados atualizados.');
    return true;
  } catch (error) {
    if (attempt !== loadCount) return;
    if (!live) {
      setError(error.message);
      if (!state.ready) render();
    }
  } finally {
    if (attempt === loadCount) content.setAttribute('aria-busy', 'false');
  }
}

let syncTimer;
let syncing = false;
let syncedVersion;

function setSyncStatus(status, label) {
  syncStatus.dataset.status = status;
  if (syncStatus.textContent !== label) syncStatus.textContent = label;
}

async function syncPanel() {
  clearTimeout(syncTimer);
  if (document.hidden || syncing) return;
  syncing = true;
  try {
    const { version } = await request('/api/alteracoes', { signal: AbortSignal.timeout(8000) });
    if (version !== syncedVersion || !state.ready) {
      if ((!state.ready || version !== state.version) && !await load({ live: state.ready })) return;
      const updated = await Promise.all([
        state.page === 'vendas' ? loadSales({ live: true }) : true,
        state.page === 'conhecimento' || knowledge ? refreshKnowledge({ live: true }) : true,
        state.page === 'precos' ? partsPricing.refreshPrices() : true
      ]);
      if (!updated.every(Boolean)) return;
      const media = dialog.querySelector('[data-order-media]');
      if (dialog.open && media && !activeUploads.has(media.dataset.orderMedia)) await refreshMedia(media.dataset.orderMedia);
      syncedVersion = version;
    }
    setSyncStatus('ok', 'Dados sincronizados');
  } catch {
    setSyncStatus('offline', 'Reconectando…');
  } finally {
    syncing = false;
    if (!document.hidden) syncTimer = setTimeout(syncPanel, 2500);
  }
}

function textField(label, name, value = '', opts = {}) {
  const { required = false, max = 120, type = 'text', placeholder = '', full = false } = opts;
  return '<label' + (full ? ' class="full"' : '') + '>' + esc(label) + '<input name="' + name + '" type="' + type +
    '" value="' + esc(value) + '" maxlength="' + max + '"' + (required ? ' required' : '') +
    (type === 'number' ? ' min="0" max="100000000" step="1"' : '') +
    (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') + '></label>';
}

function selectField(label, name, items, selected = '') {
  return '<label>' + esc(label) + '<select name="' + name + '" required>' + options(items, selected) + '</select></label>';
}

function notes(value = '') {
  return '<label class="full">Observações<textarea name="notes" maxlength="500">' + esc(value) + '</textarea></label>';
}

const decimal = (cents) => ((cents || 0) / 100).toFixed(2).replace('.', ',');

function amountField(label, name, amount, required = true) {
  return '<label>' + label + '<input name="' + name + '" inputmode="decimal" maxlength="17" placeholder="0,00" value="' +
    (amount == null ? '' : decimal(amount)) + '"' + (required ? ' required' : '') + '></label>';
}

function cents(value) {
  const normalized = value.trim().replace(/\s/g, '');
  const valid = /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(normalized) ||
    /^\d+\.\d{1,2}$/.test(normalized);
  if (!valid) throw Error('Informe um valor como 12,50.');
  const numeric = normalized.includes(',') || /^\d{1,3}(?:\.\d{3})+$/.test(normalized)
    ? normalized.replaceAll('.', '').replace(',', '.') : normalized;
  return Math.round(Number(numeric) * 100);
}

function productForm(product, { newProduct = !product } = {}) {
  const p = product || { unit: 'un', min_qty: 0, cost: 0, price: 0 };
  return textField('Nome do produto', 'name', p.name, { required: true, max: 100, full: true }) +
    textField('Código / SKU', 'code', p.code, { required: true, max: 45, placeholder: 'Ex.: PROD-001' }) +
    textField('Categoria', 'category', p.category, { required: true, max: 60, placeholder: 'Ex.: Acessórios' }) +
    textField('Fornecedor', 'supplier', p.supplier, { max: 100 }) +
    selectField('Unidade', 'unit', units, p.unit || 'un') +
    (newProduct ? textField('Estoque inicial', 'qty', product ? p.qty : 0, { required: true, type: 'number' }) : '') +
    textField('Estoque mínimo', 'min_qty', p.min_qty, { required: true, type: 'number' }) +
    amountField('Custo unitário (R$)', 'cost', p.cost) + amountField('Preço de venda (R$)', 'price', p.price) + notes(p.notes);
}

function moveForm(p, kind = 'in') {
  return selectField('Produto', 'product_id', state.products.map((item) => [
    item.id, item.name + ' · ' + item.code + ' (' + number(item.qty) + ' ' + item.unit + ')'
  ]), p?.id) + selectField('Movimento', 'kind', Object.entries(types), kind) +
    textField('Quantidade', 'qty', 1, { required: true, type: 'number' }) +
    textField('Motivo', 'reason', '', { required: true, max: 80, placeholder: 'Ex.: Reposição, venda, perda' }) + notes();
}

const categoryPresets = {
  in: ['Venda', 'Recebimento', 'Aporte', 'Outras entradas'],
  out: ['Fornecedor', 'Aluguel', 'Transporte', 'Taxas', 'Impostos', 'Outras despesas']
};

function cashForm(entry, kind) {
  const e = entry || { kind, day: today, payment: 'Pix' };
  return selectField('Tipo', 'kind', Object.entries(types), e.kind) +
    textField('Data do movimento', 'day', e.day, { required: true, type: 'date' }) +
    textField('Descrição', 'description', e.description, { required: true, full: true, placeholder: 'Ex.: Venda no balcão' }) +
    amountField('Valor (R$)', 'amount', e.amount) + selectField('Forma de pagamento', 'payment', [['', 'Selecione'], ...payments], e.payment || '') +
    '<label>Categoria<input name="category" maxlength="60" required list="cash-categories" value="' + esc(e.category) +
    '" placeholder="Escolha ou digite"><datalist id="cash-categories">' + options(categoryPresets[e.kind]) + '</datalist></label>' +
    textField('Cliente ou fornecedor', 'contact', e.contact, { max: 100 }) +
    textField('Nº do documento', 'reference', e.reference, { max: 70, full: true }) + notes(e.notes);
}

function details(items) {
  return '<dl class="details">' + items.map(([key, value]) => '<div><dt>' + esc(key) + '</dt><dd>' +
    esc(value || '—') + '</dd></div>').join('') + '</dl>';
}

function productDetails(p) {
  showDialog('Detalhes do produto', details([
    ['Produto', p.name], ['Código / SKU', p.code], ['Categoria', p.category], ['Fornecedor', p.supplier],
    ['Estoque atual', number(p.qty) + ' ' + p.unit], ['Estoque mínimo', number(p.min_qty) + ' ' + p.unit],
    ['Custo unitário', money(p.cost)], ['Preço de venda', money(p.price)], ['Observações', p.notes]
  ]), button('Editar', { action: 'product-edit', id: p.id }) +
    button('Excluir', { action: 'product-delete', id: p.id, symbol: 'trash' }) +
    button('Movimentar estoque', { action: 'stock-move', id: p.id }) +
    button('Vender', { action: 'sale-add', id: p.id, symbol: 'cart', style: 'primary', disabled: p.qty < 1 }));
}

function cashDetails(e) {
  showDialog('Detalhes do lançamento', details([
    ['Descrição', e.description], ['Situação', e.voided_at ? 'Estornado' : 'Ativo'], ['Tipo', types[e.kind]],
    ['Valor', money(e.amount)], ['Data', displayDay(e.day)], ['Categoria', e.category],
    ['Pagamento', e.payment], ['Cliente ou fornecedor', e.contact], ['Nº do documento', e.reference],
    ['Registrado por', e.actor], ['Última alteração por', e.updated_by],
    ['Última alteração em', displayTime(e.updated_at)], ['Estornado em', e.voided_at ? displayTime(e.voided_at) : ''],
    ['Observações', e.notes]
  ]), e.sale_id ? button('Ver venda', { action: 'sale-view', id: e.sale_id, style: 'primary' }) :
    e.voided_at ? button('Fechar', { action: 'dialog-close' }) :
    button('Estornar', { action: 'cash-void', id: e.id }) + button('Editar', { action: 'cash-edit', id: e.id, style: 'primary' }));
}

function showDialog(title, body, footer, form) {
  dialog.classList.remove('wide');
  const header = '<div class="dialog-head"><h2 id="dialog-title">' + esc(title) +
    '</h2><button class="icon-button" type="button" data-action="dialog-close" aria-label="Fechar">' + icon('close') + '</button></div>';
  const content = '<div class="dialog-content"><div class="notice" role="alert" hidden></div>' + body + '</div>';
  const actions = '<div class="dialog-footer">' + footer + '</div>';
  dialog.innerHTML = form ? '<form data-form="' + form.action + '">' + header + content + actions + '</form>' : header + content + actions;
  dialog.dataset.id = form?.id || '';
  dialog.dataset.revision = form?.revision || '';
  dialog.dataset.operation = form ? crypto.randomUUID() : '';
  if (!dialog.open) dialog.showModal();
  (dialog.querySelector('input, select') || dialog.querySelector('button'))?.focus();
}

function showForm(action, title, fields, record, destructive = false, { fromAssistant = false, submitLabel = '' } = {}) {
  showDialog(title, destructive ? fields : '<div class="form-grid">' + fields + '</div>',
    button('Cancelar', { action: 'dialog-close' }) + button(submitLabel || (destructive ? 'Confirmar estorno' : 'Salvar'), {
      type: 'submit', style: destructive ? 'danger' : 'primary'
    }), { action, id: record?.id || crypto.randomUUID(), revision: record?.revision });
  dialog.dataset.fromAssistant = String(fromAssistant);
}

function exportCsv(name, headers, values) {
  const quote = (value) => {
    const v = String(value ?? '');
    const safe = typeof value === 'string' && !/^-\d+,\d{2}$/.test(v) && /^\s*[=+\-@\t\r\n]/.test(v) ? "'" + v : v;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  const csv = [headers, ...values].map((row) => row.map(quote).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function exportStock() {
  exportCsv('estoque.csv', ['Código', 'Produto', 'Categoria', 'Fornecedor', 'Unidade', 'Estoque', 'Mínimo', 'Custo (R$)', 'Preço (R$)', 'Observações'],
    filteredProducts().map((p) => [p.code, p.name, p.category, p.supplier, p.unit, p.qty, p.min_qty, decimal(p.cost), decimal(p.price), p.notes]));
}

function exportCash() {
  exportCsv('fluxo-de-caixa.csv', ['Data', 'Tipo', 'Descrição', 'Categoria', 'Pagamento', 'Valor (R$)', 'Situação',
    'Cliente ou fornecedor', 'Documento', 'Observações', 'Responsável'],
    filteredCash().map((e) => [e.day, types[e.kind], e.description, e.category, e.payment, decimal(e.amount),
      e.voided_at ? 'Estornado' : 'Ativo', e.contact, e.reference, e.notes, e.actor]));
}

const serviceState = {
  open: ['Aberta', 'orange'],
  working: ['Em andamento', 'accent'],
  done: ['Concluída', 'green'],
  canceled: ['Cancelada', 'rose']
};
const labelsForServices = Object.entries(serviceState).map(([key, [label]]) => [key, label]);
const orderNumber = (order) => '#' + String(order.number).padStart(4, '0');

function orderRows() {
  const records = state.orders.filter((order) =>
    (!state.orderStatus || state.orderStatus === order.status) &&
    matches(state.orderSearch, [orderNumber(order), order.title, order.customer, order.phone]));
  if (!records.length) return state.orders.length ?
    empty('Nenhuma ordem encontrada', 'Altere a busca ou o filtro de situação.', 'search') :
    empty('Nenhuma ordem de serviço', 'Use Nova ordem ou descreva o serviço para o assistente.', 'clipboard');
  return table(['Nº', 'Serviço e cliente', 'Prazo', 'Situação', 'Valor', 'Anexos', 'Detalhes'], records.map((order) =>
    '<tr><td class="service-number">' + orderNumber(order) + '</td><td><strong>' + esc(order.title) +
    '</strong><small>' + esc(order.customer) + '</small></td><td>' + (order.due_day ? displayDay(order.due_day) : '—') +
    '</td><td>' + chip(...serviceState[order.status]) + '</td><td class="money">' + (order.amount === null ? '—' : money(order.amount)) +
    '</td><td>' + number(order.media_count || 0) + '</td><td>' + button('Ver ordem', { action: 'service-view', id: order.id, style: 'text' }) + '</td></tr>'));
}

function servicesPage() {
  const count = (status) => number(state.orders.filter((order) => order.status === status).length);
  const overdue = state.orders.filter((order) => order.due_day && order.due_day < today &&
    ['open', 'working'].includes(order.status)).length;
  return pageHead('Ordens de serviço', 'Acompanhe os serviços da loja, do pedido à entrega.',
    button('Ditar serviço', { symbol: 'mic', action: 'assist-service' }) +
    button('Nova ordem', { symbol: 'plus', action: 'service-add', style: 'primary' })) +
    '<div class="metrics">' + metric('Abertas', count('open'), 'clipboard', 'orange') +
    metric('Em andamento', count('working'), 'calendar') + metric('Concluídas', count('done'), 'check', 'green') +
    metric('Com prazo vencido', number(overdue), 'alert', 'rose') +
    '</div><section class="panel"><div class="section-head"><h2>Ordens cadastradas</h2></div><div class="controls">' +
    search('orderSearch', 'Buscar por serviço, cliente ou número', state.orderSearch) +
    '<select id="orderStatus" aria-label="Situação da ordem">' +
    options([['', 'Todas as situações'], ...labelsForServices], state.orderStatus) +
    '</select></div><div id="order-rows">' + orderRows() + '</div></section>';
}

const acceptedMedia = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime'
};
const acceptFiles = Object.entries(acceptedMedia).flatMap(([extension, mime]) => ['.' + extension, mime]).join(',');
const mediaQueues = new Map();
const activeUploads = new Set();

function mediaInput(attributes = '') {
  return '<input type="file" multiple accept="' + acceptFiles + '" ' + attributes + '>';
}

const mediaFormat = 'Fotos e vídeos até 8 MB por arquivo. Até 20 anexos por ordem.';

function mediaUrl(order, id = '') {
  return '/api/ordens/' + encodeURIComponent(order) + '/midia' + (id ? '/' + encodeURIComponent(id) : '');
}

function mediaPanel(order) {
  return '<section class="order-media" data-order-media="' + esc(order.id) + '"><div class="section-head"><div><h3>Fotos e vídeos do aparelho</h3>' +
    '<p>' + mediaFormat + '</p></div></div><label class="media-picker">Selecionar arquivos' + mediaInput('data-media-picker') +
    '</label><div id="media-actions" class="actions">' + button('Enviar arquivos', { action: 'media-upload', id: order.id, symbol: 'up' }) +
    button('Tentar de novo', { action: 'media-retry', id: order.id }) + '</div><p id="media-status" role="status"></p>' +
    '<div id="media-gallery"><p>Carregando anexos…</p></div></section>';
}

function activeMediaPanel(order) {
  const selector = dialog.querySelector('[data-order-media]');
  return dialog.open && selector?.dataset.orderMedia === order ? selector : null;
}

function setMediaStatus(order, message = '') {
  const section = activeMediaPanel(order);
  if (!section) return;
  section.querySelector('#media-status').textContent = message;
  const busy = activeUploads.has(order);
  section.querySelector('[data-action="media-retry"]').hidden = !mediaQueues.get(order)?.length;
  for (const button of section.querySelectorAll('#media-actions .btn')) button.disabled = busy;
  section.querySelector('[data-media-picker]').disabled = busy;
}

function describeSize(bytes) {
  return bytes < 1048576 ? number(Math.ceil(bytes / 1024)) + ' KB' :
    new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(bytes / 1048576) + ' MB';
}

function mediaTile(order, file) {
  const href = mediaUrl(order, file.id);
  let preview = '<div class="media-placeholder">' + icon('clipboard') + '<span>Foto HEIC</span></div>';
  if (file.type.startsWith('video/')) {
    preview = '<video src="' + href + '" controls preload="none" playsinline aria-label="' + esc(file.name) + '"></video>';
  } else if (!['image/heic', 'image/heif'].includes(file.type)) {
    preview = '<a href="' + href + '" target="_blank" rel="noopener noreferrer"><img loading="lazy" src="' + href +
      '" alt="' + esc(file.name) + '"></a>';
  }
  return '<article class="media-tile">' + preview + '<div><strong>' + esc(file.name) + '</strong><small>' + describeSize(file.size) +
    ' · ' + displayTime(file.created_at) + '</small><div class="actions"><a class="btn text" href="' + href + '?download=1">Baixar</a>' +
    button('Remover', { action: 'media-remove', id: file.id, style: 'text' }) + '</div></div></article>';
}

async function refreshMedia(order) {
  const section = activeMediaPanel(order);
  if (!section) return;
  setMediaStatus(order, mediaQueues.get(order)?.length ? 'Há arquivos pendentes de envio.' : '');
  const gallery = section.querySelector('#media-gallery');
  try {
    const { media } = await request(mediaUrl(order));
    if (activeMediaPanel(order) !== section) return;
    const signature = JSON.stringify(media);
    if (gallery.dataset.signature === signature) return;
    const stored = state.orders.find((entry) => entry.id === order);
    if (stored) stored.media_count = media.length;
    if (state.page === 'servicos') updateRows();
    gallery.dataset.signature = signature;
    gallery.innerHTML = media.length ? '<div class="media-grid">' + media.map((file) => mediaTile(order, file)).join('') + '</div>' :
      '<p>Nenhuma foto ou vídeo nesta ordem.</p>';
  } catch (error) {
    if (activeMediaPanel(order) === section) {
      delete gallery.dataset.signature;
      gallery.textContent = error.message;
    }
  }
}

function prepareMediaJobs(files) {
  if (files.length > 20) throw Error('Selecione até 20 arquivos por vez.');
  return files.map((file) => {
    const fallback = acceptedMedia[file.name.split('.').at(-1)?.toLowerCase()];
    const type = Object.values(acceptedMedia).includes(file.type) ? file.type : fallback;
    if (!type) throw Error('Formato não compatível em ' + file.name + '.');
    const limit = 8;
    if (!file.size || file.size > limit * 1048576) throw Error(file.name + ' deve ter até ' + limit + ' MB.');
    return { file, type, id: crypto.randomUUID() };
  });
}

async function uploadOrderMedia(order, files) {
  if (activeUploads.has(order)) return;
  try {
    if (files?.length) {
      const added = prepareMediaJobs(files);
      mediaQueues.set(order, [...(mediaQueues.get(order) || []), ...added]);
    }
  } catch (error) {
    setMediaStatus(order, error.message);
    return;
  }
  const pending = mediaQueues.get(order);
  if (!pending?.length) { setMediaStatus(order, 'Selecione as fotos ou os vídeos.'); return; }
  activeUploads.add(order);
  const failed = [];
  let firstError = '';
  try {
    for (const [index, upload] of pending.entries()) {
      setMediaStatus(order, 'Enviando arquivo ' + (index + 1) + ' de ' + pending.length + '…');
      try {
        await request(mediaUrl(order, upload.id), {
          method: 'PUT', body: upload.file,
          headers: { 'Content-Type': upload.type, 'X-File-Size': String(upload.file.size), 'X-File-Name': encodeURIComponent(upload.file.name) }
        });
      } catch (error) {
        failed.push(upload);
        firstError ||= error.message;
      }
    }
  } finally {
    if (failed.length) mediaQueues.set(order, failed);
    else mediaQueues.delete(order);
    activeUploads.delete(order);
  }
  await refreshMedia(order);
  setMediaStatus(order, failed.length ? failed.length + ' arquivo(s) pendente(s). ' + firstError :
    pending.length === 1 ? 'Arquivo anexado.' : pending.length + ' arquivos anexados.');
}

async function removeOrderMedia(order, id) {
  if (!order || !window.confirm('Remover este arquivo da ordem de serviço?')) return;
  try {
    await request(mediaUrl(order, id), { method: 'DELETE' });
    await refreshMedia(order);
    setMediaStatus(order, 'Arquivo removido.');
  } catch (error) { setMediaStatus(order, error.message); }
}

function serviceForm(order = {}) {
  return textField('Serviço a realizar', 'title', order.title, { required: true, full: true, placeholder: 'Ex.: Troca de tela' }) +
    textField('Nome do cliente', 'customer', order.customer, { required: true, max: 100 }) +
    textField('Telefone ou WhatsApp', 'phone', order.phone, { type: 'tel', max: 32 }) +
    textField('Prazo de entrega', 'due_day', order.due_day, { type: 'date' }) +
    amountField('Valor (R$)', 'amount', order.amount, false) +
    selectField('Situação', 'status', labelsForServices, order.status || 'open') + notes(order.notes) +
    '<label class="full">Fotos e vídeos do aparelho' + mediaInput('data-service-files') +
    '<small class="sales-hint">' + mediaFormat + '</small></label>';
}

function orderDetails(order) {
  showDialog('Ordem de serviço ' + orderNumber(order), details([
    ['Serviço', order.title], ['Cliente', order.customer], ['Telefone ou WhatsApp', order.phone],
    ['Prazo', order.due_day && displayDay(order.due_day)], ['Situação', serviceState[order.status][0]],
    ['Valor', order.amount === null ? '' : money(order.amount)], ['Registrada por', order.actor],
    ['Última alteração por', order.updated_by], ['Última alteração em', displayTime(order.updated_at)], ['Observações', order.notes]
  ]) + mediaPanel(order), (order.status === 'done' ? button('Registrar aprendizado', { action: 'guide-from-order', id: order.id }) : '') +
    button('Excluir', { action: 'service-delete', id: order.id, symbol: 'trash' }) +
    button('Editar ordem', { action: 'service-edit', id: order.id, style: 'primary' }));
  dialog.classList.add('wide');
  void refreshMedia(order.id);
}

let catalog;
let catalogRequest;
let catalogFailure = false;
let indexedFilms;
let indexedCatalog;

function loadFilmCatalog() {
  if (catalog) return Promise.resolve(catalog);
  if (!catalogRequest) {
    catalogFailure = false;
    catalogRequest = request('/film-catalog.json').then((records) => {
      catalog = records;
      return records;
    }).catch((error) => {
      catalogFailure = true;
      throw error;
    }).finally(() => { catalogRequest = undefined; });
  }
  return catalogRequest;
}

function filmIndex() {
  if (!indexedFilms || indexedFilms.records !== state.films || indexedCatalog !== catalog) {
    indexedFilms = {
      records: state.films,
      models: buildFilmIndex([
        ...state.films.map((film) => ({ ...film, kind: 'store', source: 'Cadastro da loja' })),
        ...(catalog || [])
      ])
    };
    indexedCatalog = catalog;
  }
  return indexedFilms.models;
}

function stockProduct(film) {
  return film.product_id && state.products.find((item) => item.id === film.product_id);
}

function filmsPage() {
  const models = filmIndex();
  const brands = [...new Set(models.map((model) => model.brand))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const lookupField = (label, id, value, placeholder, required) => '<label for="' + id + '">' + label +
    '<input id="' + id + '" type="search" maxlength="75" autocomplete="off" placeholder="' + placeholder + '" value="' +
    esc(value) + '"' + (required ? ' required' : '') + '></label>';
  return pageHead('Películas compatíveis', 'Consulte películas de tela pelo modelo exato do aparelho.',
    button('Cadastrar película', { symbol: 'plus', action: 'film-add', style: 'primary' })) +
    '<section class="panel films-search"><div class="section-head"><div><h2>Buscar por modelo</h2>' +
    '<p>Confira a linha da película e os recortes na embalagem.</p></div><span class="film-count">' +
    number(models.length) + ' modelos no catálogo</span></div><form id="film-search-form">' +
    '<div class="film-form-grid">' + lookupField('Modelo do aparelho', 'film-query', state.filmQuery, 'Ex.: Moto G60', false) +
    lookupField('Comparar com outro modelo', 'film-compare', state.filmCompare, 'Ex.: Moto G06', false) +
    button('Buscar', { type: 'submit', symbol: 'search', style: 'primary' }) + '</div><div class="film-filters">' +
    '<select id="filmBrand" aria-label="Marca do aparelho">' + options([['', 'Todas as marcas'], ...brands], state.filmBrand) +
    '</select><select id="filmType" aria-label="Tipo de película">' +
    options([['', 'Todos os materiais'], ...filmTypes], state.filmType) +
    '</select><label class="film-check"><input type="checkbox" id="filmStore"' + (state.filmStore ? ' checked' : '') +
    '> Só películas da loja</label></div></form></section><div id="film-results">' + filmResults() + '</div>';
}

function filmedModelButtons(models, target) {
  const action = target === 'film-compare' ? 'film-select-compare' : 'film-select';
  return '<div class="film-models">' + models.slice(0, 48).map((model) => button(model.name, {
    action, id: model.name
  })).join('') + '</div>';
}

function filmResultCard(group, selectedNames = []) {
  const p = stockProduct(group);
  const isStore = group.kind === 'store';
  const names = new Set(selectedNames.map((model) => model.id));
  const models = group.models.map((model) => chip(model, names.has(filmModelKey(model)) ? 'accent' : '')).join('');
  return '<article class="panel film-card"><div class="section-head"><div><h3>' + esc(group.label) +
    '</h3><p>' + esc(group.type) + ' · ' + esc(group.source) + '</p></div>' +
    (isStore ? chip('Da loja', 'accent') : '') + '</div><div class="film-card-body"><div class="film-models">' + models +
    '</div>' + (group.notes ? '<p>' + esc(group.notes) + '</p>' : '') +
    (p ? '<p><strong>' + esc(p.code) + '</strong> · ' + number(p.qty) + ' ' + esc(p.unit) + ' em estoque</p>' : '') +
    '<div class="panel-actions">' + (group.source_url ? '<a class="btn text" target="_blank" rel="noopener noreferrer" href="' +
      esc(group.source_url) + '">Ver fonte</a>' : '') +
    (p ? button('Ver produto', { action: 'product-view', id: p.id, style: 'text' }) : '') +
    (isStore ? button('Editar', { action: 'film-edit', id: group.id, style: 'text' }) +
      button('Excluir', { action: 'film-delete', id: group.id, style: 'text' }) : '') +
    '</div></div></article>';
}

function filmResults() {
  if (!catalog && !catalogFailure) return '<p class="loading" role="status">Carregando referências do catálogo…</p>';
  const index = filmIndex();
  const unavailable = catalogFailure ? '<p class="notice">O catálogo de fornecedores está indisponível. As películas cadastradas na loja aparecem abaixo.</p>' : '';
  const first = lookupFilmModels(index, state.filmQuery, state.filmBrand);
  const second = state.filmCompare.trim() ? lookupFilmModels(index, state.filmCompare) : null;
  if (!state.filmQuery.trim() || first.exact.length !== 1 || second && second.exact.length !== 1) {
    const searchSecond = first.exact.length === 1 && second;
    const result = searchSecond || first;
    let suggestions = result.suggestions;
    if (state.filmType || state.filmStore) {
      suggestions = suggestions.filter((model) => compatibleFilmGroups(model, null, state.filmType, state.filmStore).length);
    }
    const title = searchSecond ? 'Escolha o segundo aparelho' : state.filmQuery.trim() ? 'Selecione o modelo exato' : 'Modelos do catálogo';
    return unavailable + '<section class="panel film-suggestions"><div class="section-head"><h2>' + title +
      '</h2>' + (suggestions.length > 48 ? '<small>' + number(suggestions.length) + ' modelos. Refine por nome ou marca.</small>' : '') +
      '</div>' + (suggestions.length ? filmedModelButtons(suggestions, searchSecond ? 'film-compare' : 'film-query') :
        empty('Modelo sem referência nesta busca', 'Confira a variante, ajuste os filtros ou cadastre uma referência da sua loja.', 'phone',
          button('Cadastrar película', { action: 'film-add', style: 'text' }))) + '</section>';
  }
  const one = first.exact[0];
  const two = second?.exact[0];
  const rows = compatibleFilmGroups(one, two, state.filmType, state.filmStore);
  const title = one.name + (two ? ' e ' + two.name : '');
  const message = state.filmType || state.filmStore ? 'Nenhuma referência com os filtros selecionados.' :
    two ? 'Nenhuma das referências cadastradas lista os dois modelos na mesma película.' : 'Nenhuma referência disponível.';
  return unavailable + '<div class="film-result-heading"><h2>' + esc(title) + '</h2><small>' + rows.length +
    (rows.length === 1 ? ' referência' : ' referências') + '</small></div>' +
    (rows.length ? '<div class="film-cards">' + rows.map((row) => filmResultCard(row, [one, ...(two ? [two] : [])])).join('') +
      '</div>' : '<section class="panel">' + empty(two ? 'Sem película em comum no catálogo' : 'Sem referências', message, 'phone') + '</section>');
}

function filmForm(film, { prefill = true } = {}) {
  const selected = lookupFilmModels(filmIndex(), state.filmQuery, state.filmBrand).exact;
  const defaults = prefill && selected.length === 1 ? selected[0].name : '';
  const products = state.products.map((product) => [product.id, product.code + ' · ' + product.name]);
  return textField('Nome ou referência da película', 'label', film?.label, { required: true, full: true, placeholder: 'Ex.: Película vidro 3D – ref. 441' }) +
    selectField('Tipo de película', 'type', filmTypes, film?.type || 'Vidro 3D') +
    '<label>Produto do estoque<select name="product_id">' + options([['', 'Sem vínculo'], ...products], film?.product_id || '') +
    '</select></label><label class="full">Modelos compatíveis, um por linha<textarea name="models" rows="4" required maxlength="2800"' +
    ' placeholder="Moto G06&#10;Redmi 14C">' + esc(film ? film.models.join('\n') : defaults) + '</textarea></label>' +
    textField('Link HTTPS da fonte', 'source_url', film?.source_url, { type: 'url', full: true, max: 350 }) + notes(film?.notes);
}

function refreshFilmResults() {
  const results = document.querySelector('#film-results');
  if (results) results.innerHTML = filmResults();
}

function openFilmSearch(primary, secondary = '') {
  Object.assign(state, { filmQuery: primary, filmCompare: secondary, filmBrand: '', filmType: '', filmStore: false });
  if (state.page === 'peliculas') render();
  else location.hash = 'peliculas';
}

let assistantAnswer = '';
let assistantFilmPair = [];

const answer = (title, message, body = '', action = '') =>
  '<section class="panel assistant-answer" aria-labelledby="assistant-answer-title"><div class="section-head"><div>' +
  '<h2 id="assistant-answer-title">' + esc(title) + '</h2><p>' + esc(message) + '</p></div>' + action +
  '</div>' + body + '</section>';
const go = (label, page) => '<a class="btn" href="#' + page + '">' + esc(label) + '</a>';

async function replyFilms(text, records) {
  let unavailable = false;
  try { await loadFilmCatalog(); } catch { unavailable = true; }
  const index = buildFilmIndex([...records.films.map((film) => ({ ...film, kind: 'store', source: 'Cadastro da loja' })), ...(catalog || [])]);
  const search = parsedFilmQuestion(index, text);
  const known = search.models;
  if (search.unresolved || !known.length || known.length > 2) {
    return { resolved: false, markup: answer('Informe o modelo exato',
      unavailable ? 'O catálogo de fornecedores está indisponível. Você pode consultar os cadastros da loja na aba Películas.' :
        'Confira o nome e a variante, como Moto G06, Galaxy A52s ou Redmi Note 13 5G. Para comparar, diga os dois nomes completos.',
      '', go('Abrir busca de películas', 'peliculas')) };
  }
  const [first, second] = known;
  assistantFilmPair = [first.name, second?.name || ''];
  const shared = compatibleFilmGroups(first, second);
  const heading = first.name + (second ? ' e ' + second.name : '');
  const message = !shared.length ? 'Nenhuma referência cadastrada indica a mesma película para esses aparelhos.' :
    number(shared.length) + (shared.length === 1 ? ' referência encontrada' : ' referências encontradas') +
    '. Confira a linha e os recortes indicados pelo fornecedor.';
  const cards = shared.length ? shared : [...first.groups.slice(0, 2), ...second.groups.slice(0, 2)];
  return { resolved: shared.length > 0, markup: answer(heading, message, '<div class="film-cards assistant-film-cards">' +
    cards.slice(0, 4).map((row) => filmResultCard(row, known)).join('') + '</div>',
    button('Ver busca completa', { action: 'assist-films-result', symbol: 'phone' })) };
}

function replyStock(text, records) {
  const low = /\b(?:baixo|baixos|acabando|reposicao|minimo|em falta|falta|zerado|zerados)\b/.test(fold(text));
  const out = /\b(?:zerado|zerados|sem estoque)\b/.test(fold(text));
  let products = records.products;
  if (out || low) products = products.filter((p) => out ? p.qty === 0 : productStatus(p).key !== 'good');
  else {
    const matches = searchShopRecords(text, products, (p) => [p.code, p.name, p.category]);
    const general = /^(?:quantos produtos|quantas mercadorias|resumo(?: do)? estoque|estoque|produtos(?: cadastrados)?)[?. ]*$/.test(fold(text).trim());
    if (matches.length || !general) products = matches;
  }
  const total = number(products.length);
  const rows = products.slice(0, 6).map((p) => '<tr><td><strong>' + esc(p.name) + '</strong><small>' +
    esc(p.code) + '</small></td><td>' + number(p.qty) + ' ' + esc(p.unit) + '</td><td>' +
    chip(productStatus(p).label, productStatus(p).tone) + '</td><td>' +
    button('Ver produto', { action: 'product-view', id: p.id, style: 'text' }) + '</td></tr>');
  return answer(out ? 'Produtos sem estoque' : low ? 'Estoque baixo' : 'Consulta de estoque',
    products.length ? total + (products.length === 1 ? ' produto encontrado.' : ' produtos encontrados.') :
      'Nenhum produto corresponde à consulta. Confira o nome ou o código.',
    rows.length ? table(['Produto', 'Quantidade', 'Situação', 'Detalhes'], rows) : '', go('Abrir estoque', 'estoque'));
}

function replyOrders(text, records) {
  const question = fold(text);
  const id = question.match(/(?:\b(?:ordem(?: de servico)?|os|numero|nº)\s*#?\s*|#\s*)0*(\d+)\b/);
  const completed = /\b(?:concluid\w*|finalizad\w*|entregues?)\b/.test(question);
  const canceled = /\bcancelad\w*\b/.test(question);
  const pending = /\b(?:pendent\w*|atrasad\w*)\b/.test(question);
  const status = completed ? 'done' : canceled ? 'canceled' : /\bandamento\b/.test(question) ? 'working' :
    /\babert\w*\b/.test(question) ? 'open' : '';
  let orders = records.orders;
  if (id) orders = orders.filter((o) => o.number === Number(id[1]));
  else if (status) orders = orders.filter((o) => o.status === status);
  else if (pending) orders = orders.filter((o) => (o.status === 'open' || o.status === 'working') && (!/\batrasad\w*\b/.test(question) || o.due_day && o.due_day < today));
  else if (/\b(?:do|da|para|cliente)\s+\w+/.test(question) && !/\b(?:de servico|da loja)\b/.test(question)) {
    orders = searchShopRecords(text, orders, (o) => [o.title, o.customer, o.phone]);
  }
  const rows = orders.slice(0, 6).map((o) => '<tr><td>' + orderNumber(o) + '</td><td>' + esc(o.title) + '<small>' +
    esc(o.customer) + '</small></td><td>' + chip(...serviceState[o.status]) + '</td><td>' +
    (o.due_day ? displayDay(o.due_day) : '—') + '</td><td>' + button('Ver ordem', {
      action: 'service-view', id: o.id, style: 'text'
    }) + '</td></tr>');
  return answer('Ordens de serviço', number(orders.length) + (orders.length === 1 ? ' ordem encontrada.' : ' ordens encontradas.'),
    rows.length ? table(['Nº', 'Serviço e cliente', 'Situação', 'Prazo', 'Detalhes'], rows) : '', go('Abrir ordens', 'servicos'));
}

function replyCash(records, period) {
  const total = sums(records.cash);
  const label = period[0] === period[1] ? displayDay(period[0]) : displayDay(period[0]) + ' a ' + displayDay(period[1]);
  return answer('Fluxo de caixa', 'Período de ' + label + '. Valores dos lançamentos ativos.',
    '<div class="assistant-totals">' + metric('Entradas', money(total.in), 'down', 'green') +
    metric('Saídas', money(total.out), 'up', 'rose') + metric('Saldo', money(total.balance), 'wallet') + '</div>',
    button('Abrir este período', { action: 'assist-cash-period' }));
}

function replySummary(records) {
  const low = records.products.filter((p) => productStatus(p).key !== 'good').length;
  const pending = records.orders.filter((o) => o.status === 'open' || o.status === 'working').length;
  return answer('Resumo da loja', 'Estoque e ordens atuais, com saldo de ' + monthName + '.',
    '<div class="assistant-totals">' + metric('Produtos com alerta', number(low), 'box', 'orange') +
    metric('Ordens em aberto', number(pending), 'clipboard') + metric('Saldo do mês', money(sums(records.cash).balance), 'wallet') +
    '</div>', go('Abrir visão geral', 'inicio'));
}

function replyGuide(text) {
  const query = fold(text);
  if (/\b(?:vendas?|revender|lucro|margem bruta)\b/.test(query)) return answer('Registrar e acompanhar vendas',
    'Em Vendas, escolha os produtos, confira custo, preço e pagamento e salve. Consulte o faturamento e o lucro pelos filtros de período.',
    '', go('Abrir vendas', 'vendas'));
  if (/\bpelicul\w*\b/.test(query)) return answer('Buscar ou cadastrar película',
    'Em Películas, digite o modelo exato ou compare dois aparelhos. Para sua própria referência, use Cadastrar película.',
    '', go('Abrir películas', 'peliculas'));
  if (/\b(?:caixa|pagamento|sa[ií]da|entrada|estorn\w*|recebimento)\b/.test(query)) return answer('Trabalhar com o caixa',
    'Em Fluxo de caixa, use Nova entrada ou Nova saída. Abra os detalhes de um lançamento para editar ou estornar.',
    '', go('Abrir fluxo de caixa', 'caixa'));
  if (/\b(?:ordem|ordens|servico)\b/.test(query)) return answer('Trabalhar com ordens',
    'Em Ordens de serviço, use Nova ordem. Abra uma ordem para atualizar o prazo ou a situação.', '', go('Abrir ordens', 'servicos'));
  if (/\b(?:estoque|produto|exportar|repor|reposicao)\b/.test(query)) return answer('Trabalhar com o estoque',
    'Em Estoque, use Novo produto, Movimentar estoque ou Exportar CSV. Abra um produto para ver e editar seus dados.',
    '', go('Abrir estoque', 'estoque'));
  return answer('Como posso ajudar?',
    'Pergunte sobre um produto, o caixa, uma ordem ou uma película. Você também pode ditar um cadastro.',
    '<div class="assistant-links">' + go('Estoque', 'estoque') + go('Fluxo de caixa', 'caixa') + go('Ordens de serviço', 'servicos') +
    go('Películas', 'peliculas') + '</div>');
}

let knowledge;
let knowledgeRequest;
let knowledgeError = '';
let memoryEvent;

function loadKnowledge() {
  if (!knowledgeRequest) {
    knowledgeRequest = request('/api/conhecimento').then((data) => {
      knowledge = data;
      knowledgeError = '';
      return data;
    }).catch((error) => {
      knowledgeError = error.message;
      throw error;
    }).finally(() => { knowledgeRequest = undefined; });
  }
  return knowledgeRequest;
}

async function refreshKnowledge({ live = false } = {}) {
  if (live && knowledgeRequest) await knowledgeRequest.catch(() => {});
  const data = await loadKnowledge().catch(() => null);
  if (state.page === 'conhecimento' && (data || !live)) render({ live });
  return Boolean(data);
}

const knowledgeLabels = Object.entries(knowledgeTopics).map(([key, topic]) => [key, topic.label]);
const knowledgeTopicLabel = (key) => knowledgeTopics[key]?.label || knowledgeTopics.general.label;
const knowledgeAreaLabel = (key) => knowledgeAreas[knowledgeTopics[key]?.area] || knowledgeAreas.operation;
const guideItems = () => [...(knowledge?.guides || []), ...starterGuides];

function guideBody(guide) {
  const source = guide.source_url ? ' <a class="btn text" rel="noopener noreferrer" target="_blank" href="' +
    esc(guide.source_url) + '">Ver fonte</a>' : '';
  return '<div class="guide-content">' + guide.body.split(/\n{2,}/).filter(Boolean).map((p) => '<p>' + esc(p) + '</p>').join('') +
    (guide.evidence ? '<p class="guide-evidence"><strong>Base da orientação</strong> · ' + esc(guide.evidence) + source + '</p>' : '') +
    '</div>';
}

function guideCards() {
  const list = guideItems().filter((guide) => guide.status === state.knowledgeStatus &&
    (!state.knowledgeArea || knowledgeTopics[guide.topic]?.area === state.knowledgeArea) &&
    matches(state.knowledgeSearch, [guide.title, guide.body, knowledgeTopicLabel(guide.topic)]));
  if (!list.length) return empty(state.knowledgeStatus === 'draft' ? 'Nenhum rascunho encontrado' : 'Nenhum guia encontrado',
    'Experimente outro filtro ou registre uma experiência da equipe.', 'book');
  return '<div class="guide-grid">' + list.map((guide) => '<article class="guide-card"><div class="guide-card-meta">' +
    chip(knowledgeAreaLabel(guide.topic), 'accent') + '</div><h3>' + esc(guide.title) +
    '</h3><p>' + esc(guide.body.replace(/\s+/g, ' ').slice(0, 145) || knowledgeTopicLabel(guide.topic)) +
    (guide.body.replace(/\s+/g, ' ').length > 145 ? '…' : '') + '</p>' +
    button(guide.status === 'draft' ? 'Revisar rascunho' : 'Ler guia', {
      action: guide.status === 'draft' ? 'guide-edit' : 'guide-view', id: guide.id, style: 'text'
    }) + (guide.status === 'draft' ? button('Excluir', { action: 'guide-delete', id: guide.id, style: 'text' }) : '') +
    '</article>').join('') + '</div>';
}

function learningIdeas() {
  const ideas = guideIdeas(knowledge?.stats || [], knowledge?.guides || []);
  if (!ideas.length) return '<p class="learning-empty">As dúvidas recorrentes e as respostas marcadas para melhorar aparecem aqui.</p>';
  return '<ul class="learning-ideas">' + ideas.map((idea) => '<li><div><strong>' + esc(knowledgeTopicLabel(idea.topic)) +
    '</strong><small>' + number(idea.pending) + (idea.pending === 1 ? ' consulta para revisar' : ' consultas para revisar') +
    '</small></div>' + button('Criar rascunho', { action: 'guide-topic', id: idea.topic }) + '</li>').join('') + '</ul>';
}

function featureIdeasPanel() {
  const low = state.products.filter((product) => productStatus(product).key !== 'good').length;
  const overdue = state.orders.filter((order) => order.due_day && order.due_day < today &&
    ['open', 'working'].includes(order.status)).length;
  const highlights = [];
  if (overdue) highlights.push('Há ' + number(overdue) + (overdue === 1 ? ' ordem com prazo vencido.' : ' ordens com prazo vencido.'));
  if (low) highlights.push('Há ' + number(low) + (low === 1 ? ' produto no mínimo ou zerado.' : ' produtos no mínimo ou zerados.'));
  return '<section class="panel feature-ideas"><div class="section-head"><div><h2>Sugestões para o dia a dia</h2>' +
    '<p>Ideias de recursos para adicionar ao painel.</p></div></div>' +
    (highlights.length ? '<p class="feature-highlight">' + esc(highlights.join(' ')) + '</p>' : '') +
    '<div class="feature-grid">' + featureIdeas.map((idea) => '<article><h3>' + esc(idea.title) + '</h3><p>' +
      esc(idea.detail) + '</p></article>').join('') + '</div></section>';
}

function knowledgePage() {
  const drafts = (knowledge?.guides || []).filter((guide) => guide.status === 'draft').length;
  const approved = (knowledge?.guides || []).length - drafts;
  const total = (knowledge?.stats || []).reduce((sum, stat) => sum + stat.total, 0);
  const status = state.knowledgeStatus;
  return pageHead('Base de conhecimento', 'Guarde o que funciona na bancada e no balcão.',
    go('Abrir assistente', 'assistente') + button('Registrar experiência', { action: 'guide-add', symbol: 'plus', style: 'primary' })) +
    (knowledgeError ? '<p class="notice" role="status">' + esc(knowledgeError) + '</p>' : '') +
    '<div class="metrics three">' + metric('Guias da equipe', number(approved), 'book', 'green') +
    metric('Rascunhos para revisar', number(drafts), 'clipboard', 'orange') +
    metric('Consultas ao assistente', number(total), 'sparkles', '', 'Últimos 30 dias') + '</div>' +
    '<section class="panel knowledge-queue"><div class="section-head"><div><h2>O que vale documentar</h2>' +
    '<p>Assuntos sugeridos pelo uso do assistente.</p></div></div>' +
    (!knowledge && !knowledgeError ? '<p class="learning-empty" role="status">Carregando consultas…</p>' : learningIdeas()) + '</section>' +
    '<div class="tabs"><button type="button" class="tab" data-action="knowledge-published" aria-pressed="' + (status === 'published') +
    '">Guias</button><button type="button" class="tab" data-action="knowledge-drafts" aria-pressed="' + (status === 'draft') +
    '">Rascunhos</button></div><section class="panel"><div class="section-head"><h2>' +
    (status === 'draft' ? 'Guias em revisão' : 'Guias para consulta') + '</h2></div><div class="controls">' +
    search('knowledgeSearch', 'Buscar por assunto ou palavra', state.knowledgeSearch) +
    '<select id="knowledgeArea" aria-label="Área de conhecimento">' + options([['', 'Todas as áreas'], ...Object.entries(knowledgeAreas)], state.knowledgeArea) +
    '</select></div><div id="guide-results">' + guideCards() + '</div></section>' + featureIdeasPanel();
}

function guideForm(guide = {}) {
  return '<p class="full">Descreva o teste e o resultado sem dados de clientes. Guias aprovados ficam disponíveis ao assistente.</p>' +
    textField('Título do guia', 'title', guide.title, { required: true, full: true, placeholder: 'Ex.: Teste de carregamento intermitente' }) +
    selectField('Assunto', 'topic', knowledgeLabels, guide.topic || 'intake') +
    selectField('Situação', 'status', [['draft', 'Rascunho'], ['published', 'Aprovado para consulta']], guide.status || 'draft') +
    '<label class="full">O que funcionou<textarea name="body" rows="5" maxlength="3000" placeholder="Contexto do caso, o que foi testado, resultado e limites">' +
    esc(guide.body) + '</textarea></label>' +
    textField('Origem ou confirmação', 'evidence', guide.evidence, { full: true, max: 220, placeholder: 'Ex.: Testado na bancada com cabo e carregador de referência' }) +
    textField('Link HTTPS da fonte', 'source_url', guide.source_url, { full: true, max: 350, type: 'url' });
}

function openGuideDraft(topic) {
  const selected = Object.hasOwn(knowledgeTopics, topic) ? topic : 'general';
  showForm('guide-add', 'Registrar experiência', guideForm({ topic: selected, title: selected === 'general' ? '' : knowledgeTopicLabel(selected) }));
}

function viewGuide(guide) {
  showDialog(guide.title, guideBody(guide),
    button('Fechar', { action: 'dialog-close' }) + (guide.starter ? '' :
      button('Excluir', { action: 'guide-delete', id: guide.id, symbol: 'trash' }) +
      button('Editar guia', { action: 'guide-edit', id: guide.id, style: 'primary' })));
}

function replyKnowledge(text, topic, guides) {
  const results = relevantGuides(text, topic, guides);
  if (!results.length) return null;
  const cards = results.map((guide) => '<article class="knowledge-response-guide"><div class="guide-card-meta">' +
    chip(guide.starter ? 'Guia de referência' : 'Confirmado pela equipe', guide.starter ? 'accent' : 'green') +
    '</div><h3>' + esc(guide.title) + '</h3>' + guideBody(guide) + '</article>').join('');
  return answer('Orientações da base', knowledgeTopicLabel(topic), cards, go('Abrir base', 'conhecimento'));
}

function postShop(data, keepalive = false) {
  return request('/api/loja', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data), keepalive });
}

function recordKnowledgeEvent(topic, outcome) {
  const id = crypto.randomUUID();
  const pending = postShop({ action: 'knowledge-event', id, topic, outcome }, true).then(() => true, () => false);
  memoryEvent = { id, topic, pending, feedback: '', busy: false };
}

function feedbackMarkup() {
  if (!memoryEvent || !assistantAnswer) return '';
  const { feedback, busy, topic } = memoryEvent;
  const actions = feedback === 'improve' ? button('Registrar o que funcionou', { action: 'guide-topic', id: topic }) : '';
  const message = feedback ? 'Avaliação registrada.' : 'Essa resposta ajudou?';
  return '<div class="assistant-feedback"><span role="status">' + message + '</span><div class="actions">' +
    (feedback ? actions : button('Ajudou', { action: 'feedback-helpful', disabled: busy }) +
      button('Pode melhorar', { action: 'feedback-improve', disabled: busy })) + '</div></div>';
}

async function saveFeedback(feedback) {
  const entry = memoryEvent;
  if (!entry || entry.busy || entry.feedback) return;
  entry.busy = true;
  updateAssistantControls();
  try {
    if (!await entry.pending) throw Error('Não foi possível registrar a consulta.');
    await postShop({ action: 'knowledge-feedback', id: entry.id, feedback }, true);
    entry.feedback = feedback;
  } catch (error) {
    notify(error.message);
  } finally {
    entry.busy = false;
    if (memoryEvent === entry) updateAssistantControls();
  }
}

let assistantCashPeriod = [];

function assistantPage() {
  const speechAvailable = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const examples = [
    ['films', 'Películas', 'Qual película serve no Moto G60?', 'phone'],
    ['stock', 'Estoque', 'Quais produtos estão com estoque baixo?', 'box'],
    ['cash', 'Fluxo de caixa', 'Qual o saldo do mês passado?', 'wallet'],
    ['sales-summary', 'Vendas', 'Qual foi o lucro das vendas este mês?', 'cart'],
    ['orders', 'Ordens de serviço', 'Quais ordens estão pendentes?', 'clipboard'],
    ['technical', 'Assistência técnica', 'Celular não carrega. O que conferir primeiro?', 'book'],
    ['sales', 'Venda de acessórios', 'Como escolher um carregador para o cliente?', 'book'],
    ['product', 'Cadastrar produto', assistantExamples.product, 'box'],
    ['service', 'Criar ordem de serviço', assistantExamples.service, 'clipboard']
  ];
  return pageHead('Assistente', 'Consulte a loja, peça orientações ou dite um cadastro.') +
    '<div class="assistant-grid"><section class="panel assistant-panel"><div class="assistant-intro"><span class="assistant-icon">' +
    icon('sparkles') + '</span><div><h2>Como posso ajudar na loja?</h2><p>Consulte a base da equipe, o estoque, o caixa, ordens de serviço e películas.</p></div></div>' +
    '<form id="assistant-form" class="assistant-form"><label for="assistant-mode">O que você quer fazer?</label>' +
    '<select id="assistant-mode">' + options([['auto', 'Identificar automaticamente'], ['lookup', 'Consultar a loja'], ['knowledge', 'Consultar guias'], ['product', 'Cadastrar produto'], ['service', 'Criar ordem de serviço']], state.assistantMode) +
    '</select><label for="assistant-text">Seu pedido</label><textarea id="assistant-text" maxlength="1500" required rows="5"' +
    ' placeholder="Ex.: Qual película serve no Moto G60?">' + esc(state.assistantText) + '</textarea>' +
    '<div class="assistant-actions">' + button('Falar', { symbol: 'mic', action: 'voice-toggle', disabled: !speechAvailable }) +
    button('Enviar pedido', { type: 'submit', style: 'primary', symbol: 'sparkles', disabled: state.assistantBusy }) + '</div>' +
    '<p class="assistant-hint">' + (speechAvailable ? 'O navegador pode usar seu serviço de transcrição ao ativar o microfone.' :
      'O microfone está indisponível neste navegador. Digite seu pedido aqui.') + '</p>' +
    '<p id="assistant-status" class="assistant-status" role="status" hidden></p></form><div id="assistant-response" aria-live="polite">' +
    assistantAnswer + '</div><div id="assistant-feedback">' + feedbackMarkup() + '</div></section>' +
    '<aside class="panel assistant-examples"><h2>Experimente um exemplo</h2>' +
    examples.map(([type, label, example, symbol]) => '<button class="assistant-example" type="button" data-action="assist-example" data-id="' +
      type + '" data-example="' + esc(example) + '"><span class="example-icon">' + icon(symbol) + '</span><span><strong>' +
      esc(label) + '</strong><small>' + esc(example) + '</small></span></button>').join('') + '</aside></div>';
}

let microphone;
let assistantMessage = '';
let assistantRun = 0;
let speechPreview = '';

function updateAssistantControls() {
  const status = document.querySelector('#assistant-status');
  if (!status) return;
  status.textContent = assistantMessage;
  status.hidden = !assistantMessage;
  const text = document.querySelector('#assistant-text');
  const mode = document.querySelector('#assistant-mode');
  const voice = document.querySelector('[data-action="voice-toggle"]');
  const confirm = document.querySelector('#assistant-form button[type="submit"]');
  text.readOnly = Boolean(microphone || state.assistantBusy);
  mode.disabled = state.assistantBusy;
  voice.disabled = state.assistantBusy || !(window.SpeechRecognition || window.webkitSpeechRecognition);
  voice.setAttribute('aria-pressed', String(Boolean(microphone)));
  voice.classList.toggle('recording', Boolean(microphone));
  voice.innerHTML = icon(microphone ? 'stop' : 'mic') + (microphone ? 'Parar gravação' : 'Falar');
  confirm.disabled = Boolean(microphone || state.assistantBusy);
  confirm.innerHTML = icon('sparkles') + (state.assistantBusy ? 'Processando…' : 'Enviar pedido');
  const nextText = microphone ? speechPreview : state.assistantText;
  if (text.value !== nextText) text.value = nextText;
  const response = document.querySelector('#assistant-response');
  if (response.innerHTML !== assistantAnswer) response.innerHTML = assistantAnswer;
  const feedback = document.querySelector('#assistant-feedback');
  const nextFeedback = feedbackMarkup();
  if (feedback.innerHTML !== nextFeedback) feedback.innerHTML = nextFeedback;
}

function startAssistant(mode) {
  state.assistantMode = mode;
  if (state.page === 'assistente') render();
  else location.hash = 'assistente';
}

function toggleVoice() {
  if (microphone) {
    microphone.stop();
    return;
  }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return;
  const session = new Recognition();
  microphone = session;
  session.lang = 'pt-BR';
  session.continuous = true;
  session.interimResults = true;
  const prefix = state.assistantText.trim();
  speechPreview = state.assistantText;
  assistantMessage = 'Ativando microfone…';
  session.onstart = () => {
    if (microphone !== session) return;
    assistantMessage = 'Ouvindo… fale em português.';
    updateAssistantControls();
  };
  session.onresult = (event) => {
    if (microphone !== session) return;
    const results = Array.from(event.results);
    const join = (rows) => [prefix, ...rows.map((row) => row[0].transcript.trim())].filter(Boolean).join(' ').slice(0, 1500);
    state.assistantText = join(results.filter((row) => row.isFinal));
    speechPreview = join(results);
    updateAssistantControls();
  };
  session.onerror = (event) => {
    if (microphone !== session) return;
    microphone = null;
    assistantMessage = ['not-allowed', 'service-not-allowed'].includes(event.error) ?
      'Permita o acesso ao microfone nas configurações do navegador ou digite seu pedido.' :
      'Não foi possível transcrever a fala. Tente novamente ou digite seu pedido.';
    updateAssistantControls();
  };
  session.onend = () => {
    if (microphone !== session) return;
    microphone = null;
    assistantMessage = state.assistantText !== prefix ? 'Confira a transcrição e envie o pedido.' : 'Nenhuma fala foi transcrita.';
    updateAssistantControls();
  };
  try {
    session.start();
  } catch {
    microphone = null;
    assistantMessage = 'Não foi possível ativar o microfone. Digite seu pedido.';
  }
  updateAssistantControls();
}

function stopAssistant() {
  const active = microphone;
  microphone = null;
  if (active) active.abort();
  if (state.assistantBusy) assistantRun++;
  state.assistantBusy = false;
  assistantMessage = '';
}

async function prepareDraft() {
  const text = state.assistantText.trim();
  if (state.assistantBusy || microphone || !text) return;
  const run = ++assistantRun;
  state.assistantBusy = true;
  assistantAnswer = '';
  memoryEvent = undefined;
  assistantMessage = 'Identificando os dados do pedido…';
  updateAssistantControls();
  const query = fold(text);
  const salesQuestion = state.assistantMode === 'auto' || state.assistantMode === 'lookup';
  const saleDraft = salesQuestion && /\b(?:registrar|lancar|criar|nova) (?:uma )?venda\b/.test(query) &&
    !/\b(?:como|onde|caixa)\b/.test(query);
  const saleReport = salesQuestion && !/\b(?:como|precificar|calcular|bruto por produto)\b/.test(query) &&
    /\b(?:vendas|vendeu|vendemos|faturamento|lucro das vendas|lucro bruto|margem das vendas)\b/.test(query);
  const action = saleDraft || saleReport ? 'sales' : classifyShopRequest(text, state.assistantMode);
  const learning = prefersKnowledge(text, action, state.assistantMode);
  const topic = action === 'sales' ? 'sale' : topicForRequest(text, learning ? '' : action);
  let outcome = 'unanswered';
  try {
    if (action === 'sales') {
      if (saleDraft) {
        const matches = searchShopRecords(text, state.products, (p) => [p.name, p.code]).filter((p) => p.qty > 0);
        openSaleForm(matches.length === 1 ? matches[0] : undefined);
        outcome = state.products.some((p) => p.qty > 0) ? 'draft' : 'unanswered';
        assistantMessage = outcome === 'draft' ? 'Confira os itens e os valores antes de registrar.' : 'A venda precisa de um produto em estoque.';
        return;
      }
      const [start, end] = monthPeriod(text, today);
      const records = await request('/api/vendas?' + new URLSearchParams({ start, end }));
      if (run !== assistantRun || state.page !== 'assistente') return;
      const total = saleMetrics(records);
      assistantAnswer = answer('Vendas no período', displayDay(start) + ' a ' + displayDay(end),
        '<div class="assistant-totals">' + metric('Faturamento', money(total.amount), 'cart', 'green') +
        metric('Custo', money(total.cost), 'box', 'orange') + metric('Lucro bruto', money(total.profit), 'trend') + '</div>',
        go('Abrir painel de vendas', 'vendas'));
      assistantMessage = '';
      outcome = 'records';
      return;
    }
    if (learning) {
      const data = await loadKnowledge().catch(() => ({ guides: [] }));
      if (run !== assistantRun || state.page !== 'assistente') return;
      const guidance = replyKnowledge(text, topic, data.guides);
      if (guidance) {
        assistantAnswer = guidance;
        assistantMessage = '';
        outcome = 'guide';
        return;
      }
    }
    const opts = { fromAssistant: true };
    if (action === 'guide' || state.assistantMode === 'knowledge' || (learning && topic !== 'general')) {
      const navigationQuestion = /\b(?:cadastr\w*|export\w*|estorn\w*|edit\w*|buscar|consultar)\b/.test(fold(text));
      if (navigationQuestion) {
        assistantAnswer = replyGuide(text);
        outcome = 'guide';
      } else {
        assistantAnswer = answer('Assunto para documentar',
          'Ainda não há um guia aprovado para essa pergunta. O assunto pode entrar nas sugestões da equipe.',
          '', button('Registrar experiência', { action: 'guide-topic', id: topic }));
      }
      assistantMessage = '';
      return;
    }
    if (action === 'film-draft') {
      assistantMessage = 'Informe os modelos indicados para a película e revise antes de salvar.';
      outcome = 'draft';
      showForm('film-add', 'Cadastrar película', filmForm(null, { prefill: false }), null, false, opts);
      return;
    }
    if (action === 'cash-draft') {
      const draft = extractCashInput(text, today);
      assistantMessage = 'Confira os campos antes de salvar.';
      outcome = 'draft';
      showForm('cash-add', draft.kind === 'out' ? 'Revisar saída' : 'Revisar entrada', cashForm(draft), null, false, opts);
      return;
    }
    if (action === 'stock-move') {
      const candidates = searchShopRecords(text, state.products, (p) => [p.code, p.name]);
      assistantMessage = 'Selecione o produto e confira a quantidade antes de salvar.';
      if (state.products.length) outcome = 'draft';
      if (state.products.length) showForm('stock-move', 'Movimentar estoque',
        moveForm(candidates.length === 1 ? candidates[0] : null, /\b(?:saida|baixa|retirar)\b/.test(fold(text)) ? 'out' : 'in'), null, false, opts);
      else assistantAnswer = answer('Cadastre um produto primeiro', 'A movimentação precisa estar vinculada a um produto.', '', go('Abrir estoque', 'estoque'));
      return;
    }
    if (action !== 'draft') {
      const period = action === 'cash' ? monthPeriod(text, today) : [monthStart, monthEnd];
      const records = await request('/api/loja?' + new URLSearchParams({ start: period[0], end: period[1] }));
      if (run !== assistantRun || state.page !== 'assistente') return;
      Object.assign(state, { products: records.products, orders: records.orders, films: records.films });
      const result = action === 'films' ? await replyFilms(text, records) :
        action === 'stock' ? replyStock(text, records) : action === 'orders' ? replyOrders(text, records) :
          action === 'cash' ? replyCash(records, period) : replySummary(records);
      if (run !== assistantRun || state.page !== 'assistente') return;
      if (action === 'cash') assistantCashPeriod = period;
      if (action !== 'films' || result.resolved) outcome = 'records';
      assistantAnswer = action === 'films' ? result.markup : result;
      assistantMessage = '';
      return;
    }
    const draft = await interpretRequest(text, state.assistantMode, today);
    if (run !== assistantRun || state.page !== 'assistente') return;
    if (!draft.type || !Object.keys(draft.fields).length) {
      assistantMessage = 'Informe o tipo de cadastro e descreva um produto ou serviço. Você pode usar um exemplo ao lado.';
      return;
    }
    outcome = 'draft';
    assistantMessage = 'Rascunho preparado. Confira os campos antes de salvar.';
    if (draft.type === 'product') {
      showForm('product-add', 'Revisar novo produto', productForm({ qty: 0, min_qty: 0, cost: 0, price: 0, ...draft.fields }, { newProduct: true }), null, false, opts);
    } else {
      showForm('service-add', 'Revisar ordem de serviço', serviceForm(draft.fields), null, false, opts);
    }
  } catch {
    assistantMessage = 'Não foi possível concluir o pedido. Revise o texto e tente novamente.';
  } finally {
    if (run === assistantRun) {
      recordKnowledgeEvent(topic, outcome);
      state.assistantBusy = false;
      updateAssistantControls();
    }
  }
}

let salesQuery = 0;
const percent = (value) => new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(value);
const salesKpis = (total) => metric('Faturamento de vendas', money(total.amount), 'cart', 'green') +
  metric('Custo dos produtos vendidos', money(total.cost), 'box', 'orange') +
  metric('Lucro bruto', money(total.amount - total.cost), 'trend',
    total.amount < total.cost ? 'rose' : '', 'Faturamento menos custo') +
  metric('Margem bruta', percent(saleMargin(total.amount, total.cost)), 'percent', '', 'Sobre o faturamento');

async function loadSales({ live = false } = {}) {
  const attempt = ++salesQuery;
  const range = { start: state.salesStart, end: state.salesEnd };
  state.salesError = '';
  if (!live) {
    state.salesReady = false;
    if (state.page === 'vendas') render();
  }
  try {
    const data = await request('/api/vendas?' + new URLSearchParams(range));
    if (attempt !== salesQuery) return;
    state.sales = data;
    state.salesReady = true;
  } catch (error) {
    if (attempt !== salesQuery) return;
    if (!live) state.salesError = error.message;
    if (state.page === 'vendas' && !live) render();
    return false;
  }
  if (state.page === 'vendas') render({ live });
  return true;
}

function salesChart(total) {
  const buckets = saleCalendar(total.active, state.salesStart, state.salesEnd);
  const scale = Math.max(1000, ...buckets.flatMap((bucket) => [bucket.amount, bucket.cost]));
  const format = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  const ticks = [1, .75, .5, .25, 0].map((fraction) => '<span>' + format.format(scale * fraction / 100) + '</span>').join('');
  const groups = buckets.map((bucket) => {
    const label = shortDay(bucket.day);
    const bar = (key, type) => '<div class="bar ' + key + '" style="--height:' + 100 * bucket[key] / scale +
      '%" title="' + type + ' ' + esc(money(bucket[key])) + '"></div>';
    return '<div class="group"><div class="bars" role="img" aria-label="' + esc(label + ', faturamento ' +
      money(bucket.amount) + ', custo ' + money(bucket.cost)) + '">' + bar('amount', 'Faturamento') + bar('cost', 'Custo') +
      '</div><small>' + label + '</small></div>';
  }).join('');
  return '<article class="chart-panel sales-chart"><div class="section-head"><div><h2>Vendas no período</h2><small>Valores em R$</small></div>' +
    '<div class="legend"><span><i></i>Faturamento</span><span><i></i>Custo</span></div></div>' +
    '<div class="chart"><div class="axis" aria-hidden="true">' + ticks + '</div><div class="plot" style="--groups:' +
    Math.max(1, buckets.length) + '">' + groups + '</div></div></article>';
}

function salesByProduct(total) {
  if (!total.products.length) return empty('Sem produtos vendidos no período', 'Os itens de vendas ativas entram neste relatório.', 'box');
  return table(['Produto', 'Unidades', 'Custo médio', 'Preço médio', 'Faturamento', 'Lucro bruto', 'Margem'], total.products.map((p) =>
    '<tr><td><strong>' + esc(p.name) + '</strong><small>' + esc(p.code) + '</small></td><td>' + number(p.qty) + ' ' + esc(p.unit) +
    '</td><td class="money">' + money(Math.round(p.cost / p.qty)) + '</td><td class="money">' +
    money(Math.round(p.amount / p.qty)) + '</td><td class="money">' + money(p.amount) + '</td><td class="money ' +
    (p.amount < p.cost ? 'out' : 'in') + '">' + money(p.amount - p.cost) + '</td><td>' +
    percent(saleMargin(p.amount, p.cost)) + '</td></tr>'));
}

function salesHistory() {
  const products = new Map();
  for (const line of state.sales.items) {
    if (!products.has(line.sale_id)) products.set(line.sale_id, []);
    products.get(line.sale_id).push(line.name + ' ' + line.code);
  }
  const filtered = state.sales.sales.filter((sale) =>
    (state.saleStatus === 'all' || Boolean(sale.voided_at) === (state.saleStatus === 'void')) &&
    matches(state.saleSearch, [saleNumber(sale), sale.payment, sale.customer,
      ...(products.get(sale.id) || [])]));
  if (!filtered.length) return empty('Nenhuma venda encontrada', 'Registre uma venda ou ajuste os filtros.', 'cart');
  return table(['Venda', 'Data', 'Pagamento', 'Faturamento', 'Custo', 'Lucro bruto', 'Situação', 'Detalhes'], filtered.map((sale) =>
    '<tr><td><strong>' + saleNumber(sale) + '</strong>' + (sale.customer ? '<small>' + esc(sale.customer) + '</small>' : '') +
    '</td><td>' + displayDay(sale.day) + '</td><td>' + esc(sale.payment) + '</td><td class="money">' + money(sale.amount) +
    '</td><td class="money">' + money(sale.cost) + '</td><td class="money ' + (sale.amount < sale.cost ? 'out' : 'in') + '">' +
    money(sale.amount - sale.cost) + '</td><td>' + chip(sale.voided_at ? 'Estornada' : 'Registrada', sale.voided_at ? '' : 'green') +
    '</td><td>' + button('Ver venda', { action: 'sale-view', id: sale.id, style: 'text' }) + '</td></tr>'));
}

function salesPage() {
  const hasStock = state.products.some((p) => p.qty > 0);
  const base = pageHead('Vendas', 'Registre a venda uma vez e acompanhe estoque, caixa e margem.',
    button('Nova venda', { symbol: 'plus', action: 'sale-add', style: 'primary', disabled: !hasStock })) +
    '<form class="period" id="sales-period"><div class="controls inline"><label>Data inicial<input type="date" name="start" required value="' +
    esc(state.salesStart) + '"></label><label>Data final<input type="date" name="end" required value="' + esc(state.salesEnd) +
    '"></label><div class="actions">' + button('Aplicar período', { type: 'submit' }) +
    button('Este mês', { action: 'sales-month' }) + button('Hoje', { action: 'sales-today' }) + '</div></div></form>';
  if (!state.salesReady) return base + (state.salesError ? '<div class="notice" role="status">' + esc(state.salesError) + '</div>' :
    '<p class="loading" role="status">Carregando vendas…</p>');
  const total = saleMetrics(state.sales);
  const paymentRows = total.payments.map((p) => '<li><div><strong>' + esc(p.name) + '</strong><small>' + number(p.count) +
    (p.count === 1 ? ' venda' : ' vendas') + '</small></div><strong class="money">' + money(p.amount) + '</strong></li>').join('');
  return base + (!hasStock ? '<p class="sales-hint">Para registrar uma venda, <a href="#estoque">cadastre ou reponha um produto no estoque</a>.</p>' : '') +
    '<div class="metrics">' + salesKpis(total) + '</div><div class="metrics three">' +
    metric('Vendas registradas', number(total.count), 'receipt', 'green') + metric('Itens vendidos', number(total.units), 'box') +
    metric('Ticket médio', money(total.average), 'wallet') + '</div><div class="overview-grid">' + salesChart(total) +
    '<article class="panel"><div class="section-head"><h2>Recebimentos por forma de pagamento</h2></div>' +
    (paymentRows ? '<ul class="alert-list">' + paymentRows + '</ul>' : empty('Sem pagamentos no período',
      'A divisão por forma de pagamento aparece após a primeira venda.', 'wallet')) + '</article></div>' +
    '<section class="panel sales-section"><div class="section-head"><h2>Desempenho por produto</h2></div>' + salesByProduct(total) +
    '</section><section class="panel sales-section"><div class="section-head"><h2>Histórico de vendas</h2>' +
    button('Exportar CSV', { action: 'sales-export', symbol: 'download', disabled: !state.sales.sales.length }) +
    '</div><div class="controls">' + search('saleSearch', 'Buscar venda, produto ou cliente', state.saleSearch) +
    '<select id="saleStatus" aria-label="Situação da venda">' + options([['all', 'Todas as vendas'], ['active', 'Registradas'],
      ['void', 'Estornadas']], state.saleStatus) + '</select></div><div id="sales-history">' + salesHistory() + '</div></section>';
}

function exportSales() {
  const parent = new Map(state.sales.sales.map((sale) => [sale.id, sale]));
  exportCsv('vendas-tech-place-store.csv',
    ['Venda', 'Data', 'Situação', 'Pagamento', 'SKU', 'Produto', 'Quantidade', 'Custo unitário', 'Preço unitário', 'Receita', 'Lucro bruto'],
    state.sales.items.map((item) => {
      const sale = parent.get(item.sale_id);
      return [saleNumber(sale), sale.day, sale.voided_at ? 'Estornada' : 'Registrada', sale.payment, item.code, item.name, item.qty,
        decimal(item.unit_cost), decimal(item.unit_price), decimal(item.qty * item.unit_price), decimal(item.qty * (item.unit_price - item.unit_cost))];
    }));
}

function saleItemRow(selected) {
  const available = state.products.filter((p) => p.qty > 0);
  return '<fieldset class="sale-line" data-sale-line><label class="sale-product">Produto<select name="item_product" required>' +
    options([['', 'Selecione um produto'], ...available.map((p) => [p.id, p.name + ' · ' + p.code + ' (' + p.qty + ' em estoque)'])],
      selected?.id || '') + '</select></label>' +
    '<label>Qtd.<input name="item_qty" type="number" min="1" max="' + (selected?.qty ?? 100000000) + '" value="1" required></label>' +
    amountField('Custo un. (R$)', 'item_cost', selected?.cost) + amountField('Venda un. (R$)', 'item_price', selected?.price) +
    '<button class="icon-button" type="button" data-action="sale-remove-line" aria-label="Remover produto da venda">' + icon('close') +
    '</button></fieldset>';
}

function saleForm(product) {
  return '<div class="full sale-cart"><div id="sale-lines">' + saleItemRow(product) + '</div>' +
    button('Adicionar produto', { action: 'sale-add-line', symbol: 'plus' }) +
    '<p class="sales-hint">Os valores vêm do cadastro e podem ser ajustados para esta venda.</p></div>' +
    textField('Data da venda', 'day', today, { type: 'date', required: true }) +
    selectField('Forma de pagamento', 'payment', payments, 'Pix') +
    textField('Cliente', 'customer', '', { max: 100, full: true }) + notes() +
    '<div class="full sale-totals" id="sale-totals" role="status"></div>';
}

function saleLines(form, force) {
  return Array.from(form.querySelectorAll('[data-sale-line]'), (line) => {
    const input = (name) => line.querySelector('[name="' + name + '"]').value;
    const price = (name) => {
      const value = input(name);
      return force || value.trim() ? cents(value) : 0;
    };
    return { product_id: input('item_product'), qty: Number(input('item_qty')), unit_cost: price('item_cost'), unit_price: price('item_price') };
  });
}

function updateSaleForm() {
  const form = dialog.querySelector('form[data-form="sale-add"]');
  if (!form) return;
  const remove = form.querySelectorAll('[data-action="sale-remove-line"]');
  for (const button of remove) button.disabled = remove.length < 2;
  form.querySelector('[data-action="sale-add-line"]').disabled = remove.length >= 20;
  const totals = form.querySelector('#sale-totals');
  try {
    const lines = saleLines(form, false);
    const amount = lines.reduce((sum, line) => sum + line.qty * line.unit_price, 0);
    const cost = lines.reduce((sum, line) => sum + line.qty * line.unit_cost, 0);
    totals.innerHTML = '<span>Faturamento<strong>' + money(amount) + '</strong></span><span>Custo<strong>' + money(cost) +
      '</strong></span><span>Lucro bruto<strong>' + money(amount - cost) + '</strong></span>';
  } catch {
    totals.textContent = 'Confira os valores dos itens.';
  }
}

function openSaleForm(product) {
  const available = state.products.some((p) => p.qty > 0);
  if (!available) { notify('Cadastre ou reponha um produto antes de registrar a venda.'); return; }
  if (product && !product.qty) { notify('Este produto está sem estoque.'); return; }
  showForm('sale-add', 'Nova venda', saleForm(product), null, false, { submitLabel: 'Registrar venda' });
  dialog.classList.add('wide');
  updateSaleForm();
}

function showSaleDetails(sale, items) {
  const detail = details([
    ['Data da venda', displayDay(sale.day)], ['Pagamento', sale.payment], ['Cliente', sale.customer],
    ['Faturamento', money(sale.amount)], ['Custo', money(sale.cost)], ['Lucro bruto', money(sale.amount - sale.cost)],
    ['Margem bruta', percent(saleMargin(sale.amount, sale.cost))], ['Situação', sale.voided_at ? 'Estornada' : 'Registrada'],
    ['Registrada por', sale.actor], ['Motivo do estorno', sale.void_reason], ['Observações', sale.notes]
  ]);
  const rows = items.map((line) => '<tr><td><strong>' + esc(line.name) + '</strong><small>' + esc(line.code) + '</small></td><td>' +
    number(line.qty) + ' ' + esc(line.unit) + '</td><td class="money">' + money(line.unit_cost) + '</td><td class="money">' +
    money(line.unit_price) + '</td><td class="money">' + money(line.qty * (line.unit_price - line.unit_cost)) + '</td></tr>');
  showDialog('Venda ' + saleNumber(sale), detail + '<h3>Itens da venda</h3>' +
    table(['Produto', 'Qtd.', 'Custo unitário', 'Preço unitário', 'Lucro bruto'], rows),
    button('Fechar', { action: 'dialog-close' }) + (sale.voided_at ? '' : button('Estornar venda', { action: 'sale-void', id: sale.id })));
  dialog.classList.add('wide');
}

async function openSaleDetails(id) {
  try {
    const data = await request('/api/vendas?' + new URLSearchParams({ id }));
    showSaleDetails(data.sales[0], data.items);
  } catch (error) { notify(error.message); }
}

function updateRows() {
  const pr = document.querySelector('#product-rows');
  if (pr) pr.innerHTML = productRows();
  const cr = document.querySelector('#cash-rows');
  if (cr) cr.innerHTML = cashRows();
  const orderList = document.querySelector('#order-rows');
  if (orderList) orderList.innerHTML = orderRows();
  const guideList = document.querySelector('#guide-results');
  if (guideList) guideList.innerHTML = guideCards();
  const saleList = document.querySelector('#sales-history');
  if (saleList) saleList.innerHTML = salesHistory();
}

async function saveForm(event) {
  if (dialog.dataset.saving) return;
  const form = event.target;
  const fromAssistant = dialog.dataset.fromAssistant === 'true';
  const action = form.dataset.form;
  const error = form.querySelector('.notice');
  error.hidden = true;
  const data = Object.fromEntries(new FormData(form));
  try {
    const files = Array.from(form.querySelector('[data-service-files]')?.files || []);
    const attachments = files.length ? prepareMediaJobs(files) : [];
    if (action === 'sale-add') {
      data.items = saleLines(form, true);
      for (const key of ['item_product', 'item_qty', 'item_cost', 'item_price']) delete data[key];
    }
    for (const key of ['cost', 'price', 'amount']) {
      if (key in data) data[key] = action.startsWith('service-') && !data[key].trim() ? null : cents(data[key]);
    }
    for (const key of ['qty', 'min_qty']) if (key in data) data[key] = Number(data[key]);
    Object.assign(data, { action, id: dialog.dataset.id, revision: dialog.dataset.revision, operation: dialog.dataset.operation });
    dialog.dataset.saving = 'true';
    for (const button of form.querySelectorAll('button')) button.disabled = true;
    await request('/api/loja', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    dialog.close();
    if (action.endsWith('-delete')) {
      notify('Registro excluído.');
      if (action === 'guide-delete') await refreshKnowledge();
      else await load();
      return;
    }
    if (attachments.length) {
      mediaQueues.set(data.id, [...(mediaQueues.get(data.id) || []), ...attachments]);
      notify('Ordem de serviço salva.');
      await load();
      const saved = state.orders.find((order) => order.id === data.id);
      if (fromAssistant) {
        state.assistantText = '';
        assistantAnswer = '';
        assistantMessage = '';
        memoryEvent = undefined;
        location.hash = 'servicos';
      }
      if (saved) orderDetails(saved);
      void uploadOrderMedia(data.id);
      return;
    }
    if (['cash-add', 'cash-edit'].includes(action) && (data.day < state.start || data.day > state.end)) {
      state.start = data.day < state.start ? data.day : state.start;
      state.end = data.day > state.end ? data.day : state.end;
    }
    if (action === 'film-add') Object.assign(state, {
      filmQuery: data.models.split(/\r?\n/).find((model) => model.trim())?.trim() || '',
      filmCompare: '', filmBrand: '', filmType: '', filmStore: true
    });
    if (action.startsWith('sale-')) {
      if (data.day && (data.day < state.salesStart || data.day > state.salesEnd)) {
        state.salesStart = data.day < state.salesStart ? data.day : state.salesStart;
        state.salesEnd = data.day > state.salesEnd ? data.day : state.salesEnd;
      }
      notify(action === 'sale-void' ? 'Venda estornada. Estoque e caixa atualizados.' : 'Venda registrada no estoque e no caixa.');
      if (action === 'sale-add' && state.page !== 'vendas') location.hash = 'vendas';
      else {
        if (state.page === 'vendas') void loadSales();
        await load();
      }
      return;
    }
    if (action.startsWith('guide-')) {
      state.knowledgeStatus = data.status;
      state.knowledgeSearch = '';
      state.knowledgeArea = '';
      notify(data.status === 'published' ? 'Guia aprovado e disponível ao assistente.' : 'Rascunho salvo.');
      if (state.page === 'conhecimento') await refreshKnowledge();
      else location.hash = 'conhecimento';
      return;
    }
    notify(action === 'cash-void' ? 'Lançamento estornado.' : 'Registro salvo.');
    if (fromAssistant) {
      state.assistantText = '';
      assistantMessage = '';
      assistantAnswer = '';
      memoryEvent = undefined;
      if (action === 'product-add') {
        state.stockTab = 'products';
        state.productSearch = '';
        state.productCategory = '';
        state.productStatus = '';
      } else {
        state.orderSearch = '';
        state.orderStatus = '';
      }
      const destinations = { 'product-add': 'estoque', 'stock-move': 'estoque', 'service-add': 'servicos',
        'film-add': 'peliculas', 'cash-add': 'caixa' };
      if (action === 'stock-move') state.stockTab = 'movements';
      location.hash = destinations[action] || 'inicio';
    } else {
      await load();
    }
  } catch (failure) {
    error.textContent = failure.message;
    error.hidden = false;
  } finally {
    delete dialog.dataset.saving;
    for (const button of form.querySelectorAll('button')) button.disabled = false;
  }
}

function confirmDeletion(action, record, title, explanation) {
  if (record) showForm(action, title, '<p>' + explanation + '</p>', record, true, { submitLabel: 'Confirmar exclusão' });
}

function handleAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  const product = id && state.products.find((p) => p.id === id);
  const cash = id && id.length === 36 && state.cash.find((e) => e.id === id);
  const order = id && id.length === 36 && state.orders.find((entry) => entry.id === id);
  const film = id && id.length === 36 && state.films.find((entry) => entry.id === id);
  switch (action) {
    case 'sale-add': openSaleForm(product); break;
    case 'sale-view': openSaleDetails(id); break;
    case 'sale-void': showForm('sale-void', 'Estornar venda',
      '<p class="full">O estorno devolve os itens ao estoque e retira a entrada do saldo do caixa.</p>' +
      textField('Motivo do estorno', 'reason', '', { required: true, full: true }), { id }, false, { submitLabel: 'Confirmar estorno' }); break;
    case 'sale-add-line':
      if (dialog.querySelectorAll('[data-sale-line]').length < 20) {
        dialog.querySelector('#sale-lines').insertAdjacentHTML('beforeend', saleItemRow());
        updateSaleForm();
        dialog.querySelector('[data-sale-line]:last-child select').focus();
      }
      break;
    case 'sale-remove-line':
      if (dialog.querySelectorAll('[data-sale-line]').length > 1) { button.closest('[data-sale-line]').remove(); updateSaleForm(); }
      break;
    case 'sales-month': state.salesStart = monthStart; state.salesEnd = monthEnd; loadSales(); break;
    case 'sales-today': state.salesStart = today; state.salesEnd = today; loadSales(); break;
    case 'sales-export': exportSales(); break;
    case 'product-add': showForm(action, 'Novo produto', productForm()); break;
    case 'product-edit': if (product) showForm(action, 'Editar produto', productForm(product), product); break;
    case 'product-delete': confirmDeletion(action, product, 'Excluir produto',
      'O produto sairá do estoque ativo. As vendas e movimentações anteriores ficam no histórico.'); break;
    case 'product-view': if (product) productDetails(product); break;
    case 'stock-move': showForm(action, 'Movimentar estoque', moveForm(product)); break;
    case 'cash-add': showForm(action, 'Nova entrada', cashForm(null, 'in')); break;
    case 'cash-out': showForm('cash-add', 'Nova saída', cashForm(null, 'out')); break;
    case 'cash-edit': if (cash) showForm(action, 'Editar lançamento', cashForm(cash), cash); break;
    case 'cash-view': if (cash) cashDetails(cash); break;
    case 'cash-void':
      if (cash) showForm(action, 'Estornar lançamento', '<p>O lançamento continuará no histórico como estornado e será retirado do saldo.</p>', cash, true);
      break;
    case 'service-add': showForm(action, 'Nova ordem de serviço', serviceForm()); break;
    case 'service-view': if (order) orderDetails(order); break;
    case 'service-edit': if (order) showForm(action, 'Editar ordem de serviço', serviceForm(order), order); break;
    case 'service-delete': confirmDeletion(action, order, 'Excluir ordem de serviço',
      'A ordem e seus anexos sairão da lista de atendimento.'); break;
    case 'media-upload': {
      const picker = activeMediaPanel(id)?.querySelector('[data-media-picker]');
      if (picker) {
        const files = Array.from(picker.files);
        if (files.length) picker.value = '';
        uploadOrderMedia(id, files);
      }
      break;
    }
    case 'media-retry': uploadOrderMedia(id); break;
    case 'media-remove': removeOrderMedia(dialog.querySelector('[data-order-media]')?.dataset.orderMedia, id); break;
    case 'film-add': showForm(action, 'Cadastrar película', filmForm()); break;
    case 'film-edit': if (film) showForm(action, 'Editar película', filmForm(film), film); break;
    case 'film-delete': confirmDeletion(action, film, 'Excluir película',
      'A película da loja deixará de aparecer na consulta de compatibilidade.'); break;
    case 'film-select':
      state.filmQuery = id;
      document.querySelector('#film-query').value = id;
      refreshFilmResults();
      break;
    case 'film-select-compare':
      state.filmCompare = id;
      document.querySelector('#film-compare').value = id;
      refreshFilmResults();
      break;
    case 'guide-add': openGuideDraft(state.knowledgeArea === 'sales' ? 'sale' : 'intake'); break;
    case 'guide-topic': openGuideDraft(id); break;
    case 'guide-from-order':
      if (order) {
        const topic = topicForRequest(order.title);
        openGuideDraft(knowledgeTopics[topic]?.area === 'technical' ? topic : 'delivery');
      }
      break;
    case 'guide-view': {
      const guide = guideItems().find((item) => item.id === id && item.status === 'published');
      if (guide) viewGuide(guide);
      break;
    }
    case 'guide-edit': {
      const guide = knowledge?.guides.find((item) => item.id === id);
      if (guide) showForm(action, 'Revisar guia', guideForm(guide), guide);
      break;
    }
    case 'guide-delete': confirmDeletion(action, knowledge?.guides.find((item) => item.id === id), 'Excluir guia',
      'O guia sairá da base de conhecimento e das consultas do assistente.'); break;
    case 'knowledge-published': state.knowledgeStatus = 'published'; render(); break;
    case 'knowledge-drafts': state.knowledgeStatus = 'draft'; render(); break;
    case 'feedback-helpful': saveFeedback('helpful'); break;
    case 'feedback-improve': saveFeedback('improve'); break;
    case 'assist-product': startAssistant('product'); break;
    case 'assist-service': startAssistant('service'); break;
    case 'assist-films-result': openFilmSearch(...assistantFilmPair); break;
    case 'assist-cash-period':
      [state.start, state.end] = assistantCashPeriod;
      location.hash = 'caixa';
      break;
    case 'assist-example':
      if (!microphone && !state.assistantBusy) {
        state.assistantMode = ['product', 'service'].includes(id) ? id : 'auto';
        state.assistantText = button.dataset.example;
        assistantAnswer = '';
        memoryEvent = undefined;
        assistantMessage = '';
        render();
        document.querySelector('#assistant-text').focus();
      }
      break;
    case 'voice-toggle': toggleVoice(); break;
    case 'dialog-close': if (!dialog.dataset.saving) dialog.close(); break;
    case 'tab-products': state.stockTab = 'products'; render(); break;
    case 'tab-movements': state.stockTab = 'movements'; render(); break;
    case 'export-stock': exportStock(); break;
    case 'export-cash': exportCash(); break;
    case 'this-month': state.start = monthStart; state.end = monthEnd; load(); break;
  }
}

function route() {
  setMobileMenu(false);
  const page = location.hash.slice(1);
  if (state.page === 'assistente' && page !== 'assistente') stopAssistant();
  state.page = Object.hasOwn(labels, page) ? page : 'inicio';
  if (state.page === 'precos') {
    setError();
    if (partsPricing) void partsPricing.refreshPrices();
    render();
    return;
  }
  if (['peliculas', 'conhecimento', 'assistente'].includes(state.page)) document.querySelector('#more-tools').open = true;
  if (!state.ready || ['estoque', 'vendas', 'servicos', 'peliculas', 'conhecimento', 'assistente'].includes(state.page)) render({ loading: true });
  if (state.page === 'conhecimento') refreshKnowledge();
  if (state.page === 'vendas') loadSales();
  if (state.page === 'peliculas') {
    loadFilmCatalog().then(() => { if (state.page === 'peliculas' && state.ready) render(); })
      .catch(() => refreshFilmResults());
  }
  load();
}

mobileMenu.addEventListener('click', () => setMobileMenu(mobileMenu.getAttribute('aria-expanded') !== 'true'));
primaryNav.addEventListener('click', (event) => {
  if (!event.target.closest('[data-page]')) return;
  if (mobileMenu.getAttribute('aria-expanded') === 'true') {
    setMobileMenu(false);
    document.querySelector('#main').focus({ preventScroll: true });
  }
  window.scrollTo?.(0, 0);
});
primaryNav.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && mobileMenu.getAttribute('aria-expanded') === 'true') {
    setMobileMenu(false);
    mobileMenu.focus();
  }
});
document.addEventListener('click', handleAction);
document.addEventListener('submit', (event) => {
  event.preventDefault();
  if (event.target.id === 'period') {
    const values = new FormData(event.target);
    const start = values.get('start');
    const end = values.get('end');
    if (start > end) { setError('A data final deve ser igual ou posterior à inicial.'); return; }
    Object.assign(state, { start, end });
    load();
  } else if (event.target.id === 'sales-period') {
    const values = new FormData(event.target);
    const start = values.get('start');
    const end = values.get('end');
    if (start > end) { setError('A data final deve ser igual ou posterior à inicial.'); return; }
    setError();
    Object.assign(state, { salesStart: start, salesEnd: end });
    loadSales();
  } else if (event.target.id === 'film-search-form') refreshFilmResults();
  else if (event.target.id === 'assistant-form') prepareDraft();
  else if (event.target.dataset.form) saveForm(event);
});
document.addEventListener('input', (event) => {
  if (event.target.name?.startsWith('item_')) updateSaleForm();
  if (event.target.id === 'assistant-text') state.assistantText = event.target.value;
  if (event.target.id === 'film-query' || event.target.id === 'film-compare') {
    state[event.target.id === 'film-query' ? 'filmQuery' : 'filmCompare'] = event.target.value;
    refreshFilmResults();
  }
  if (['productSearch', 'cashSearch', 'orderSearch', 'knowledgeSearch', 'saleSearch'].includes(event.target.id)) {
    state[event.target.id] = event.target.value;
    updateRows();
  }
});
document.addEventListener('change', (event) => {
  if (['filmBrand', 'filmType', 'filmStore'].includes(event.target.id)) {
    state[event.target.id] = event.target.id === 'filmStore' ? event.target.checked : event.target.value;
    refreshFilmResults();
  }
  if (event.target.name === 'item_product') {
    const line = event.target.closest('[data-sale-line]');
    const product = state.products.find((p) => p.id === event.target.value);
    line.querySelector('[name=item_cost]').value = product ? decimal(product.cost) : '';
    line.querySelector('[name=item_price]').value = product ? decimal(product.price) : '';
    line.querySelector('[name=item_qty]').max = product?.qty ?? 100000000;
    updateSaleForm();
  }
  if (event.target.id === 'saleStatus') { state.saleStatus = event.target.value; updateRows(); }
  if (event.target.id === 'knowledgeArea') { state.knowledgeArea = event.target.value; updateRows(); }
  if (event.target.id === 'assistant-mode') state.assistantMode = event.target.value;
  if (['productCategory', 'productStatus', 'cashType', 'cashStatus', 'orderStatus'].includes(event.target.id)) {
    state[event.target.id] = event.target.value;
    updateRows();
  }
  if (event.target.name === 'kind' && dialog.querySelector('#cash-categories')) {
    dialog.querySelector('#cash-categories').innerHTML = options(categoryPresets[event.target.value]);
    dialog.querySelector('#dialog-title').textContent = dialog.querySelector('form').dataset.form === 'cash-edit'
      ? 'Editar lançamento' : event.target.value === 'in' ? 'Nova entrada' : 'Nova saída';
  }
});
dialog.addEventListener('cancel', (event) => {
  if (dialog.dataset.saving) event.preventDefault();
});
document.querySelector('#refresh').addEventListener('click', () => {
  if (state.page === 'precos') { void partsPricing.refresh(); return; }
  if (state.page === 'conhecimento') refreshKnowledge();
  if (state.page === 'vendas') loadSales();
  load({ feedback: true });
});
void startSession({ request, notify, openStore() {
  signedIn = true;
  universalAgent.start();
  window.addEventListener('hashchange', route);
  document.addEventListener('visibilitychange', syncPanel);
  window.addEventListener('online', syncPanel);
  route();
  syncTimer = setTimeout(syncPanel, 2500);
} });
