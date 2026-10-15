import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { booksApi, type BookResults } from './books';
import type { WikiEdition } from '../domain/wikisource';

const localQuery = fetchBaseQuery({ baseUrl: window.location.origin, timeout: 60000 });
export const wikiApi = booksApi.injectEndpoints({
  endpoints: builder => ({
    wikiSearch: builder.query<BookResults & { hasNext: boolean }, { query: string; page: number }>({
      async queryFn(input, api, extra) {
        const result = await localQuery(`/api/catalog?${new URLSearchParams({ q: input.query, page: String(input.page), source: 'wikisource' })}`, api, extra);
        return result.error ? { error: result.error } : { data: result.data as BookResults & { hasNext: boolean } };
      }
    }),
    wikiBook: builder.query<WikiEdition, string>({
      async queryFn(id, api, extra) {
        const result = await localQuery(`/api/wikisource?${new URLSearchParams({ id })}`, api, extra);
        return result.error ? { error: result.error } : { data: result.data as WikiEdition };
      }
    })
  })
});
export const { useWikiSearchQuery, useWikiBookQuery } = wikiApi;
