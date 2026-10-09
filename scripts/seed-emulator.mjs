// This script is intentionally restricted to loopback addresses and a demo project.
const authUrl = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-lacervo-key';
for (const email of ['leitor@lacervo.test', 'colega@lacervo.test']) {
  const response = await fetch(authUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Leitura123!', returnSecureToken: true }) });
  const data = await response.json();
  if (!response.ok && data.error?.message !== 'EMAIL_EXISTS') throw new Error('Não foi possível criar a conta local. Inicie os emuladores primeiro.');
}
const url = 'http://127.0.0.1:8080/v1/projects/demo-lacervo/databases/(default)/documents/copies/OL1003040W';
const headers = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const existing = await fetch(url, { headers });
if (existing.status === 404) {
  const response = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify({ fields: {
    workId: { stringValue: 'OL1003040W' }, activeLoanId: { nullValue: null }, queue: { arrayValue: { values: [] } },
    book: { mapValue: { fields: { title: { stringValue: 'Dom Casmurro' }, authors: { arrayValue: { values: [{ stringValue: 'Machado de Assis' }] } }, coverId: { integerValue: '647501' } } } }
  } }) });
  if (!response.ok) throw new Error('Não foi possível cadastrar o exemplar no emulador.');
} else if (!existing.ok) throw new Error('Não foi possível acessar o emulador.');
console.log('Contas locais: leitor@lacervo.test e colega@lacervo.test. Senha de teste: Leitura123!');
console.log('Exemplar local: Dom Casmurro (OL1003040W). Nenhum projeto real foi acessado.');
