/** @jest-environment node */
import { describe, expect, it, jest } from '@jest/globals';
import { authorizeReading } from '../../server/readingAccess';
import readHandler from '../../api/read';

const env = { VITE_FIREBASE_API_KEY: 'test-key', VITE_FIREBASE_PROJECT_ID: 'test-project', NODE_ENV: 'production' };
const now = Date.parse('2026-10-15T00:00:00Z');
const goodLoan = { userId: { stringValue: 'reader' }, workId: { stringValue: 'WS42' }, returnedAt: { nullValue: null }, borrowedAt: { timestampValue: '2026-10-14T00:00:00Z' } };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
function upstream(loan: unknown = goodLoan) {
  return jest.fn<typeof fetch>().mockImplementation(async input => {
    const url = String(input);
    if (url.includes('accounts:lookup')) return json({ users: [{ localId: 'reader' }] });
    if (url.includes('/loans/')) return json({ fields: loan });
    if (url.includes('/readerAccounts/')) return json({ fields: { activeLoanIds: { arrayValue: { values: [{ stringValue: 'loan-1' }] } } } });
    if (url.includes('/copies/')) return json({ fields: { activeLoanId: { stringValue: 'loan-1' } } });
    throw new Error('Unexpected endpoint');
  });
}
const request = { token: 'id-token', workId: 'WS42', loanId: 'loan-1', env, now };
describe('server reading authorization', () => {
  it('returns no text and disables caching when the HTTP reader is opened without a token', async () => {
    jest.mocked(fetch).mockClear();
    const res = { statusCode: 0, setHeader: jest.fn(), end: jest.fn() };
    await readHandler({ method: 'GET', url: '/api/read?id=WS42&loan=loan-1', headers: {} }, res, env);
    expect(res.statusCode).toBe(401);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
    expect(fetch).not.toHaveBeenCalled();
    expect(JSON.parse(String(res.end.mock.calls[0][0]))).not.toHaveProperty('paragraphs');
  });
  it('validates the ID token with Firebase and verifies the active loan, account and copy', async () => {
    const fetchImpl = upstream(); await expect(authorizeReading({ ...request, fetchImpl })).resolves.toBe('reader');
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ idToken: 'id-token' }) });
    expect(fetchImpl.mock.calls[1][1]).toMatchObject({ headers: { Authorization: 'Bearer id-token' } });
  });
  it('rejects missing or invalid tokens before accessing Wikisource or text', async () => {
    const fetchImpl = upstream(); await expect(authorizeReading({ ...request, token: '', fetchImpl })).rejects.toMatchObject({ status: 401 }); expect(fetchImpl).not.toHaveBeenCalled();
    fetchImpl.mockResolvedValueOnce(json({ error: 'INVALID_ID_TOKEN' }, 400));
    await expect(authorizeReading({ ...request, fetchImpl })).rejects.toMatchObject({ status: 401 }); expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it.each([
    { ...goodLoan, userId: { stringValue: 'another-reader' } },
    { ...goodLoan, workId: { stringValue: 'WS99' } },
    { ...goodLoan, returnedAt: { timestampValue: '2026-10-14T12:00:00Z' } },
    { ...goodLoan, borrowedAt: { timestampValue: '2020-01-01T00:00:00Z' } }
  ])('rejects a foreign, different, returned or expired loan', async loan => {
    await expect(authorizeReading({ ...request, fetchImpl: upstream(loan) })).rejects.toMatchObject({ status: 403 });
  });
  it('rejects a stale account or copy even if the loan document looks active', async () => {
    const fetchImpl = upstream().mockImplementation(async input => {
      const url = String(input); if (url.includes('accounts:lookup')) return json({ users: [{ localId: 'reader' }] });
      if (url.includes('/loans/')) return json({ fields: goodLoan }); return json({ fields: {} });
    });
    await expect(authorizeReading({ ...request, fetchImpl })).rejects.toMatchObject({ status: 403 });
  });
});
