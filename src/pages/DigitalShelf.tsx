import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BookOpen, Search, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import CatalogBook from '../components/CatalogBook';
import { useWikiSearchQuery } from '../services/wikisource';
import { PAGE_SIZE } from '../services/books';
import { ErrorState } from '../components/States';
import styles from '../styles/Catalog.module.css';
import ui from '../styles/Ui.module.css';

export default function DigitalShelf() {
  const [params, setParams] = useSearchParams();
  const query = (params.get('q') || '').slice(0, 120);
  const requested = Number(params.get('page') || 1);
  const page = Number.isInteger(requested) && requested > 0 && requested <= 10000 ? requested : 1;
  const [draft, setDraft] = useState(query);
  useEffect(() => setDraft(query), [query]);
  const { currentData: data, isFetching, isError, refetch } = useWikiSearchQuery({ query, page });
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const lastPage = useRef(page);
  useEffect(() => {
    if (!data || isFetching || isError) return;
    const totalPages = Math.ceil(data.total / PAGE_SIZE);
    if (totalPages > 0 && page > totalPages) {
      setParams(previous => { const next = new URLSearchParams(previous); next.set('page', String(totalPages)); return next; }, { replace: true });
      return;
    }
    if (lastPage.current !== page) {
      lastPage.current = page;
      resultsHeading.current?.scrollIntoView({ block: 'start' });
      resultsHeading.current?.focus({ preventScroll: true });
    }
  }, [data, isFetching, isError, page, setParams]);
  function search(event: FormEvent) { event.preventDefault(); setParams(draft.trim() ? { q: draft.trim() } : {}); }
  function navigate(next: number) { setParams({ ...(query ? { q: query } : {}), page: String(next) }); }
  return <>
    <div className={styles.shelfIntro}><p className={ui.eyebrow}>A CASA DOS CLÁSSICOS</p><h1>Uma estante.<br /><em>Infinitas descobertas.</em></h1>
      <p>Edições em português da Wikisource, reunidas no catálogo LaCervo. Escolha sua próxima leitura e leve-a para a sua biblioteca.</p><span className={styles.shelfOrnament} aria-hidden="true">❧</span>
    </div>
    <div className={styles.shelfHeading}><div><h2 ref={resultsHeading} tabIndex={-1}>Clássicos para ficar um pouco mais</h2><p>Acervo da Wikisource · até três empréstimos ativos</p></div>
      <form className={styles.shelfSearch} onSubmit={search}><Search size={17} aria-hidden="true" /><input aria-label="Buscar na estante digital" placeholder="Título, autor ou palavra-chave" value={draft} maxLength={120} onChange={event => setDraft(event.target.value)} /><button aria-label="Buscar na Wikisource" type="submit">Buscar</button></form></div>
    {isError ? <ErrorState retry={refetch} /> : isFetching ? <div className={styles.grid} role="status" aria-label="Carregando a Wikisource">{Array.from({ length: 6 }, (_, index) => <div className={styles.skeleton} key={index}><div /><span /><span /></div>)}</div>
      : data?.books.length ? <div className={`${styles.grid} ${styles.digitalGrid}`}>{data.books.map(book => <CatalogBook key={book.id} book={book} />)}</div>
      : <div className={ui.empty}><Search size={30} /><h2>Nenhuma edição encontrada</h2><p>Tente outro termo ou consulte outra página. A estante reúne edições transcritas disponíveis na Wikisource.</p><button className={ui.secondary} onClick={() => setParams({})}>Limpar busca</button></div>}
    {!isError && <nav className={styles.pagination} aria-label="Paginação da estante"><button disabled={page <= 1 || isFetching} onClick={() => navigate(page - 1)}><ChevronLeft size={18} />Anterior</button><span>Página {page}</span><button disabled={!data?.hasNext || isFetching || page >= 10000} onClick={() => navigate(page + 1)}>Próxima<ChevronRight size={18} /></button></nav>}
    <div className={styles.shelfNote}><BookOpen size={24} aria-hidden="true" /><p>Entre na sua conta e solicite um livro disponível. O empréstimo libera a leitura no site por 14 dias. Você pode manter até três livros ativos e devolver a qualquer momento.</p></div>
    <Link to="/" className={styles.browseMore}>Explore também o catálogo geral<ArrowUpRight size={17} /></Link>
    <p className={styles.catalogNote}>Metadados são sincronizados no catálogo. Textos e capítulos são consultados online. Grafia, créditos e licenças seguem a edição da Wikisource.</p>
  </>;
}
