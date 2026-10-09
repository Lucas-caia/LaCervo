import { describe, expect, it } from '@jest/globals';
import { buildSearch, normalizeBook } from './books';

describe('Open Library adapter', () => {
  it('handles absent author, cover and publication metadata', () => {
    expect(normalizeBook({ key: '/works/OL1W', title: 'Book' })).toMatchObject({ id: 'OL1W', authors: [], coverId: null, publicationYear: null });
    expect(normalizeBook({ key: '/unknown', title: 'Book' })).toBeNull();
    expect(normalizeBook({ key: '/works/OL1W' })).toBeNull();
  });
  it('keeps author searches, filters and pagination in structured parameters', () => {
    const url = new URL(buildSearch({ query: 'Machado & Assis', category: 'fiction', field: 'author', sort: 'new', page: 2 }), 'https://openlibrary.org');
    expect(url.searchParams.get('author')).toBe('Machado & Assis');
    expect(url.searchParams.get('subject')).toBe('fiction');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('limit')).toBe('12');
    expect(url.searchParams.get('sort')).toBe('new');
  });
  it('uses the supported global reading-log order and avoids an unsupported author API sort', () => {
    const input = { query: 'Machado', category: 'all', field: 'all', page: 1 } as const;
    expect(new URL(buildSearch({ ...input, sort: 'popular' }), 'https://openlibrary.org').searchParams.get('sort')).toBe('readinglog');
    expect(new URL(buildSearch({ ...input, sort: 'author' }), 'https://openlibrary.org').searchParams.has('sort')).toBe(false);
  });
});
