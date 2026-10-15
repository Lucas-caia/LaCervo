/** @jest-environment node */
import { describe, expect, it, jest } from '@jest/globals';
import { createCatalogIndex } from '../../server/catalogIndex';
import catalogHandler from '../../api/catalog';

const rows = Array.from({ length: 30 }, (_, index) => ({ id: `OL${index + 1}W`, title: `Obra ${index + 1}`, authors: [`Autor ${30 - index}`], coverId: null, publicationYear: index % 3 ? 1900 + index : null, subjects: ['Ficção'], categoryKeys: ['fiction'], popularity: index }));
const digital = { id: 'WS42', title: 'Memórias de uma viagem', authors: ['Álvaro'], source: 'wikisource', readable: true, subjects: ['Viagens'], categoryKeys: [], coverId: null, publicationYear: 1900, popularity: 0 };
const snapshot = { schema: 1, updatedAt: '2026-10-14T00:00:00Z', sources: { wikisource: 1, openLibrary: 30 }, books: [...rows, digital] };
const index = createCatalogIndex(snapshot);

describe('complete indexed catalog', () => {
  it('sorts the entire collection by author before cutting pages, with no gaps or duplicates', () => {
    const expected = [...snapshot.books].sort((a, b) => a.authors[0].localeCompare(b.authors[0], 'pt-BR', { sensitivity: 'base', numeric: true })).map(book => book.id);
    const actual = [1, 2, 3].flatMap(page => index.search({ sort: 'author', page }).books.map(book => book.id));
    expect(actual).toEqual(expected);
    expect(new Set(actual).size).toBe(31);
    expect(index.search({ sort: 'author', page: 3 })).toMatchObject({ total: 31, hasNext: false });
  });
  it('finds accented names and partial tokens, applying field restrictions', () => {
    expect(index.search({ query: 'alva', field: 'author' }).books.map(book => book.id)).toEqual(['WS42']);
    expect(index.search({ query: 'memorias viagem', field: 'title' }).total).toBe(1);
    expect(index.search({ query: 'alvaro', field: 'title' }).total).toBe(0);
    expect(index.search({ query: 'ficcao' }).total).toBe(30);
    expect(index.search({ query: 'memorias inexistente' }).total).toBe(0);
  });
  it('filters source and categories before counting and paginating', () => {
    expect(index.search({ source: 'wikisource' })).toMatchObject({ books: [expect.objectContaining({ id: 'WS42' })], total: 1, hasNext: false });
    expect(index.search({ category: 'fiction', page: 3 })).toMatchObject({ total: 30, books: expect.any(Array) });
    expect(index.search({ category: 'technology' }).total).toBe(0);
    expect(index.search({ page: 4 }).books).toEqual([]);
  });
  it('puts missing authors and publication years last in either date direction', () => {
    const missing = { ...rows[0], id: 'OL999W', authors: [], publicationYear: null };
    const local = createCatalogIndex({ ...snapshot, books: [missing, digital] });
    for (const sort of ['author', 'old', 'new']) expect(local.search({ sort }).books.at(-1)?.id).toBe('OL999W');
  });
  it('uses upstream popularity and stable title/ID ties independently of input order', () => {
    expect(index.search({ sort: 'popular' }).books[0].id).toBe('OL30W');
    const reversed = createCatalogIndex({ ...snapshot, books: [...snapshot.books].reverse() });
    expect(reversed.search({ sort: 'author', page: 2 })).toEqual(index.search({ sort: 'author', page: 2 }));
  });
  it('exposes snapshot freshness without leaking internal fields or reading content', () => {
    const result = index.search({ source: 'wikisource' });
    expect(result.catalog).toMatchObject({ total: 31, updatedAt: snapshot.updatedAt });
    expect(result.books[0]).not.toHaveProperty('categoryKeys');
    expect(result.books[0]).not.toHaveProperty('popularity');
    expect(result.books[0]).not.toHaveProperty('paragraphs');
  });
  it('rejects malformed snapshots and duplicate IDs', () => {
    expect(() => createCatalogIndex({ ...snapshot, schema: 2 })).toThrow();
    expect(() => createCatalogIndex({ ...snapshot, books: [digital, digital] })).toThrow();
  });
});

it.each(['?sort=unsupported', '?page=0', '?page=1.5', '?source=https://evil.test', '?field=unknown', '?category=unknown', `?q=${'x'.repeat(121)}`])('rejects invalid public catalog input %s', async query => {
  const res = { statusCode: 0, setHeader: jest.fn(), end: jest.fn() };
  await catalogHandler({ method: 'GET', url: `/api/catalog${query}` }, res);
  expect(res.statusCode).toBe(400);
  expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
});
it('rejects catalog mutations', async () => {
  const res = { statusCode: 0, setHeader: jest.fn(), end: jest.fn() };
  await catalogHandler({ method: 'POST', url: '/api/catalog' }, res);
  expect(res.statusCode).toBe(405);
});
