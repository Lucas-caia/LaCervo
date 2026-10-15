# LaCervo — arquitetura

## Organização e estado

React e TypeScript compõem a interface, com React Router, CSS Modules e layout mobile-first. Redux Toolkit mantém a identidade do leitor; RTK Query gerencia consultas e cache. Context compartilha desejos e notificações, formulários e preferências usam estado local, e filtros, capítulos e páginas ficam na URL. O SDK Firebase gerencia a sessão e a renovação dos tokens.

| Pasta | Responsabilidade |
| --- | --- |
| `src/` | Interface, estado, regras de domínio e integração Firebase |
| `api/` | Endpoints de catálogo, metadados e leitura |
| `server/` | Índice do catálogo, consulta à Wikisource e autorização |
| `scripts/` | Sincronização, verificações e preparação dos emuladores |
| `tests/` | Integração com Authentication e regras Firestore nos emuladores |

## Catálogo e leitura

O catálogo reúne edições transcritas elegíveis da Wikisource em português e uma seleção da Open Library. `npm run catalog:sync` atualiza `server/data/catalog.json`, contendo somente metadados obtidos das APIs. A atualização é manual e precisa acompanhar a próxima publicação; uma falha preserva a versão anterior. O catálogo não espelha integralmente as fontes.

O servidor indexa palavras e aplica busca, filtros e ordenação antes da paginação. A ordenação por autor abrange todo o acervo indexado. Apenas edições digitais disponíveis da Wikisource permitem novos empréstimos e leitura; referências da Open Library também podem ser salvas nos desejos.

`/api/catalog` entrega os resultados paginados; `/api/wikisource` consulta os detalhes atuais da edição. `/api/read` carrega capítulos sob demanda, na ordem da obra. Cheerio extrai texto no servidor, e React apresenta os parágrafos sem inserir HTML externo. O leitor oferece paginação, ajuste de fonte, tema noturno e créditos da fonte.

## Empréstimos e segurança

Cada edição digital representa um exemplar virtual. Transações Firestore atualizam exemplar, empréstimo e conta atomicamente. Cada leitor pode manter até três empréstimos ativos, com leitura por 14 dias. Devolver libera a vaga e preserva o histórico; vencer bloqueia a leitura, mas a vaga continua ocupada até a devolução. Reservas seguem a fila, com prioridade para seu primeiro leitor.

A API de leitura recebe um Firebase ID token, valida a identidade e verifica proprietário, obra, prazo e estado do empréstimo no Firestore. As respostas usam `private, no-store`. As regras de `firestore.rules` também validam as transições, o limite de empréstimos e o acesso aos dados pessoais. Tokens e senhas não ficam no Redux ou em logs. A fonte original continua pública fora do aplicativo.

## Desejos e notificações

Desejos são únicos por leitor e obra. Devoluções e cancelamentos que liberem a prioridade geram eventos persistidos na mesma transação. Ao usar o site, o leitor recupera eventos posteriores à inclusão nos desejos e recebe avisos sem duplicação, respeitando a fila.

As notificações são internas ao site, podem ser marcadas como lidas e permanecem salvas entre sessões. Elas registram uma disponibilidade passada; o exemplar pode ter sido emprestado novamente. Remover um desejo interrompe novos avisos. Listeners e dados privados são limpos na troca de conta.

## Execução, publicação e testes

`npm start` inicia interface e APIs locais pelo Vite. Na Vercel, os arquivos de `api/` tornam-se funções de servidor. `vercel.json` configura build, catálogo e roteamento; as regras Firestore devem ser publicadas separadamente. O projeto usa Node.js 24.x, e emuladores ficam restritos ao desenvolvimento.

Jest e React Testing Library verificam interface, hooks e funções do servidor. A suíte separada dos emuladores testa autenticação, concorrência, regras e isolamento entre contas. `npm run build` valida o catálogo e gera a aplicação; `npm run verify:deploy` confere as rotas públicas. A cobertura da aplicação não inclui os testes dos emuladores. A validação local deve ser complementada pelos fluxos autenticados na versão publicada.
