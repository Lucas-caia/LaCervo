import assert from 'node:assert/strict';

const origin = new URL(process.argv[2] || 'https://la-cervo-umber.vercel.app/');
if (!['https:', 'http:'].includes(origin.protocol) || origin.username || origin.password) throw new Error('Provide a public HTTP(S) URL without credentials');
const checks = [
  { path: '/', status: 200, type: 'text/html' },
  { path: '/estante', status: 200, type: 'text/html' },
  { path: '/favicon.svg', status: 200, type: 'image/svg+xml' },
  { path: '/api/catalog?sort=author', status: 200, type: 'application/json', validate: data => { assert(Array.isArray(data.books)); assert(data.total > 0); assert(data.catalog?.updatedAt); } },
  { path: '/api/wikisource?id=WS5030', status: 200, type: 'application/json', validate: data => { assert.equal(data.id, 'WS5030'); assert.equal(data.source, 'wikisource'); assert(Array.isArray(data.chapters)); assert(!('paragraphs' in data)); } },
  { path: '/api/read?id=WS5030&loan=verification', status: 401, type: 'application/json', private: true, validate: data => assert.equal(typeof data.error, 'string') }
];
const results = await Promise.all(checks.map(async check => {
  try {
    const response = await fetch(new URL(check.path, origin.origin), { signal: AbortSignal.timeout(25000), redirect: 'error' });
    assert.equal(response.status, check.status, `HTTP ${response.status}; expected ${check.status}`);
    const type = response.headers.get('content-type') || '';
    assert(type.includes(check.type), `Received ${type}; expected ${check.type}. HTML at /api/ indicates a missing function or an incorrect rewrite.`);
    if (check.private) assert.match(response.headers.get('cache-control') || '', /private, no-store/);
    if (check.validate) check.validate(await response.json());
    return { path: check.path, passed: true };
  } catch (error) { return { path: check.path, passed: false, error: error.message }; }
}));
for (const result of results) console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.path}${result.error ? `: ${result.error}` : ''}`);
if (results.some(result => !result.passed)) process.exitCode = 1;
else console.log('Public routes verified. Complete authenticated borrowing, reservations, notifications and reading with your own account in the browser.');
