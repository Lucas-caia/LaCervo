# Atualização do LaCervo

## 1. Publicar as regras do Firebase

No [Firebase Console](https://console.firebase.google.com/project/lacervo-fe796/firestore/rules), selecione o projeto **lacervo-fe796**, abra **Firestore Database → Regras**, substitua o conteúdo pelo arquivo `firestore.rules` desta versão e clique em **Publicar**. As regras foram testadas com os emuladores; não substitua por regras abertas de acesso geral.

Se já utiliza o Firebase CLI autenticado na conta correta, a alternativa na raiz do projeto é:

```powershell
npx firebase deploy --only firestore:rules --project lacervo-fe796
```

Publicar o site na Vercel não publica essas regras. Não é necessário recriar o banco ou apagar documentos existentes.

## 2. Conferir a Vercel

No projeto conectado ao repositório **Lucas-caia/LaCervo**:

- A branch de produção deve ser `main`, se essa é a branch usada para a entrega.
- A pasta raiz deve ser a pasta do repositório que contém `package.json`, `vercel.json`, `api/` e `server/`; não selecione `dist` como raiz do projeto.
- `vercel.json` define Vite, instalação `npm ci`, build `npm run build`, saída `dist` e inclusão do catálogo nas funções.
- O projeto usa Node.js **24.x**, também definido em `package.json`.
- Em **Settings → Environment Variables**, mantenha os quatro valores Web Firebase em **Production**: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` e `VITE_FIREBASE_APP_ID`. O project ID é `lacervo-fe796`. Use os valores do seu aplicativo no Firebase, sem contas de serviço ou chaves privadas. Mantenha `VITE_USE_FIREBASE_EMULATORS=false`.
- Em **Firebase Authentication → Settings → Authorized domains**, confirme `la-cervo-umber.vercel.app`. O provedor **E-mail/senha** deve estar habilitado.

Os arquivos locais de produção não possuem a configuração Firebase completa. Isso não impede o deploy quando os valores estão definidos na Vercel: as variáveis do ambiente de build têm prioridade. A versão pública anterior contém o project ID esperado, mas isso não confirma a configuração de um futuro deploy. Se alterar variáveis na Vercel depois de publicar, faça um novo deploy.

## 3. Enviar as alterações ao GitHub

Revise as alterações na sua IDE, faça commit e push para `main`. Inclua os arquivos novos de `api/`, `server/`, `scripts/`, `src/`, `docs/`, as regras e **`server/data/catalog.json`**. Não envie `.env.local`, `node_modules`, `dist` ou relatórios de cobertura.

Exemplo no terminal, dentro do projeto:

```powershell
git status
git add .
git diff --cached --stat
git commit -m "Finaliza catalogo, circulacao e revisao do LaCervo"
git push origin main
```

A integração Git da Vercel inicia uma publicação automaticamente após o push para a branch de produção. Aguarde **Ready** em **Deployments** e confira se o commit publicado é o que você acabou de enviar. Não é necessário criar outro projeto na Vercel.

## 4. Validar a versão publicada

Na raiz do projeto:

```powershell
npm run verify:deploy
```

O comando verifica a interface, a rota da estante, o ícone e as três APIs. `/api/catalog` e `/api/wikisource?id=WS5030` devem responder com JSON; `/api/read` sem token deve responder com **401 e JSON**, sem cache público. Receber HTML em `/api/` indica que a função não foi publicada ou que o roteamento está incorreto. Confira o commit, a pasta raiz e o envio dos arquivos novos.

Depois, no [site público](https://la-cervo-umber.vercel.app/), usando sua própria conta:

1. Entre, busque uma obra e navegue entre páginas com ordenação por autor.
2. Salve uma edição digital na lista de desejos, atualize a página e confira a persistência.
3. Solicite um empréstimo disponível, leia um capítulo e teste navegação, tamanho da fonte e tema noturno.
4. Devolva o livro, confira o histórico e confirme que sua leitura foi bloqueada.
5. Confira o aviso de disponibilidade, marque-o como lido e entre novamente para confirmar a persistência.
6. Com uma segunda conta, confira a reserva de um exemplar ocupado e a prioridade após a devolução. Nunca compartilhe senhas entre contas.
7. Confira os fluxos no celular, incluindo o fechamento do painel de notificações e a ausência de rolagem horizontal da página.
8. Abra o console do navegador e confira erros ou avisos nos fluxos normais. Falhas intencionais, como acesso sem token, devem ser tratadas pela interface.

Os testes locais com emuladores não comprovam a publicação de regras, variáveis, funções ou domínios no projeto real. A revisão da versão pública só termina após essas verificações.

## Referências

- [Publicação pela integração Git da Vercel](https://vercel.com/docs/git)
- [Versões Node.js na Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Regras de segurança do Firestore](https://firebase.google.com/docs/firestore/security/get-started)
