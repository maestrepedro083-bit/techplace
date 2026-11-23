const pageSize = 24;
const nameOrder = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

export function createPartsPricing({ amountField, cents, displayDay, esc, fold, money, notify, number, options, pageHead, request }) {
  const element = document.createElement('div');
  element.className = 'parts-page';
  element.innerHTML = pageHead('Preços de peças', '',
    '<button class="btn primary" id="parts-add" type="button" disabled>Adicionar peça</button>') +
    '<section class="panel parts-catalog" aria-label="Catálogo de peças">' +
      '<div class="parts-filters">' +
        '<label class="parts-query">Peça ou modelo<input type="search" id="parts-search" placeholder="Ex.: iPhone 14 Plus"></label>' +
        '<label>Categoria<select id="parts-category"><option value="">Todas</option></select></label>' +
        '<label>Fornecedor<select id="parts-supplier"><option value="">Todos</option></select></label>' +
      '</div>' +
      '<p id="parts-result-count" class="parts-meta" role="status"></p>' +
      '<div id="parts-results" aria-busy="true"></div>' +
      '<div id="parts-pages" class="parts-pagination" aria-label="Paginação" hidden>' +
        '<button type="button" class="btn" id="parts-prev">Anterior</button>' +
        '<span id="parts-page-number" class="parts-meta"></span>' +
        '<button type="button" class="btn" id="parts-next">Próxima</button>' +
      '</div>' +
      '<details id="parts-sources" class="parts-sources" hidden><summary>Fontes dos preços</summary><ul></ul></details>' +
    '</section>' +
    '<dialog id="parts-editor" aria-labelledby="parts-editor-title"></dialog>';

  const byId = (id) => element.querySelector('#parts-' + id);
  const query = byId('search');
  const category = byId('category');
  const supplier = byId('supplier');
  const sources = byId('sources');
  const results = byId('results');
  const count = byId('result-count');
  const pages = byId('pages');
  const add = byId('add');
  const editor = byId('editor');

  let catalog = [];
  let vendors = [];
  let categories = [];
  let saved = new Map();
  let byKey = new Map();
  let page = 0;
  let catalogStatus = 'loading';
  let catalogRequest = 0;
  let priceRequest = 0;

  const normalize = (text) => fold(text).replaceAll('+', ' plus ').replace(/[^a-z0-9]+/g, ' ').trim();

  function safeHref(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch {
      return '';
    }
  }

  function renderResults() {
    add.disabled = catalogStatus !== 'ready';
    results.setAttribute('aria-busy', String(catalogStatus === 'loading'));
    if (catalogStatus !== 'ready') {
      count.textContent = '';
      pages.hidden = true;
      results.innerHTML = catalogStatus === 'loading'
        ? '<p class="parts-message">Carregando peças…</p>'
        : '<p class="parts-message">Não foi possível carregar os preços. <button class="btn text" type="button" id="parts-retry">Tentar novamente</button></p>';
      byId('retry')?.addEventListener('click', refresh);
      return;
    }
    const catalogParts = catalog.map((part) => {
      const row = saved.get(part.part_key);
      return { ...part, cost: row?.cost ?? part.sourceCost, servicePrice: row?.service_price ?? null, revision: row?.revision ?? 0 };
    });
    const manualParts = [...saved.values()].filter((part) => part.name != null).map((part) => ({
      ...part, manual: true, servicePrice: part.service_price
    }));
    const all = [...catalogParts, ...manualParts].sort((a, b) => Number(a.cost == null) - Number(b.cost == null) || nameOrder.compare(a.name, b.name));
    byKey = new Map(all.map((part) => [part.part_key, part]));
    const words = normalize(query.value).split(' ').filter(Boolean);
    const selectedCategory = category.value;
    const selectedSupplier = supplier.value;
    const matches = all.filter((part) => {
      if ((selectedCategory && selectedCategory !== part.category) || (selectedSupplier && selectedSupplier !== part.supplier)) return false;
      if (!words.length) return true;
      const search = normalize([part.name, part.category, part.section, part.supplier].join(' '));
      return words.every((word) => search.includes(word));
    });
    const totalPages = Math.max(1, Math.ceil(matches.length / pageSize));
    page = Math.min(page, totalPages - 1);
    count.textContent = number(matches.length) + (matches.length === 1 ? ' peça' : ' peças');
    pages.hidden = totalPages <= 1;
    byId('page-number').textContent = 'Página ' + number(page + 1) + ' de ' + number(totalPages);
    byId('prev').disabled = page === 0;
    byId('next').disabled = page + 1 >= totalPages;
    if (!matches.length) {
      results.innerHTML = '<p class="parts-message">' + (selectedSupplier === 'Diamonds Parts' && !all.some((part) => part.supplier === selectedSupplier)
        ? 'Use Adicionar peça para cadastrar os preços da Diamonds Parts.'
        : 'Nenhuma peça encontrada.') + '</p>';
      return;
    }
    const context = document.activeElement?.dataset.partKey;
    const visible = matches.slice(page * pageSize, (page + 1) * pageSize);
    results.innerHTML = '<div class="parts-columns" aria-hidden="true"><span>Peça</span><span>Custo</span><span>Troca completa</span><span></span></div>' +
      '<ul class="parts-list">' + visible.map((part) => {
        const name = part.href ? '<a href="' + esc(part.href) + '" target="_blank" rel="noopener noreferrer">' + esc(part.name) + '</a>' : esc(part.name);
        const cost = part.cost == null ? (part.manual ? '—' : 'Sob consulta') : money(part.cost);
        const servicePrice = part.servicePrice == null ? '—' : money(part.servicePrice);
        return '<li><div class="parts-item"><strong>' + name + '</strong><small>' +
          esc(part.category + ' · ' + part.supplier) +
          '</small></div><span class="parts-value"><span>Custo</span><strong>' + esc(cost) + '</strong></span>' +
          '<span class="parts-value"><span>Troca completa</span><strong>' + esc(servicePrice) + '</strong></span>' +
          '<button type="button" class="btn" data-part-key="' + esc(part.part_key) +
          '" aria-label="Editar ' + esc(part.name) + '">Editar</button></li>';
      }).join('') + '</ul>';
    if (context) results.querySelector('[data-part-key="' + CSS.escape(context) + '"]')?.focus({ preventScroll: true });
  }

  async function refreshPrices() {
    const attempt = ++priceRequest;
    try {
      const data = await request('/api/precos');
      if (attempt !== priceRequest) return true;
      saved = new Map(data.prices.map((part) => [part.part_key, part]));
      if (!categories.length) {
        categories = data.categories;
        category.innerHTML = options([['', 'Todas'], ...categories], category.value);
      }
      if (catalogStatus === 'ready') renderResults();
      return true;
    } catch {
      return attempt !== priceRequest;
    }
  }

  async function refresh() {
    const attempt = ++catalogRequest;
    catalogStatus = 'loading';
    sources.hidden = true;
    renderResults();
    try {
      const [data, loaded] = await Promise.all([request('/parts-catalog.json'), refreshPrices()]);
      if (attempt !== catalogRequest) return;
      if (!loaded) throw Error();
      vendors = data.map((vendor) => vendor.name);
      catalog = data.flatMap((vendor) => vendor.products.map((part) => ({
        part_key: part.href, name: part.name, sourceCost: part.cost, category: part.category,
        section: part.section, supplier: vendor.name, href: safeHref(part.href)
      })));
      supplier.innerHTML = options([['', 'Todos'], ...vendors], supplier.value);
      sources.querySelector('ul').innerHTML = data.map((vendor) => {
        const url = safeHref(vendor.url);
        const name = url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(vendor.name) + '</a>' : esc(vendor.name);
        const info = vendor.checkedOn ? 'consulta em ' + displayDay(vendor.checkedOn) : 'cadastro manual';
        return '<li>' + name + '<span>' + esc(info) + '</span></li>';
      }).join('');
      sources.hidden = !data.length;
      catalogStatus = 'ready';
    } catch {
      if (attempt !== catalogRequest) return;
      catalogStatus = 'error';
    }
    renderResults();
  }

  function openEditor(part) {
    const key = part?.part_key || 'manual:' + crypto.randomUUID();
    const manual = part?.manual ?? !part;
    const editing = part != null;
    const selectedCategory = part?.category || category.value || categories[0];
    const selectedSupplier = part?.supplier || supplier.value || vendors[0];
    editor.innerHTML = '<form>' +
      '<div class="dialog-head"><h2 id="parts-editor-title">' + (editing ? 'Editar valores' : 'Adicionar peça') + '</h2></div>' +
      '<div class="dialog-content">' +
      (manual ? '<label class="parts-field">Nome da peça<input name="name" maxlength="160" required value="' + esc(part?.name) + '"></label>' +
        '<div class="form-grid"><label>Categoria<select name="category" required>' + options(categories, selectedCategory) +
        '</select></label><label>Fornecedor<select name="supplier" required>' + options(vendors, selectedSupplier) + '</select></label></div>'
        : '<p class="parts-editor-name">' + esc(part.name) + '</p>') +
      '<div class="form-grid">' +
        amountField('Custo da peça (R$)', 'cost', part?.cost, false) +
        amountField('Troca completa (R$)', 'service_price', part?.servicePrice, false) +
      '</div><p class="notice" role="alert" hidden></p></div>' +
      '<div class="dialog-footer"><button type="button" class="btn" id="parts-cancel">Cancelar</button>' +
      '<button type="submit" class="btn primary">Salvar</button></div></form>';
    const form = editor.querySelector('form');
    const errorBox = form.querySelector('.notice');
    byId('cancel').addEventListener('click', () => editor.close());

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (editor.dataset.saving) return;
      errorBox.hidden = true;
      const data = Object.fromEntries(new FormData(form));
      try {
        const readAmount = (value) => value.trim() ? cents(value) : null;
        const cost = readAmount(data.cost);
        data.cost = !manual && cost === part.sourceCost ? null : cost;
        data.service_price = readAmount(data.service_price);
        data.part_key = key;
        data.revision = part?.revision ?? 0;
        editor.dataset.saving = 'true';
        for (const control of form.elements) control.disabled = true;
        const row = await request('/api/precos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
        });
        priceRequest += 1;
        saved.set(row.part_key, row);
        if (!editing) {
          query.value = '';
          supplier.value = row.supplier;
          category.value = '';
          page = 0;
        }
        editor.close();
        renderResults();
        notify('Valores salvos.');
      } catch (error) {
        if (error.status === 409) void refreshPrices();
        errorBox.textContent = error.message;
        errorBox.hidden = false;
      } finally {
        delete editor.dataset.saving;
        for (const control of form.elements) control.disabled = false;
      }
    });
    editor.showModal();
    form.querySelector('input')?.focus();
  }

  const filter = () => { page = 0; renderResults(); };
  query.addEventListener('input', filter);
  category.addEventListener('change', filter);
  supplier.addEventListener('change', filter);
  add.addEventListener('click', () => openEditor());
  editor.addEventListener('cancel', (event) => {
    if (editor.dataset.saving) event.preventDefault();
  });
  byId('prev').addEventListener('click', () => { page -= 1; renderResults(); });
  byId('next').addEventListener('click', () => { page += 1; renderResults(); });
  results.addEventListener('click', (event) => {
    const control = event.target.closest('[data-part-key]');
    const part = control && byKey.get(control.dataset.partKey);
    if (part) openEditor(part);
  });

  void refresh();
  return { element, refresh, refreshPrices };
}
