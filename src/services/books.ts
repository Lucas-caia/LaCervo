import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Book } from '../domain/models';
import { runtimeConfig } from './runtimeConfig';

export type Category = 'all' | 'fiction' | 'science' | 'history' | 'philosophy' | 'technology';
export type SearchField = 'all' | 'title' | 'author';
export type Sort = 'relevance' | 'new' | 'old' | 'popular' | 'author';
export interface SearchInput { query: string; category: Category; field: SearchField; sort: Sort; page: number; }
export interface BookResults { books: Book[]; total: number; }
export const PAGE_SIZE = 12;
const apiUrl = runtimeConfig.openLibraryUrl;

const object = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export function normalizeBook(value: unknown): Book | null {
  const row = object(value);
  const id = typeof row.key === 'string' ? row.key.split('/').pop() || '' : '';
  if (!/^OL\d+W$/.test(id) || typeof row.title !== 'string') return null;
  return {
    id, title: row.title, authors: strings(row.author_name),
    coverId: typeof row.cover_i === 'number' ? row.cover_i : null,
    publicationYear: typeof row.first_publish_year === 'number' ? row.first_publish_year : null,
    subjects: strings(row.subject).slice(0, 6)
  };
}

export function buildSearch(input: SearchInput): string {
  const params = new URLSearchParams({
    fields: 'key,title,author_name,cover_i,first_publish_year,subject',
    limit: String(PAGE_SIZE), page: String(input.page), lang: 'pt'
  });
  // Use structured parameters for title/author searches; never concatenate user input into query operators.
  const term = input.query.trim().slice(0, 120);
  if (term) params.set(input.field === 'all' ? 'q' : input.field, term);
  if (input.category !== 'all') params.set('subject', input.category);
  if (!term && input.category === 'all') params.set('q', 'subject:fiction OR subject:science OR subject:history');
  if (input.sort !== 'relevance' && input.sort !== 'author') params.set('sort', input.sort === 'popular' ? 'readinglog' : input.sort);
  return `/search.json?${params}`;
}

export const booksApi = createApi({
  reducerPath: 'booksApi',
  baseQuery: fetchBaseQuery({ baseUrl: apiUrl, timeout: 15000 }),
  keepUnusedDataFor: 120,
  endpoints: builder => ({
    searchBooks: builder.query<BookResults, SearchInput>({
      query: buildSearch,
      transformResponse: (response: unknown, _meta, input) => {
        const data = object(response);
        const books = (Array.isArray(data.docs) ? data.docs : []).map(normalizeBook).filter((book): book is Book => book !== null);
        // Open Library has no global author sort; label this explicitly as a page-level ordering.
        if (input.sort === 'author') books.sort((a, b) => (a.authors[0] || '\uffff').localeCompare(b.authors[0] || '\uffff', 'pt-BR') || a.title.localeCompare(b.title, 'pt-BR'));
        return {
          books,
          total: typeof data.numFound === 'number' ? data.numFound : typeof data.num_found === 'number' ? data.num_found : 0
        };
      }
    }),
    bookDetails: builder.query<Book, string>({
      async queryFn(id, _api, _extra, baseQuery) {
        if (!/^OL\d+W$/.test(id)) return { error: { status: 400, data: 'Invalid work ID' } };
        const result = await baseQuery(`/works/${id}.json`);
        if (result.error) return { error: result.error };
        const work = object(result.data);
        if (typeof work.title !== 'string') return { error: { status: 404, data: 'Book not found' } };
        const authorEntries = Array.isArray(work.authors) ? work.authors.slice(0, 4) : [];
        const authors = await Promise.all(authorEntries.map(async entry => {
          const key = object(object(entry).author).key;
          if (typeof key !== 'string' || !/^\/authors\/OL\d+A$/.test(key)) return '';
          const author = await baseQuery(`${key}.json`);
          const name = object(author.data).name;
          return typeof name === 'string' ? name : '';
        }));
        const description = typeof work.description === 'string' ? work.description : object(work.description).value;
        const covers = Array.isArray(work.covers) ? work.covers : [];
        return { data: {
          id, title: work.title, authors: authors.filter(Boolean),
          coverId: typeof covers[0] === 'number' && covers[0] > 0 ? covers[0] : null,
          publicationYear: null, subjects: strings(work.subjects).slice(0, 6),
          description: typeof description === 'string' ? description : undefined
        } };
      }
    })
  })
});

export const { useSearchBooksQuery, useBookDetailsQuery } = booksApi;
