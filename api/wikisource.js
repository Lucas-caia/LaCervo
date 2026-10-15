import { getBook, HttpError } from '../server/wikisource.js';
import { send, failure } from '../server/http.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') throw new HttpError(405, 'Método não permitido.');
    const params = new URL(req.url, 'http://localhost').searchParams;
    if (!params.has('id')) throw new HttpError(400, 'Informe a edição desejada.');
    send(res, 200, await getBook(params.get('id')));
  } catch (error) { failure(res, error); }
}
