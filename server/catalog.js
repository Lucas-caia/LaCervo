import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCatalogIndex } from './catalogIndex.js';
import { HttpError } from './wikisource.js';

let index;
export function searchCatalog(input) {
  try {
    index ||= createCatalogIndex(JSON.parse(readFileSync(join(process.cwd(), 'server/data/catalog.json'), 'utf8')));
  } catch {
    throw new HttpError(503, 'O catálogo está sendo preparado. Tente novamente em instantes.');
  }
  return index.search(input);
}
