import { HttpError, isWikiId } from './wikisource.js';

export async function authorizeReading({ token, workId, loanId, env = process.env, fetchImpl = fetch, now = Date.now() }) {
  if (!token) throw new HttpError(401, 'Entre na sua conta para ler.');
  if (!isWikiId(workId) || !/^[A-Za-z0-9_-]{1,128}$/.test(loanId || '')) throw new HttpError(400, 'Empréstimo inválido.');
  const key = env.VITE_FIREBASE_API_KEY, project = env.VITE_FIREBASE_PROJECT_ID;
  if (!key || !project) throw new HttpError(503, 'A configuração de leitura ainda não está disponível.');
  const local = env.NODE_ENV !== 'production' && env.VITE_USE_FIREBASE_EMULATORS === 'true';
  const identity = local ? 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1' : 'https://identitytoolkit.googleapis.com/v1';
  const firestore = local ? 'http://127.0.0.1:8080/v1' : 'https://firestore.googleapis.com/v1';
  // Firebase verifies the token. Never trust a decoded JWT payload without verification.
  const identityResponse = await fetchImpl(`${identity}/accounts:lookup?key=${encodeURIComponent(key)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }), signal: AbortSignal.timeout(10000)
  });
  if (!identityResponse.ok) throw new HttpError(identityResponse.status >= 500 ? 503 : 401, 'Sua sessão não pôde ser validada. Entre novamente.');
  const uid = (await identityResponse.json()).users?.[0]?.localId;
  if (typeof uid !== 'string' || !uid) throw new HttpError(401, 'Sessão inválida.');
  const base = `${firestore}/projects/${encodeURIComponent(project)}/databases/(default)/documents`;
  async function document(collection, id) {
    const response = await fetchImpl(`${base}/${collection}/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new HttpError(response.status >= 500 ? 503 : 403, 'É necessário um empréstimo ativo deste livro para ler.');
    return (await response.json()).fields || {};
  }
  const loan = await document('loans', loanId);
  const borrowedAt = Date.parse(loan.borrowedAt?.timestampValue || '');
  if (loan.userId?.stringValue !== uid || loan.workId?.stringValue !== workId || !Object.hasOwn(loan.returnedAt || {}, 'nullValue')
    || !Number.isFinite(borrowedAt) || borrowedAt > now + 60000 || now >= borrowedAt + 14 * 24 * 60 * 60 * 1000) {
    throw new HttpError(403, 'Este empréstimo foi devolvido, expirou ou não pertence à sua conta.');
  }
  const [account, copy] = await Promise.all([document('readerAccounts', uid), document('copies', workId)]);
  const active = account.activeLoanIds?.arrayValue?.values?.map(value => value.stringValue) || [];
  if (!active.includes(loanId) || active.length > 3 || copy.activeLoanId?.stringValue !== loanId) throw new HttpError(403, 'O empréstimo não está mais ativo.');
  return uid;
}
