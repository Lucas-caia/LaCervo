import { mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getBook, HttpError } from '../server/wikisource.js';
import { catalogCategories, createCatalogIndex } from '../server/catalogIndex.js';

const headers = { 'User-Agent': 'LaCervo/1.0 (https://github.com/Lucas-caia/LaCervo; catalog synchronization)' };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(`Source returned ${data.error.code}`);
      return data;
    } catch (error) { if (attempt === 3) throw error; await pause(2000 * (attempt + 1)); }
  }
}
async function wikiBook(id) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return await getBook(id); }
    catch (error) {
      if (error instanceof HttpError && error.status === 404) return null;
      if (attempt === 3) throw error;
      await pause(2000 * (attempt + 1));
    }
  }
}

async function synchronize() {
  const perCategory = Number(process.env.CATALOG_OPEN_LIBRARY_PER_CATEGORY || 200);
  if (!Number.isInteger(perCategory) || perCategory < 1 || perCategory > 1000) throw new Error('CATALOG_OPEN_LIBRARY_PER_CATEGORY must be 1–1000');
  const books = new Map(), wikiIds = new Set();
  let offset = 0;
  do {
    const params = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', maxlag: '5', list: 'search', srsearch: 'insource:pages -insource:from', srnamespace: '0', srlimit: '500', sroffset: String(offset), srprop: '' });
    const data = await request(`https://pt.wikisource.org/w/api.php?${params}`);
    if (!Array.isArray(data.query?.search)) throw new Error('Invalid Wikisource discovery response');
    for (const row of data.query.search) if (!row.title.includes('/')) wikiIds.add(`WS${row.pageid}`);
    offset = data.continue?.sroffset;
    if (offset >= 10000) throw new Error('Wikisource discovery exceeded the search API window; snapshot was not replaced');
    await pause(400);
  } while (offset !== undefined);
  console.log(`Wikisource: ${wikiIds.size} eligible root editions discovered`);
  const ids = [...wikiIds];
  for (let start = 0; start < ids.length; start += 2) {
    const batch = await Promise.all(ids.slice(start, start + 2).map(wikiBook));
    for (const book of batch.filter(Boolean)) {
      // Store metadata only: chapters and reading text stay at the upstream source.
      const { chapters, revision, description, ...metadata } = book;
      books.set(book.id, { ...metadata, categoryKeys: [], popularity: 0 });
    }
    if (start % 40 === 0) console.log(`Wikisource metadata: ${Math.min(start + 2, ids.length)}/${ids.length}`);
    await pause(400);
  }
  for (const category of catalogCategories) {
    for (let start = 0; start < perCategory; start += 100) {
      const params = new URLSearchParams({ subject: category, language: 'por', sort: 'readinglog', fields: 'key,title,author_name,cover_i,first_publish_year,subject,readinglog_count', limit: String(Math.min(100, perCategory - start)), offset: String(start) });
      const data = await request(`https://openlibrary.org/search.json?${params}`);
      if (!Array.isArray(data.docs)) throw new Error('Invalid Open Library discovery response');
      for (const row of data.docs) {
        const id = row.key?.split('/').pop();
        if (!/^OL\d+W$/.test(id) || typeof row.title !== 'string') continue;
        const existing = books.get(id);
        if (existing) { if (!existing.categoryKeys.includes(category)) existing.categoryKeys.push(category); continue; }
        books.set(id, { id, title: row.title.slice(0, 300), authors: (row.author_name || []).filter(name => typeof name === 'string').slice(0, 4).map(name => name.slice(0, 150)),
          coverId: Number.isSafeInteger(row.cover_i) && row.cover_i > 0 ? row.cover_i : null,
          publicationYear: Number.isSafeInteger(row.first_publish_year) ? row.first_publish_year : null,
          subjects: (row.subject || []).filter(value => typeof value === 'string').slice(0, 6).map(value => value.slice(0, 150)), categoryKeys: [category], popularity: Number.isFinite(row.readinglog_count) ? row.readinglog_count : 0 });
      }
      await pause(1100);
      if (data.docs.length < Math.min(100, perCategory - start)) break;
    }
    console.log(`Open Library selection synchronized: ${category}`);
  }
  const snapshot = { schema: 1, updatedAt: new Date().toISOString(), sources: { wikisource: [...books.values()].filter(book => book.source === 'wikisource').length, openLibrary: [...books.values()].filter(book => book.source !== 'wikisource').length, openLibraryPerCategory: perCategory }, books: [...books.values()].sort((a, b) => a.id.localeCompare(b.id)) };
  if (!snapshot.sources.wikisource || !snapshot.sources.openLibrary) throw new Error('Both sources must be present; snapshot was not replaced');
  createCatalogIndex(snapshot);
  const directory = new URL('../server/data/', import.meta.url);
  const destination = new URL('catalog.json', directory);
  const temporary = new URL(`catalog-${process.pid}.tmp`, directory);
  await mkdir(directory, { recursive: true });
  try { await writeFile(temporary, JSON.stringify(snapshot)); await rename(temporary, destination); }
  finally { await unlink(temporary).catch(() => {}); }
  console.log(`Published ${snapshot.books.length} metadata records to ${fileURLToPath(destination)}`);
}

synchronize().catch(error => { console.error(`Synchronization failed; previous snapshot retained: ${error.message}`); process.exitCode = 1; });
