# LaCervo — arquitetura

React, TypeScript, Vite, React Router, Redux Toolkit e CSS Modules. Redux mantém a identidade serializável; RTK Query cuida dos catálogos. O SDK Firebase gerencia persistência e renovação da sessão. Formulários e preferências usam estado local; filtros, capítulos e páginas ficam na URL.

## Fontes e leitura

O catálogo próprio reúne metadados da Wikisource em português e uma seleção da Open Library. `npm run catalog:sync` descobre todas as páginas principais retornadas pela busca `insource:pages -insource:from` (edições transcritas elegíveis), consulta seus metadados e importa até 200 referências em português por categoria da Open Library, priorizando registros de leitura. Não representa toda a Wikisource nem os milhões de registros da Open Library. IDs de circulação das edições digitais têm o formato `WS<pageid>`.

O resultado é persistido em `server/data/catalog.json`, gerado pelas fontes, sem títulos predefinidos manualmente ou texto de livros. IDs repetidos da Open Library são unificados e mantêm as categorias de origem. Wikisource e Open Library preservam identidades separadas, pois podem representar edições diferentes. Categorias de gênero não são inventadas para edições da Wikisource que não fornecem esse dado; essas obras aparecem em Todos e na estante digital.

`server/catalogIndex.js` constrói listas invertidas de palavras normalizadas (sem diferenças de acentuação ou caixa), com pesquisa por prefixos, campos título/autor e interseção entre termos. Ordens completas por autor, ano e popularidade são calculadas uma vez por processo. Busca, categoria e fonte são aplicadas antes do recorte de 12 registros por página. Empates usam título e ID; autores ou anos ausentes ficam no fim. A ordenação por autor abrange todo o catálogo indexado. A Open Library não oferece esse critério global na API de busca. Popularidade usa seu `readinglog_count`; edições da Wikisource não possuem esse indicador. Relevância prioriza título e autor entre os resultados encontrados.

`/api/catalog` entrega somente a página solicitada e a data/contagem da versão publicada. O servidor carrega o índice uma vez; o JSON completo não faz parte do bundle do navegador. A estante usa o mesmo índice com filtro de fonte. Detalhes, elegibilidade atual e capítulos continuam sendo consultados na fonte. O cache público de respostas pode durar até cinco minutos. Uma atualização exige sincronizar, incluir o arquivo gerado na publicação e reiniciar os processos locais; não há agendamento automático.

A sincronização limita concorrência, utiliza pausas e tentativas em falhas transitórias, valida o índice e só substitui o arquivo ao terminar as duas fontes. Uma falha mantém a versão anterior. A seleção Open Library pode ser ajustada pela variável de processo `CATALOG_OPEN_LIBRARY_PER_CATEGORY` (1–1000). Se a descoberta Wikisource ultrapassar a janela de 10.000 resultados, o processo interrompe em vez de publicar uma versão silenciosamente truncada. `npm run build` valida a presença e a consistência do catálogo. A Vercel inclui explicitamente o arquivo nas funções. Não são necessárias conta de serviço, nova coleção Firestore ou credenciais privadas para o catálogo.

`server/wikisource.js` consulta uma origem fixa, valida IDs, interpreta os metadados e monta os capítulos na ordem dos links da edição. Somente subpáginas existentes da própria obra são aceitas. Capítulos são carregados sob demanda. A extração usa Cheerio no servidor e entrega parágrafos de texto: HTML externo não é executado nem inserido no DOM. O leitor preserva os parágrafos, pagina o conteúdo e oferece ajuste de fonte e tema noturno. Créditos, revisão e link para a edição são exibidos no leitor.

`/api/wikisource` entrega apenas metadados públicos. `/api/read` exige `Authorization: Bearer <Firebase ID token>`, valida a identidade com Firebase Authentication REST e consulta o Firestore REST usando o mesmo token. As regras do banco continuam sendo aplicadas. O empréstimo deve pertencer ao usuário e à obra, estar sem devolução, dentro de 14 dias e constar tanto na conta quanto no exemplar. Respostas de leitura usam `private, no-store`. Logout, devolução e vencimento retiram o texto da interface; cada nova solicitação ao servidor verifica novamente a autorização.

