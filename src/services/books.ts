import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Book } from '../domain/models';
import { runtimeConfig } from './runtimeConfig';

export type Category = 'all' | 'fiction' | 'science' | 'history' | 'philosophy' | 'technology';
export type SearchField = 'all' | 'title' | 'author';
export type Sort = 'relevance' | 'new' | 'old' | 'popular' | 'author';
export interface SearchInput { query: string; category: Category; field: SearchField; sort: Sort; page: number; }
export interface BookResults { books: Book[]; total: number; catalog?: { updatedAt: string; total: number; sources: { wikisource: number; openLibrary: number } }; }
export const PAGE_SIZE = 12;
const apiUrl = runtimeConfig.openLibraryUrl;

const object = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
const strings = (value: unknown): string[] => Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())))] : [];

export function buildSearch(input: SearchInput): string {
  return `/api/catalog?${new URLSearchParams({ q: input.query.trim().slice(0, 120), field: input.field, category: input.category, sort: input.sort, page: String(input.page) })}`;
}

const localQuery = fetchBaseQuery({ baseUrl: window.location.origin, timeout: 15000 });

export const booksApi = createApi({
  reducerPath: 'booksApi',
  baseQuery: fetchBaseQuery({ baseUrl: apiUrl, timeout: 15000 }),
  keepUnusedDataFor: 120,
  endpoints: builder => ({
    searchBooks: builder.query<BookResults, SearchInput>({
      async queryFn(input, api, extra) {
        const result = await localQuery(buildSearch(input), api, extra);
        return result.error ? { error: result.error } : { data: result.data as BookResults };
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
