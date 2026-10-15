import { readFile } from 'node:fs/promises';
import { createCatalogIndex } from '../server/catalogIndex.js';

try {
  const snapshot = JSON.parse(await readFile(new URL('../server/data/catalog.json', import.meta.url), 'utf8'));
  createCatalogIndex(snapshot);
  const wikiCount = snapshot.books.filter(book => book.source === 'wikisource').length;
  if (!Number.isFinite(Date.parse(snapshot.updatedAt)) || wikiCount !== snapshot.sources.wikisource
    || snapshot.books.length - wikiCount !== snapshot.sources.openLibrary || !wikiCount || !snapshot.sources.openLibrary) throw new Error('Inconsistent catalog metadata');
  console.log(`Catalog verified: ${snapshot.books.length} editions; metadata only`);
} catch (error) {
  console.error(`Catalog validation failed: ${error.message}. Run npm run catalog:sync.`);
  process.exitCode = 1;
}
