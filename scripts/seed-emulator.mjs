// This script is intentionally restricted to loopback addresses and a demo project.
const authUrl = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-lacervo-key';
for (const email of ['leitor@lacervo.test', 'colega@lacervo.test']) {
  const response = await fetch(authUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Leitura123!', returnSecureToken: true }) });
  const data = await response.json();
  if (!response.ok && data.error?.message !== 'EMAIL_EXISTS') throw new Error('Não foi possível criar a conta local. Inicie os emuladores primeiro.');
}
console.log('Contas locais: leitor@lacervo.test e colega@lacervo.test. Senha de teste: Leitura123!');
console.log('Nenhum livro foi cadastrado. O acervo é consultado na Wikisource.');
