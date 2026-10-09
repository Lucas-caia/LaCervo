# LaCervo — arquitetura até a fase 2

React + TypeScript, Vite, React Router, Redux Toolkit e CSS Modules. Redux mantém a identidade serializável; RTK Query cuida do catálogo público. O SDK do Firebase mantém a sessão. Formulários usam estado local; filtros e paginação ficam na URL.

## Dados e circulação

Open Library fornece apenas metadados. O estoque da biblioteca está em `copies/{workId}` e é cadastrado pelo administrador no console Firebase. Cada obra cadastrada representa um exemplar virtual. Obras sem exemplar não são apresentadas como disponíveis para empréstimo.

| Coleção | Dados |
| --- | --- |
| `copies/{workId}` | work ID, resumo do livro, empréstimo ativo ou null, fila de UIDs |
| `readerAccounts/{uid}` | IDs dos empréstimos ativos, no máximo três |
| `loans/{id}` | UID, work ID, resumo do livro, empréstimo e devolução como timestamps do servidor |
| `reservations/{uid_workId}` | UID, work ID, resumo, data do servidor e estado waiting/fulfilled/cancelled |
| `readingProgress/{uid_workId}` | UID, work ID, resumo, estado not-started/reading/completed e atualização do servidor |

O vencimento é calculado acrescentando 14 dias corridos ao timestamp do empréstimo gravado pelo servidor. A UI recebe datas ISO UTC e exibe no horário do navegador. Atraso é derivado do prazo e da ausência de devolução.

`circulationRepository.ts` implementa transações Firestore. Empréstimo atualiza exemplar, histórico e conta atomicamente; devolução registra a data e libera o exemplar sem apagar o histórico. A fila é preservada na devolução: enquanto existir, apenas seu primeiro leitor pode emprestar. O cancelamento remove o próprio UID sem reordenar os demais. A retirada cumpre a reserva e remove o primeiro da fila. O estado ready é derivado do exemplar disponível e do primeiro UID da fila, evitando atualizar dados privados de outro leitor.

Não é permitido reservar a própria obra emprestada, duplicar uma reserva ativa ou reservar um exemplar disponível. A fila admite até 100 leitores por obra. Os limites numéricos são escolhas do projeto, não exigências numéricas do enunciado. Não há multas, renovação, expiração de prioridade, lista de desejos ou notificações automáticas no escopo atual.

## Proteções

As regras do Firestore conferem cada transição e seus documentos relacionados com `getAfter`. Alterar a conta, a fila ou o histórico isoladamente é proibido. A capacidade de três empréstimos também é validada no banco, inclusive contra requisições que ignorem o frontend. Operações concorrentes usam transações e transforms atômicos (`arrayUnion`/`arrayRemove`). A interface trata falhas e bloqueia cliques repetidos durante uma operação.

Leitores só consultam seu histórico, reservas, conta e progresso. Leitores autenticados podem consultar exemplares e suas filas para verificar disponibilidade e posição. Filas contêm apenas UIDs, sem e-mails ou outros dados de conta. Cadastro e alteração de metadados de estoque ficam fechados ao cliente e são administrados pelo console. Timestamps são conferidos contra `request.time`, impedindo alterar arbitrariamente datas de circulação. Senhas não ficam no Redux nem em logs.

A interface mantém a última consulta confirmada enquanto há escritas pendentes; não apresenta operações ainda não aceitas pelo servidor como concluídas. A auditoria de dependências de produção terminou sem vulnerabilidades conhecidas. O CLI Firebase, usado apenas em desenvolvimento, ainda apresenta alertas transitivos no `npm audit` completo; a revisão dessas ferramentas fica registrada para a fase 3. A dependência transitiva gRPC do SDK foi fixada numa versão corrigida, sem rebaixar o Firebase.

Descrições da API são texto React, sem HTML injetado. Busca tem limite de 120 caracteres, work IDs são validados e formulários têm validação. Listeners em tempo real são encerrados ao sair da página ou trocar de conta; dados do leitor anterior não aparecem durante a mudança de sessão.

## Catálogo e desempenho

Busca estruturada por título/autor/palavras-chave, categorias, paginação de 12 itens, timeout de 15 segundos, cache de dois minutos, carregamento de rotas sob demanda e capas com lazy loading/fallback. Relevância, data e popularidade são ordenadas na API antes da paginação. Popularidade usa `sort=readinglog` (quantidade de registros de leitura).

A Open Library não oferece ordenação global por autor. A opção Autor A–Z organiza somente a página recebida e deixa esse alcance visível. Se a avaliação exigir essa ordem em todo o catálogo, será necessário um catálogo indexado próprio ou um provedor que suporte o requisito. Essa limitação não está apresentada como requisito global concluído.

## Validação e entrega

Jest e React Testing Library verificam ações vistas pelo leitor em cinco componentes críticos (`BookCard`, `BookActions`, `Login`, `Layout` e `Catalog`) e no hook personalizado `useReaderLibrary`. Os testes da interface simulam `fetch` e as dependências do Firebase, cobrindo carregamento, erros, nova tentativa, sessão e encerramento de listeners. A configuração Vite foi isolada em `runtimeConfig.ts` para fornecer valores controlados aos testes sem alterar o comportamento do aplicativo.

Testes do emulador executam o mesmo repositório usado pelo aplicativo e as regras reais. Cobrem circulação, concorrência, capacidade, FIFO, cancelamentos, histórico, isolamento de contas, escrita indevida e leitura independente. Um teste adicional autentica uma conta descartável no emulador Authentication, envia seu ID token como `Authorization: Bearer` à API REST do Firestore, verifica o bloqueio sem token e confirma o encerramento da sessão e a rejeição de novas operações após logout. O SDK gerencia a persistência e a renovação da sessão; não há armazenamento manual de senhas ou tokens no Redux. Logout não equivale à revogação imediata de todos os tokens anteriormente emitidos.

A verificação do laboratório aprovou 28 testes de componentes, hooks e funções, mais 10 testes de integração com os emuladores (38 no total). A compilação também passou. O relatório `test:coverage` cobre somente a suíte da interface e de funções, não os testes executados nos emuladores; ele não representa cobertura integral de toda a aplicação.

A configuração de um projeto Firebase real ainda precisa ser fornecida. Os testes locais não comprovam que regras, domínios e configurações foram publicados corretamente numa instância real. A fase 3 inclui essa conexão, revisão final e publicação HTTPS. `vercel.json` já prepara acesso direto às rotas para uma futura publicação na Vercel.

## Referências

- [Transações Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Validação de operações atômicas com Security Rules](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Testes das regras com o emulador](https://firebase.google.com/docs/rules/unit-tests)
- [Open Library Search API](https://openlibrary.org/dev/docs/api/search)
- [Ordenações suportadas pela Open Library](https://github.com/internetarchive/openlibrary/blob/master/openlibrary/plugins/worksearch/schemes/works.py)
