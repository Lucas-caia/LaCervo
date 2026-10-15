import type { Book } from '../domain/models';

// Test fixtures are never imported by production components or the catalog.
export const digitalBooks: Book[] = [42, 43, 44].map(id => ({
  id: `WS${id}`, title: `Obra de teste ${id}`, authors: ['Autora de teste'], coverId: null,
  publicationYear: 1900, subjects: [], source: 'wikisource', readable: true,
  sourceUrl: `https://pt.wikisource.org/?curid=${id}`
}));
