import { HttpError } from './wikisource.js';

export function send(res, status, data, isPrivate = false) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', isPrivate || status !== 200 ? 'private, no-store' : 'public, max-age=60, s-maxage=300');
  res.end(JSON.stringify(data));
}
export function failure(res, error, isPrivate = false) {
  send(res, error instanceof HttpError ? error.status : 503, { error: error instanceof HttpError ? error.message : 'Não foi possível consultar o serviço. Tente novamente.' }, isPrivate);
}
