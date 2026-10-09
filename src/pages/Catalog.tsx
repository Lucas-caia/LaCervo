import { useEffect, useState, type FormEvent } from 'react';
import { BookOpen, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import BookCard from '../components/BookCard';
import { ErrorState } from '../components/States';
import { PAGE_SIZE, useSearchBooksQuery, type Category, type SearchField, type Sort } from '../services/books';
import styles from '../styles/Catalog.module.css';
import ui from '../styles/Ui.module.css';

const categories: { value: Category; label: string }[] = [
  { value: 'all', label: 'Todos' }, { value: 'fiction', label: 'Ficção' },
  { value: 'science', label: 'Ciência' }, { value: 'history', label: 'História' },
  { value: 'philosophy', label: 'Filosofia' }, { value: 'technology', label: 'Tecnologia' }
];

export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const query = (params.get('q') || '').slice(0, 120);
  const category = categories.find(item => item.value === params.get('category'))?.value || 'all';
  const field: SearchField = params.get('field') === 'title' ? 'title' : params.get('field') === 'author' ? 'author' : 'all';
  const selectedSort = params.get('sort');
  const sort: Sort = selectedSort === 'new' || selectedSort === 'old' || selectedSort === 'popular' || selectedSort === 'author' ? selectedSort : 'relevance';
  const parsedPage = Number(params.get('page') || 1);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 && parsedPage <= 100 ? parsedPage : 1;
  const [draft, setDraft] = useState(query);
  useEffect(() => setDraft(query), [query]);
  const { currentData: data, isFetching, isError, refetch } = useSearchBooksQuery({ query, category, field, sort, page });
  const totalPages = Math.min(100, Math.ceil((data?.total || 0) / PAGE_SIZE));
  function update(key: string, value: string) {
    const next = new URLSearchParams(params); next.set(key, value);
    if (key !== 'page') next.delete('page');
    setParams(next);
  }
  function submit(event: FormEvent) { event.preventDefault(); update('q', draft.trim()); }
  return <>
    <div className={styles.intro}><div><p className={ui.eyebrow}>ENCONTRE SUA PRÓXIMA LEITURA</p><h1>Explore o catálogo</h1><p>Livros para estudar, descobrir e ir além.</p></div><span className={styles.catalogMark}><BookOpen size={32} /></span></div>
    <form className={styles.search} role="search" onSubmit={submit}>
      <Search size={21} aria-hidden="true" />
      <input aria-label="Buscar livros" placeholder="Busque por título, autor ou palavra-chave" value={draft} maxLength={120} onChange={event => setDraft(event.target.value)} />
      {draft && <button type="button" className={styles.clear} aria-label="Limpar busca" onClick={() => { setDraft(''); update('q', ''); }}><X size={16} /></button>}
      <select aria-label="Buscar por" value={field} onChange={event => update('field', event.target.value)}><option value="all">Tudo</option><option value="title">Título</option><option value="author">Autor</option></select>
      <button className={ui.primary} type="submit">Buscar</button>
    </form>
    <div className={styles.categories} role="group" aria-label="Categorias">
      {categories.map(item => <button key={item.value} aria-pressed={category === item.value}
        className={category === item.value ? styles.selectedCategory : ''} onClick={() => update('category', item.value)}>{item.label}</button>)}
    </div>
    <div className={styles.resultsHeader}><div><h2>{query ? 'Resultados da busca' : category === 'all' ? 'Explore novas leituras' : categories.find(item => item.value === category)?.label}</h2>
      <p aria-live="polite">{isFetching ? 'Consultando o catálogo…' : data ? `${new Intl.NumberFormat('pt-BR').format(data.total)} livros encontrados` : 'Catálogo de livros'}</p></div>
      <label className={styles.sort}>Ordenar<select value={sort} onChange={event => update('sort', event.target.value)}><option value="relevance">Relevância</option><option value="new">Mais recentes</option><option value="old">Mais antigos</option><option value="popular">Mais populares</option><option value="author">Autor A–Z (nesta página)</option></select></label>
    </div>
    {sort === 'author' && <p className={styles.catalogNote}>A ordem por autor organiza os livros desta página. Use a busca por autor para explorar suas obras.</p>}
    {sort === 'popular' && <p className={styles.catalogNote}>Popularidade baseada na quantidade de registros de leitura na Open Library.</p>}
    {isError ? <ErrorState retry={refetch} /> : isFetching && !data ? <div className={styles.grid} role="status" aria-label="Carregando livros">
      {Array.from({ length: 8 }, (_, index) => <div key={index} className={styles.skeleton}><div /><span /><span /></div>)}
    </div> : data?.books.length ? <>
      <div className={styles.grid} aria-busy={isFetching}>{data.books.map(book => <BookCard key={book.id} book={book} />)}</div>
      <nav className={styles.pagination} aria-label="Paginação dos livros"><button disabled={page === 1 || isFetching} onClick={() => update('page', String(page - 1))}><ChevronLeft size={18} />Anterior</button>
        <span>Página {page} de {Math.max(1, totalPages)}</span><button disabled={page >= totalPages || isFetching} onClick={() => update('page', String(page + 1))}>Próxima<ChevronRight size={18} /></button></nav>
    </> : <div className={ui.empty}><Search size={36} /><h2>Nenhum livro encontrado</h2><p>Tente outro termo ou escolha uma categoria diferente.</p><button className={ui.secondary} onClick={() => setParams({})}>Limpar filtros</button></div>}
    <p className={styles.catalogNote}>Capas e informações fornecidas pela Open Library. Algumas obras podem ter dados incompletos.</p>
  </>;
}
