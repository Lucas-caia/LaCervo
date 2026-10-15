export function circulationError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === 'permission-denied') return 'Não foi possível autorizar esta operação. Atualize a página e tente novamente.';
  if (code === 'unavailable') return 'Sem conexão com a biblioteca. Verifique a internet e tente novamente.';
  if (code === 'aborted') return 'Outro leitor atualizou este livro. Tente novamente.';
  return error instanceof Error && !code ? error.message : 'Não foi possível concluir. Tente novamente.';
}
