const fold = value => String(value).normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
const words = value => fold(value).match(/[\p{L}\p{N}]+/gu) || [];
const compare = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true }).compare;
export const catalogCategories = ['fiction', 'science', 'history', 'philosophy', 'technology'];

export function createCatalogIndex(snapshot) {
  if (snapshot.schema !== 1 || !Array.isArray(snapshot.books) || !snapshot.books.length) throw new Error('Invalid catalog snapshot');
  const records = new Map();
  const postings = { all: new Map(), title: new Map(), author: new Map() };
  for (const record of snapshot.books) {
    if (!/^(WS[1-9]\d{0,11}|OL\d+W)$/.test(record.id) || typeof record.title !== 'string' || !record.title.length || record.title.length > 300
      || !Array.isArray(record.authors) || !record.authors.every(name => typeof name === 'string' && name.length <= 150)
      || !Array.isArray(record.subjects) || !record.subjects.every(subject => typeof subject === 'string')
      || !Array.isArray(record.categoryKeys) || !record.categoryKeys.every(category => catalogCategories.includes(category))
      || (record.publicationYear !== null && !Number.isSafeInteger(record.publicationYear))
      || (record.coverId !== null && (!Number.isSafeInteger(record.coverId) || record.coverId < 1))
      || !Number.isFinite(record.popularity) || record.popularity < 0 || records.has(record.id)
      || ('paragraphs' in record) || ('chapters' in record)
      || (record.id.startsWith('WS') && (record.source !== 'wikisource' || typeof record.readable !== 'boolean'))) throw new Error('Invalid catalog record');
    records.set(record.id, record);
    const fields = { title: record.title, author: record.authors.join(' '), all: `${record.title} ${record.authors.join(' ')} ${(record.subjects || []).join(' ')}` };
    for (const [field, text] of Object.entries(fields)) for (const word of new Set(words(text))) {
      if (!postings[field].has(word)) postings[field].set(word, new Set());
      postings[field].get(word).add(record.id);
    }
  }
  const tie = (a, b) => compare(a.title, b.title) || compare(a.id, b.id);
  const author = (a, b) => Number(!a.authors.length) - Number(!b.authors.length) || compare(a.authors[0] || '', b.authors[0] || '') || tie(a, b);
  const year = direction => (a, b) => Number(a.publicationYear == null) - Number(b.publicationYear == null) || direction * ((a.publicationYear || 0) - (b.publicationYear || 0)) || tie(a, b);
  // Each complete ordering is computed once, before filtering and pagination.
  const orders = Object.fromEntries(Object.entries({ relevance: tie, author, new: year(-1), old: year(1), popular: (a, b) => (b.popularity || 0) - (a.popularity || 0) || tie(a, b) })
    .map(([name, comparator]) => [name, [...records.values()].sort(comparator)]));
  function search({ query = '', field = 'all', category = 'all', sort = 'relevance', page = 1, source = 'all' } = {}) {
    let matching = null;
    const terms = [...new Set(words(query))];
    for (const term of terms) {
      const found = new Set();
      for (const [word, ids] of postings[field]) if (word.startsWith(term)) for (const id of ids) found.add(id);
      matching = matching === null ? found : new Set([...matching].filter(id => found.has(id)));
    }
    let results = orders[sort].filter(book => (!matching || matching.has(book.id)) && (category === 'all' || book.categoryKeys?.includes(category)) && (source === 'all' || book.source === source));
    if (sort === 'relevance' && terms.length) {
      const score = book => terms.reduce((sum, term) => sum + (fold(book.title).includes(term) ? 8 : 0) + (fold(book.authors.join(' ')).includes(term) ? 4 : 0), 0);
      results = results.sort((a, b) => score(b) - score(a) || tie(a, b));
    }
    const total = results.length;
    return { books: results.slice((page - 1) * 12, page * 12).map(({ categoryKeys, popularity, ...book }) => book), total, hasNext: page * 12 < total,
      catalog: { updatedAt: snapshot.updatedAt, total: records.size, sources: snapshot.sources } };
  }
  return { search };
}