A fonte continua pública fora do LaCervo; o empréstimo controla o acesso oferecido pelo aplicativo. Não há garantia de disponibilidade permanente ou de imutabilidade da Wikisource. A UI trata falhas e obras sem edição elegível. O servidor mantém um cache limitado de consultas à fonte por cinco minutos, sem armazenar autorização nesse cache.

## Circulação

| Coleção | Dados |
| --- | --- |
| `copies/{workId}` | resumo do livro, empréstimo ativo ou null, fila de UIDs |
| `readerAccounts/{uid}` | IDs dos empréstimos ativos, no máximo três |
| `loans/{id}` | UID, obra, resumo, data do empréstimo e devolução |
| `reservations/{uid_workId}` | UID, obra, resumo, data e estado |
| `readingProgress/{uid_workId}` | UID, obra, resumo, status e atualização |

Cada obra da estante representa um exemplar virtual. O primeiro empréstimo cria o exemplar na mesma transação que o empréstimo e a conta. Não é permitido criar um exemplar isoladamente pelo cliente. As regras verificam o formato dos metadados; a edição usada pelo leitor é obtida novamente da Wikisource no servidor.

`circulationRepository.ts` implementa transações Firestore. Empréstimos atualizam exemplar, histórico e conta atomicamente. Devoluções liberam o exemplar e a vaga sem apagar o histórico. Um empréstimo vencido continua ativo para fins de capacidade até sua devolução, mas não permite leitura.

A fila é preservada na devolução: seu primeiro leitor tem prioridade para emprestar. Cancelamentos removem apenas o próprio UID; a retirada cumpre a reserva. Não se pode reservar a própria obra emprestada, duplicar reserva ativa ou reservar um exemplar livre. O limite da fila é 100 leitores. Não há multas ou renovações. As notificações de disponibilidade são internas ao aplicativo.

Novos empréstimos aceitam somente IDs Wikisource. IDs antigos da Open Library continuam aceitos para devolução, histórico e progresso, preservando dados existentes. Esses empréstimos antigos também ocupam vagas até serem devolvidos.

## Lista de desejos e notificações

`wishlist/{uid_workId}` armazena uma entrada única por leitor e obra. Referências da Open Library também podem ser salvas; somente edições digitais Wikisource geram avisos. As regras permitem consulta e remoção apenas pelo proprietário e preservam a data original da inclusão.

Devoluções e cancelamentos que liberem a prioridade de um exemplar criam um evento imutável em `copies/{workId}/availability/{eventId}`, na mesma transação da circulação. O evento inclui data do servidor, resumo do livro e o UID com prioridade, ou null quando a fila está vazia. As regras exigem a transição real correspondente e impedem a criação isolada, alteração ou exclusão de eventos.

Ao entrar, o aplicativo acompanha os eventos posteriores à inclusão de cada obra digital na lista. Eventos ocorridos durante a ausência são recuperados e registrados em `notifications/{uid_workId_eventId}`. A criação é idempotente e validada no Firestore contra a lista, o evento e sua elegibilidade. Não há processo de e-mail, push ou Cloud Functions adicional: a notificação é materializada na conta enquanto o leitor usa o site, a partir de eventos persistidos pelo backend.

Avisos são históricos: o exemplar pode ter sido emprestado novamente antes da consulta. Por isso, a interface informa que ele ficou disponível e oferece um link para verificar a disponibilidade atual. `readAt` é atualizado apenas pelo proprietário, sem reabrir avisos lidos. Remover uma obra da lista interrompe novos avisos, preservando os que já foram registrados. Os listeners e o conteúdo da conta são limpos na troca de sessão.

As regras atualizadas devem ser publicadas junto da atualização do aplicativo. Não há migração obrigatória dos exemplares existentes: o campo `availabilityEventId` é adicionado na primeira devolução ou mudança de prioridade realizada pela nova versão. Transições anteriores à atualização não geram eventos retroativos.

## Proteções

As regras Firestore conferem transições e documentos relacionados com `getAfter`. O limite de três é aplicado no banco, inclusive em requisições concorrentes que ignorem a interface. Timestamps são comparados a `request.time`; a UI não informa como concluída uma escrita ainda não confirmada.

