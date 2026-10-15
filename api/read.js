import { getReadingPart, HttpError } from '../server/wikisource.js';
import { authorizeReading } from '../server/readingAccess.js';
import { send, failure } from '../server/http.js';

export default async function handler(req, res, env = process.env) {
  try {
    if (req.method !== 'GET') throw new HttpError(405, 'Método não permitido.');
    const params = new URL(req.url, 'http://localhost').searchParams;
    const workId = params.get('id'), loanId = params.get('loan');
    const token = typeof req.headers.authorization === 'string' ? req.headers.authorization.match(/^Bearer (\S+)$/)?.[1] : null;
    await authorizeReading({ token, workId, loanId, env });
    const chapter = Number(params.get('chapter') || 0);
    send(res, 200, await getReadingPart(workId, chapter), true);
  } catch (error) { failure(res, error, true); }
}
