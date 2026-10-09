# LaCervo

Biblioteca universitária com React, TypeScript, Redux Toolkit, Open Library e Firebase. Uma única aplicação, executada com `npm start`.

## Rodar

Requer Node.js 22.12 ou superior.

```bash
npm ci
npm start
```

Abra http://localhost:5173. Se a porta estiver ocupada, o terminal informa o endereço utilizado. Encerre com Ctrl + C.

## Conectar seu Firebase

O catálogo público funciona sem configuração. Login e dados pessoais precisam de um projeto Firebase; o aplicativo não simula autenticação ou empréstimos.

1. No [console Firebase](https://console.firebase.google.com/), crie um projeto e registre um aplicativo Web, pelo ícone `</>` nas configurações do projeto.
2. Em **Authentication > Método de login**, habilite **E-mail/senha**. O site oferece login, criação de conta e recuperação de senha. Confira os domínios autorizados: inclua `localhost`, `127.0.0.1` se necessário e, ao publicar, o domínio do site.
3. Copie `.env.example` para `.env.local`. Preencha os campos usando a configuração do aplicativo Web:

```dotenv
VITE_OPEN_LIBRARY_URL=https://openlibrary.org
VITE_FIREBASE_API_KEY=valor-de-apiKey
VITE_FIREBASE_AUTH_DOMAIN=valor-de-authDomain
VITE_FIREBASE_PROJECT_ID=valor-de-projectId
VITE_FIREBASE_APP_ID=valor-de-appId
VITE_USE_FIREBASE_EMULATORS=false
```

4. Crie o **Cloud Firestore**, na edição Standard, com um banco `(default)` em modo de produção. Na aba **Regras**, substitua o conteúdo pelo arquivo `firestore.rules` deste projeto e clique em **Publicar**.
5. Cadastre pelo menos um exemplar em **Firestore > Dados > Iniciar coleção**. Crie a coleção `copies` e o documento `OL1003040W`, com estes campos:

| Campo | Tipo | Valor |
| --- | --- | --- |
| `workId` | string | `OL1003040W` |
| `activeLoanId` | null | null |
| `queue` | array | vazio |
| `book` | map | campos abaixo |
| `book.title` | string | `Dom Casmurro` |
| `book.authors` | array | uma string: `Machado de Assis` |
| `book.coverId` | number | `647501` |

Dentro do mapa `book`, os nomes são `title`, `authors` e `coverId`; os pontos na tabela indicam a hierarquia. Para outros livros, use o ID `OL...W` da página de detalhes e os respectivos metadados. Sem exemplar cadastrado, a obra aparece no catálogo, mas não pode ser emprestada.

6. Reinicie `npm start`, crie sua conta no site e abra http://localhost:5173/livros/OL1003040W. Solicite um empréstimo e confira **Minha biblioteca**. Para verificar reservas, crie uma segunda conta e use outra janela/perfil de navegador.

Não é necessário cadastrar manualmente empréstimos, reservas ou contas de circulação no Firestore: as operações criam esses registros automaticamente. Não altere documentos de exemplares que tenham empréstimos ou reservas ativos. Configuração Web não é uma chave privada; nunca coloque credenciais de conta de serviço no frontend. `.env.local` é ignorado pelo Git.

## Funcionalidades da fase 2

- Empréstimos de exemplares cadastrados por 14 dias corridos, até três ativos por conta.
- Devolução com confirmação, preservação do histórico e indicação de atraso.
- Reservas de exemplares emprestados, fila por ordem de solicitação, cancelamento e prioridade exclusiva para o primeiro leitor quando o livro é devolvido. A disponibilidade se atualiza em tempo real; não há envio automático de notificações.
- Status de leitura: Não iniciado, Lendo e Concluído, salvo independentemente dos empréstimos.
- Login, cadastro e recuperação de senha pelo Firebase Authentication.
- Popularidade global baseada nos registros de leitura da Open Library. A ordenação por autor é **da página atual**, explicitamente indicada na interface; a API não oferece ordem global por autor. Data e relevância continuam globais.

## Verificar

```bash
npm test
npm run test:coverage
npm run build
```

Os testes usam Jest e React Testing Library. Cobrem `BookCard`, `BookActions`, `Login`, `Layout` e `Catalog`, além do hook personalizado `useReaderLibrary`. As verificações incluem carregamento, busca, falhas e nova tentativa, login, cadastro, recuperação de senha, logout e limpeza dos dados quando a conta muda. As dependências externas são simuladas nos testes da interface: `fetch` para a Open Library e métodos/listeners do SDK Firebase. O relatório de cobertura é gerado em `coverage/lcov-report/index.html` e não inclui a execução dos emuladores.

Para testar o fluxo de autenticação com o backend local, as regras reais do banco e as transações concorrentes, também é necessário Java 21 ou superior disponível no terminal:

```bash
npm run test:rules
```

Esse comando usa apenas o projeto local `demo-lacervo`, sem login no console ou conexão com um projeto real. Inicia os emuladores oficiais de Authentication e Firestore, verifica login e logout, envia um ID token no cabeçalho `Authorization: Bearer` de uma requisição REST protegida e confirma o bloqueio de acesso sem autenticação. Também verifica empréstimos, concorrência, reservas e isolamento entre contas. Os emuladores são encerrados ao terminar.

## Testar sem criar um projeto real (opcional)

É o mesmo aplicativo conectado aos emuladores oficiais do Firebase. Requer Java 21 ou superior. No `.env.local`, use:

```dotenv
VITE_OPEN_LIBRARY_URL=https://openlibrary.org
VITE_FIREBASE_API_KEY=demo-lacervo-key
VITE_FIREBASE_AUTH_DOMAIN=demo-lacervo.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-lacervo
VITE_FIREBASE_APP_ID=demo-lacervo-app
VITE_USE_FIREBASE_EMULATORS=true
```

Em um terminal, mantenha `npm run emulators` aberto. Em outro, execute `npm run seed:emulator` e `npm start`. Acesse o site normalmente. Contas descartáveis: `leitor@lacervo.test` e `colega@lacervo.test`, senha `Leitura123!`. O script só acessa endereços locais e cadastra um exemplar de Dom Casmurro sem sobrescrever sua circulação.

O painel dos emuladores fica em http://127.0.0.1:4000. Os dados são temporários e desaparecem ao encerrar os emuladores. Para conectar um projeto real, troque a configuração pelos valores dele e mantenha `VITE_USE_FIREBASE_EMULATORS=false`. Builds de produção nunca conectam aos emuladores.

## Próxima etapa

Conectar o Firebase real, revisar a aplicação para a entrega, validar requisitos finais e publicar em HTTPS. Nenhum projeto, conta real ou site público foi criado automaticamente. `ARQUITETURA.md` descreve o modelo e as proteções implementadas.
