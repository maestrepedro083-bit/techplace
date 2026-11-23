export const filmTypes = [
  'Vidro temperado', 'Vidro 3D', 'Vidro 3D de privacidade', 'Cerâmica', 'Cerâmica de privacidade', 'Hidrogel', 'Filme UV', 'TPU', 'Outro'
];

export const fold = (value) => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

function terms(value) {
  return fold(value).replace(/\+/g, ' plus ').replace(/[^a-z0-9]+/g, ' ').trim()
    .replace(/\b(?:samsumg|sansumg|sansung)\b/g, 'samsung')
    .replace(/\b(?:motorola|motô)\b/g, 'moto')
    .replace(/\b(?:apple)\s+(?=iphone)|\bxiaomi\s+(?=redmi|poco)|\bsamsung\s+(?=galaxy)/g, '')
    .replace(/\b(s|g|e|a|m|c|x|f|j|v|k|y)\s+(?=\d)/g, '$1')
    .replace(/\b(iphone)(?=\d)/g, '$1 ')
    .replace(/(\d)\s+s(?=\s|$)/g, '$1s');
}

export function modelBrand(model) {
  const value = terms(model);
  if (/^(?:iphone|apple)\b/.test(value)) return 'Apple';
  if (/^(?:moto|edge|razr)\b/.test(value)) return 'Motorola';
  if (/^(?:samsung|galaxy)\b/.test(value)) return 'Samsung';
  if (/^poco\b/.test(value)) return 'POCO';
  if (/^(?:xiaomi|redmi|mi)\b/.test(value)) return 'Xiaomi';
  const other = ['Asus', 'Google', 'Honor', 'Huawei', 'Infinix', 'Itel', 'LG', 'Nokia', 'Nothing', 'OnePlus',
    'OPPO', 'Realme', 'Sony', 'Tecno', 'TCL', 'Vivo', 'ZTE'];
  return other.find((brand) => value.startsWith(fold(brand) + ' ')) || 'Outras marcas';
}

const fiveGNames = new Set(['moto g54', 'moto g84', 'poco x6 pro', 'poco x4 pro']);
const leading = /^(?:moto|samsung|galaxy|apple|xiaomi)\s+/;

function aliases(name) {
  const full = terms(name);
  const short = full.replace(leading, '').replace(/^galaxy\s+/, '');
  const list = [full, short];
  if (fiveGNames.has(full)) list.push(full + ' 5g', short + ' 5g');
  if (full.startsWith('galaxy ')) list.push('samsung ' + short);
  if (/^(?:redmi|poco)\s/.test(full)) list.push('xiaomi ' + full);
  if (full.startsWith('xiaomi ')) list.push('mi ' + short);
  if (full.startsWith('mi ')) list.push('xiaomi ' + full.slice(3));
  return [...new Set(list.filter(Boolean))];
}

export function filmModelKey(name) {
  const normalized = terms(name);
  const brand = modelBrand(name);
  return brand + ':' + normalized.replace(leading, '').replace(/^galaxy\s+/, '')
    .replace(/^mi\s+/, '');
}

export function buildFilmIndex(groups) {
  const byModel = new Map();
  for (const group of groups) {
    for (const name of group.models) {
      const id = filmModelKey(name);
      if (!byModel.has(id)) byModel.set(id, { id, name, brand: modelBrand(name), aliases: aliases(name), groups: [] });
      const model = byModel.get(id);
      model.aliases = [...new Set([...model.aliases, ...aliases(name)])];
      if (!model.groups.includes(group)) model.groups.push(group);
    }
  }
  return [...byModel.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
}

export function lookupFilmModels(index, query, brand = '') {
  const value = terms(query).replace(/(\d)\s+e$/, '$1e');
  const candidates = brand ? index.filter((model) => model.brand === brand) : index;
  if (!value) return { exact: [], suggestions: candidates };
  const exact = candidates.filter((model) => model.aliases.includes(value));
  if (exact.length) return { exact, suggestions: exact };
  const wanted = value.split(' ');
  const suggestions = candidates.filter((model) => model.aliases.some((alias) =>
    wanted.every((token) => alias.split(' ').some((word) => word === token || word.startsWith(token)))));
  return { exact, suggestions };
}

export function compatibleFilmGroups(first, second, type = '', onlyStore = false) {
  return first.groups.filter((group) => (!second || second.groups.includes(group)) &&
    (!type || group.type === type) && (!onlyStore || group.kind === 'store'));
}

export function filmModelsInText(index, text) {
  const normalized = ' ' + terms(text).replace(/(\d)\s+e$/, '$1e') + ' ';
  const matches = [];
  for (const model of index) {
    for (const alias of model.aliases) {
      if (alias.length < 3 || !/\d/.test(alias) && !/iphone|razr/.test(alias)) continue;
      const location = normalized.indexOf(' ' + alias + ' ');
      if (location >= 0) matches.push({ location, end: location + alias.length + 1, model });
    }
  }
  matches.sort((a, b) => a.location - b.location || b.end - a.end);
  const unique = [];
  let end = -1;
  for (const match of matches) {
    if (match.location < end) continue;
    unique.push(match.model);
    end = match.end;
  }
  return [...new Set(unique)];
}

export function parsedFilmQuestion(index, text) {
  const question = ' ' + terms(text) + ' ';
  const separator = /\s+(?:serve (?:no|na|em|para|pro|pra)|compativel com(?: o| a)?|encaixa (?:no|na|em)|vs)\s+|\s+(?:e|com)\s+(?=(?:(?:moto|galaxy|samsung|redmi|poco|iphone|xiaomi|realme|oppo|infinix|lg|vivo|tecno|honor)\b|[a-z]\d))/;
  const parts = question.split(separator);
  const models = filmModelsInText(index, text);
  const missingPart = parts.length > 1 && parts.every((part) => /\d/.test(part)) &&
    parts.some((part) => filmModelsInText(index, part).length === 0);
  const unknownRequestedVariant = parts.some((part) => {
    const found = filmModelsInText(index, part);
    const variant = part.match(/\b([a-z]+\d+|\d+)\s+(pro max|pro plus|ultra|pro|4g|5g|fe|plus|fusion|neo|play|power|lite|mini|edge)\b/);
    return variant && found.length && !found.some((model) => model.aliases.some((alias) => alias.includes(variant[0]))) &&
      !found.some((model) => model.aliases.some((alias) => alias.includes(variant[1] + variant[2])));
  });
  return { models, unresolved: missingPart || unknownRequestedVariant };
}