Cada leitor só consulta sua conta, histórico, reservas e progresso. Exemplares são consultáveis por leitores autenticados; suas filas contêm UIDs, sem e-mails. Metadados existentes de exemplares não podem ser alterados pelo cliente. Senhas e tokens não ficam no Redux ou em logs. Logout encerra a sessão local; não equivale à revogação imediata de todos os tokens já emitidos.

Busca, IDs e índices de capítulos têm limites. Endpoints não aceitam URLs externas arbitrárias. HTML e scripts da fonte são removidos; textos são renderizados por React. Listeners e requisições são encerrados quando necessário; os dados anteriores não aparecem durante uma troca de conta.

## Execução e publicação

Uma única aplicação é iniciada com `npm start`. O Vite fornece os endpoints locais; na Vercel, `api/catalog.js`, `api/wikisource.js` e `api/read.js` são funções do servidor. As APIs locais e publicadas usam os mesmos módulos de implementação. A autorização usa a configuração Web Firebase existente, sem credenciais de conta de serviço. Emuladores são permitidos apenas em desenvolvimento.

`vercel.json` mantém as rotas da API e dos assets fora do fallback da SPA. Regras Firestore precisam ser publicadas separadamente no console Firebase; enviar o frontend à Vercel não as atualiza.

## Layout mobile-first

Os estilos de Layout, Catalog, Ui, Reader e ReaderExtras definem primeiro o comportamento de telas pequenas. Media queries de `min-width` ampliam a interface progressivamente, preservando o tema e a composição de desktop. Capas usam cartões flexíveis para manter os botões de desejos dentro da área visível; busca e filtros se reorganizam, a biblioteca adapta seus indicadores e o leitor distribui a navegação por páginas em linhas separadas quando necessário.

A conferência local no navegador cobriu larguras de 320, 390, 768 e 1366 pixels. Foram verificados catálogo, estante, login, detalhes, biblioteca, leitura e notificações, incluindo limites da página, altura de controles e posicionamento dos avisos. A faixa de abas da biblioteca possui rolagem horizontal própria, sem ampliar a largura da página. Essa conferência usa viewports simulados; a validação no aparelho real permanece parte da revisão após o deploy.

O leitor solicita explicitamente `parser=legacy` à API MediaWiki para obter o HTML e os indicadores de existência de capítulos esperados pelo extrator. Um teste verifica esse parâmetro tanto para a obra quanto para cada parte, evitando depender do parser padrão da fonte externa.

## Validação

A revisão final, seus resultados e o estado da publicação estão registrados em [docs/REVISAO-FINAL.md](docs/REVISAO-FINAL.md). O passo a passo para atualizar a Vercel e as regras Firestore está em [docs/PUBLICACAO.md](docs/PUBLICACAO.md).

A paginação corrige URLs que ultrapassem o total atual de páginas e devolve o foco aos novos resultados. O painel de notificações oferece fechamento explícito, por clique externo e por Escape, com retorno de foco ao sino. Metadados de assuntos da Open Library são deduplicados antes da renderização.

Jest e React Testing Library verificam componentes, hooks, busca, paginação, sessão, erros, preferências do leitor e bloqueio de leitura sem empréstimo válido. Testes de servidor verificam extração de conteúdo, capítulos e autorização. Fixtures existem apenas nos testes e não alimentam o acervo.

Os emuladores executam o mesmo repositório e as mesmas regras do aplicativo. Verificam concorrência, capacidade, devoluções, fila, isolamento de contas e escrita indevida. Um teste autentica no emulador Authentication e verifica a autorização de leitura usando token e Firestore REST, incluindo o bloqueio após devolver.

A cobertura de `npm run test:coverage` não inclui os testes separados dos emuladores. Validação local não comprova que domínios, variáveis e regras foram publicados corretamente no projeto real.

## Referências

- [API MediaWiki](https://www.mediawiki.org/wiki/API:Main_page)
- [Wikisource: direitos de autor](https://pt.wikisource.org/wiki/Wikisource:Direitos_de_autor)
- [Firebase Authentication REST](https://firebase.google.com/docs/reference/rest/auth)
- [Firestore REST](https://firebase.google.com/docs/firestore/use-rest-api)
- [Transações Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Security Rules](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Open Library Search API](https://openlibrary.org/dev/docs/api/search)
