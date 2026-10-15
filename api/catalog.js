import { searchCatalog } from '../server/catalog.js';
import { catalogCategories } from '../server/catalogIndex.js';
import { HttpError } from '../server/wikisource.js';
import { send, failure } from '../server/http.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') throw new HttpError(405, 'Método não permitido.');
    const params = new URL(req.url, 'http://localhost').searchParams;
    const input = { query: params.get('q') || '', field: params.get('field') || 'all', category: params.get('category') || 'all', sort: params.get('sort') || 'relevance', source: params.get('source') || 'all', page: Number(params.get('page') || 1) };
    if (input.query.length > 120 || !Number.isInteger(input.page) || input.page < 1 || input.page > 10000
      || !['all', 'title', 'author'].includes(input.field) || !['all', ...catalogCategories].includes(input.category)
      || !['relevance', 'author', 'new', 'old', 'popular'].includes(input.sort) || !['all', 'wikisource'].includes(input.source)) throw new HttpError(400, 'Filtros inválidos.');
    send(res, 200, searchCatalog(input));
  } catch (error) { failure(res, error); }
}
