<p align="center">
  <img src="public/favicon.svg" width="96" height="96" alt="Cervo com um livro aberto ao fundo, símbolo do LaCervo" />
</p>

<h1 align="center">LaCervo</h1>

<p align="center">
  Uma biblioteca para descobrir clássicos e encontrar seu próximo canto de leitura.
</p>

<p align="center">
  <a href="https://la-cervo-umber.vercel.app/">Acessar o site</a> ·
  <a href="#sobre-o-projeto">Sobre o projeto</a> ·
  <a href="#como-executar">Como executar</a> ·
  <a href="#tecnologias">Tecnologias</a> ·
  <a href="#testes">Testes</a>
</p>

![Estante digital do LaCervo com interface vintage e o símbolo do cervo com livro](docs/images/estante.jpg)

## Sobre o projeto

O **LaCervo** é uma aplicação web desenvolvida por **Caiã Lucas Leite Oliveira** como projeto final de Web Development da **Jala University**. Permite explorar um catálogo de livros, consultar detalhes, realizar empréstimos virtuais, reservar exemplares, organizar uma lista de desejos e acompanhar o histórico e o progresso de leitura.

O catálogo próprio reúne metadados sincronizados de edições transcritas da **Wikisource em português** e uma seleção da **Open Library**. A busca e a ordenação por autor abrangem todo o acervo indexado, antes da paginação. Os textos e capítulos são carregados online e podem ser lidos no próprio site mediante um empréstimo válido. Cada conta pode manter até **três empréstimos ativos**, com prazo de **14 dias**.

Livros salvos na lista de desejos geram notificações no site quando um exemplar fica disponível para o leitor, respeitando a fila de reservas. Os avisos permanecem disponíveis ao entrar novamente e podem ser marcados como lidos.

A aplicação possui interface mobile-first em português, autenticação pelo Firebase e persistência de empréstimos, reservas e histórico no Cloud Firestore.

## Como executar

Requer **Node.js 24.x**. Na raiz do projeto, copie [`.env.example`](.env.example) para `.env.local` e preencha a configuração do seu aplicativo Web Firebase, mantendo `VITE_USE_FIREBASE_EMULATORS=false`. Habilite **E-mail/senha** no Firebase Authentication, crie o banco Firestore `(default)` e publique as regras de [`firestore.rules`](firestore.rules).

```bash
npm ci
npm start
```

Acesse **http://127.0.0.1:5173**. O comando inicia a interface e a API local. Para gerar a versão de produção, execute `npm run build`.

O índice já acompanha o projeto. Para atualizar os metadados pelas APIs públicas, execute `npm run catalog:sync`, reinicie a aplicação e inclua `server/data/catalog.json` na próxima publicação. A sincronização não exige credenciais e não baixa o texto dos livros.

Para atualizar o site e as regras do Firebase, consulte o [guia de publicação](docs/PUBLICACAO.md).

## Tecnologias

| Finalidade | Tecnologias |
| --- | --- |
| Interface | React, TypeScript, CSS Modules e Lucide |
| Roteamento | React Router |
| Gerenciamento de estado | Redux Toolkit e RTK Query |
| Autenticação e persistência | Firebase Authentication e Cloud Firestore |
| Integração de conteúdo | Índice próprio de metadados, Fetch API, Open Library, API MediaWiki da Wikisource e Cheerio |
| Desenvolvimento e implantação | Vite, Node.js e Vercel |
| Testes | Jest, React Testing Library e Firebase Local Emulator Suite |

## Testes

A suíte verifica componentes, hooks e regras de domínio, incluindo busca, ordenação global por autor entre páginas, autenticação, empréstimos, reservas, histórico, lista de desejos, notificações, navegação por teclado, paginação e acesso ao leitor. Dependências externas são simuladas nos testes unitários e de integração da interface.

```bash
npm test
npm run test:coverage
```

O relatório de cobertura fica em `coverage/lcov-report/index.html`.

Para verificar autenticação, regras do Firestore, concorrência, reservas e o limite de empréstimos com os emuladores oficiais, instale **Java 21 ou superior** e execute:

```bash
npm run test:rules
```

Essa suíte utiliza somente o projeto local `demo-lacervo`, inicia e encerra seus próprios emuladores e não integra o relatório de cobertura acima.
