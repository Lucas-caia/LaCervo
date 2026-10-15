# Revisão final do LaCervo

Data: **15/10/2026**. Escopo: código local, build de produção, APIs locais, navegador e Firebase Local Emulator Suite.

## Correções e refinamentos

- URLs de catálogo ou estante que apontem para uma página além do resultado atual são corrigidas para a última página válida, preservando busca e filtros.
- Ao trocar de página, a interface rola até os resultados e posiciona o foco no título da seção, facilitando navegação por teclado e leitura em telas pequenas.
- O painel de notificações possui botão visível de fechamento, fecha ao clicar fora ou pressionar Escape e devolve o foco ao sino quando apropriado. As margens móveis respeitam a largura útil da tela, inclusive com barra de rolagem vertical.
- Capas sem autor usam “Autor não informado”, sem atribuir incorretamente uma referência à Wikisource.
- Assuntos duplicados ou vazios da Open Library são removidos antes de renderizar as etiquetas, prevenindo chaves React repetidas.
- A Vercel recebe configuração explícita de instalação, build, framework e saída. Node.js foi fixado em 24.x para evitar a troca automática de versão principal causada pelo intervalo anterior.
- O comando `npm run verify:deploy` confere páginas públicas, ícone, JSON das APIs e bloqueio da leitura sem token.

## Verificações executadas

| Verificação | Resultado |
| --- | --- |
| Jest e React Testing Library, incluindo testes de servidor | 95 testes passaram em 19 suítes |
| Authentication e regras Firestore nos emuladores oficiais | 24 testes passaram em 3 suítes |
| Build de produção e TypeScript | Aprovados, sem avisos do Vite |
| Instalação reproduzível com npm 11.21.0 | `npm ci --dry-run --ignore-scripts --no-audit --no-fund` aprovado |
| Dependências de produção | Nenhuma vulnerabilidade conhecida reportada por `npm audit --omit=dev` |
| Formatação do diff | Sem erros de whitespace |
| Verificação HTTP local | 6 verificações passaram: páginas, ícone e três APIs |
| Catálogo | 1.074 metadados válidos, sem textos de livros armazenados |

O relatório `coverage/lcov-report/index.html` registra **66,66% de cobertura de linhas** na suíte da aplicação. A cobertura não inclui os testes separados dos emuladores nem mede o código do servidor fora de `src/`. Os repositórios Firestore são exercitados na suíte dos emuladores; a porcentagem acima não é uma cobertura combinada dessas suítes.

## Navegador e experiência de uso

Foram conferidos login, logout, troca de conta, catálogo com ordenação por autor e paginação, estante, detalhes, lista de desejos, leitura de capítulo real da Wikisource, tamanho da fonte, tema noturno, devolução e bloqueio posterior da leitura.

Com duas contas locais distintas, foi verificada a reserva de um exemplar ocupado, sua devolução preservando a fila, a recuperação do aviso ao entrar novamente e a retirada pelo primeiro leitor. O empréstimo cumpriu a reserva, retirando-a da aba de reservas e incluindo-o nos empréstimos ativos. A conta sem prioridade não recebeu um novo aviso de disponibilidade.

A lista de desejos e o estado lido dos avisos persistiram após sair e entrar. O painel foi conferido em larguras simuladas de 320 e 390 pixels, sem transbordamento horizontal da página. A revisão também incluiu o layout padrão de desktop. O console capturado não apresentou erros ou avisos de JavaScript nos fluxos exercitados. As falhas de rede e de autorização são verificadas separadamente pelos testes automatizados.

## Situação da versão pública

**Pendente de atualização e validação final.** Na conferência do endereço `https://la-cervo-umber.vercel.app/`, interface, estante e ícone responderam, mas `/api/catalog`, `/api/wikisource` e `/api/read` ainda retornaram HTML. O bloqueio de leitura sem token deveria responder 401 com JSON; a versão pública respondeu 200 com HTML.

O bundle público anterior contém o project ID Firebase esperado. Não foi possível confirmar as variáveis atuais no painel da Vercel ou a publicação das regras no projeto real. Os arquivos locais de produção não contêm os quatro valores Firebase completos; os valores precisam estar no ambiente Production da Vercel.

O código local passou na revisão dos cenários descritos. O item de publicação só pode ser encerrado após o envio ao GitHub, publicação das regras Firestore, deploy Ready do commit correto e validação autenticada no endereço público. Siga [PUBLICACAO.md](PUBLICACAO.md).
