import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { booksApi, buildSearch } from './books';
import { store } from '../app/store';

afterEach(() => { store.dispatch(booksApi.util.resetApiState()); jest.mocked(fetch).mockReset(); });

describe('indexed catalog adapter', () => {
  it('encodes filters and pagination as data', () => {
    const url = new URL(buildSearch({ query: 'Machado & Assis', category: 'fiction', field: 'author', sort: 'new', page: 2 }), 'https://lacervo.test');
    expect(url.pathname).toBe('/api/catalog');
    expect(url.searchParams.get('q')).toBe('Machado & Assis');
    expect(url.searchParams.get('field')).toBe('author');
    expect(url.searchParams.get('category')).toBe('fiction');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('sort')).toBe('new');
  });
  it('requests global author sorting from the index', () => {
    const url = new URL(buildSearch({ query: '', category: 'all', field: 'all', page: 2, sort: 'author' }), 'https://lacervo.test');
    expect(url.searchParams.get('sort')).toBe('author');
    expect(url.searchParams.get('page')).toBe('2');
  });
  it('removes duplicate and empty source subjects before rendering keyed tags', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ title: 'Uma obra', subjects: ['History', 'History', '', 'Science'] }), { headers: { 'Content-Type': 'application/json' } }));
    const request = store.dispatch(booksApi.endpoints.bookDetails.initiate('OL123W'));
    const book = await request.unwrap();
    expect(book.subjects).toEqual(['History', 'Science']);
    request.unsubscribe();
  });
});
