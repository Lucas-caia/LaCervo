import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Minus, Plus, Moon, Sun, BookOpen, LockKeyhole } from 'lucide-react';
import { useAppSelector } from '../app/store';
import { useReaderLibrary } from '../app/useCirculation';
import { isWikiBook, canReadLoan } from '../domain/wikisource';
import { useBookText } from '../app/useBookText';
import { LoadingState } from '../components/States';
import styles from '../styles/Reader.module.css';
import ui from '../styles/Ui.module.css';

export default function Reader() {
  const { id = '' } = useParams();
  const reader = useAppSelector(state => state.session.reader);
  const ready = useAppSelector(state => state.session.ready);
  const library = useReaderLibrary();
  const loan = library.data.loans.find(item => item.workId === id && !item.returnedAt);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const expiry = Date.parse(loan?.dueAt || '');
    if (!Number.isFinite(expiry)) return;
    const timeout = setTimeout(() => setNow(Date.now()), Math.max(0, Math.min(expiry - Date.now() + 1, 2147483647)));
    return () => clearTimeout(timeout);
  }, [loan?.dueAt]);
  const allowed = Boolean(reader && ready && !library.loading && !library.error && isWikiBook(id) && canReadLoan(loan, now));
  const [params, setParams] = useSearchParams();
  const chapterValue = Number(params.get('c') || 0);
  const chapter = Number.isInteger(chapterValue) && chapterValue >= 0 ? chapterValue : 0;
  const { pages, payload, loading, error, retry } = useBookText(id, loan?.id, allowed, chapter);
  const requested = Number(params.get('p') || 1);
  const page = Number.isInteger(requested) && requested > 0 ? Math.min(requested, pages.length || 1) : 1;
  const [size, setSize] = useState(20);
  const [night, setNight] = useState(false);
  const paper = useRef<HTMLElement>(null);
  useEffect(() => { if (!loading && pages.length) paper.current?.focus({ preventScroll: true }); }, [page, chapter, loading, pages.length]);
  function navigate(value: number) { setParams({ c: String(chapter), p: String(value) }); paper.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); }
  function changePart(value: number, last = false) { setParams({ c: String(value), p: last ? '99999' : '1' }); window.scrollTo(0, 0); }
  if (!ready || library.loading) return <LoadingState />;
  if (!reader) return <div className={ui.empty}><LockKeyhole size={36} /><h1>Entre para continuar a leitura</h1><p>A leitura no LaCervo exige um empréstimo ativo na sua conta.</p><Link to="/entrar" state={{ from: `/ler/${id}` }} className={ui.primary}>Entrar na conta</Link></div>;
  if (library.error) return <div className={ui.empty} role="alert"><p>{library.error}</p><button className={ui.primary} onClick={library.retry}>Tentar novamente</button></div>;
  if (!isWikiBook(id)) return <div className={ui.empty}><BookOpen size={36} /><h1>Edição digital indisponível</h1><p>Escolha uma obra na estante da Wikisource.</p><Link to="/estante" className={ui.primary}>Conhecer a estante digital</Link></div>;
  if (!allowed) return <div className={ui.empty}><LockKeyhole size={36} /><h1>Faça um empréstimo para ler</h1><p>{loan ? 'O prazo deste empréstimo terminou. Devolva o livro e solicite um novo empréstimo, se ele estiver disponível.' : 'Escolha este livro e solicite um empréstimo. Você pode manter até três livros ativos por vez.'}</p><Link to={`/livros/${id}`} className={ui.primary}>Ver disponibilidade do livro</Link></div>;
  const book = payload?.book;
  const parts = payload?.chapters || [];
  return <div className={`${styles.reader} ${night ? styles.night : ''}`}>
    <Link to={`/livros/${id}`} className={styles.back}><ArrowLeft size={17} />Voltar ao livro</Link>
    <header className={styles.heading}><p className={ui.eyebrow}>TEMPO PARA LER</p><h1>{book?.title || loan?.book?.title || 'Sua leitura'}</h1><p>{book?.authors.join(', ') || loan?.book?.authors.join(', ')} <span>· Edição da Wikisource</span></p></header>
    <div className={styles.toolbar} aria-label="Preferências de leitura"><span><BookOpen size={17} />Seu canto de leitura</span><div>
      <button aria-label="Diminuir tamanho do texto" disabled={size <= 16} onClick={() => setSize(value => value - 2)}><Minus size={16} /></button><output aria-label="Tamanho do texto">{size}</output>
      <button aria-label="Aumentar tamanho do texto" disabled={size >= 28} onClick={() => setSize(value => value + 2)}><Plus size={16} /></button>
      <button aria-label={night ? 'Ativar tema claro' : 'Ativar tema noturno'} aria-pressed={night} onClick={() => setNight(value => !value)}>{night ? <Sun size={18} /> : <Moon size={18} />}</button>
    </div></div>
    {loading ? <div className={styles.readerState} role="status">Preparando seu livro…</div> : error ? <div className={styles.readerState} role="alert"><p>{error}</p><button className={ui.primary} onClick={retry}>Tentar novamente</button></div> : <>
      <label className={styles.chapterNavigation}>Parte do livro<select aria-label="Parte do livro" value={chapter} onChange={event => changePart(Number(event.target.value))}>{parts.map(part => <option key={part.index} value={part.index}>{part.label}</option>)}</select></label>
      <article ref={paper} tabIndex={-1} className={styles.paper} aria-label={`Página ${page} de ${pages.length}`} style={{ fontSize: `${size}px` }}>
        <span className={styles.runningTitle}>{book?.title} · {payload?.chapterLabel}</span><div className={styles.prose}>{pages[page - 1]?.paragraphs.map((paragraph, index) => <p key={`${chapter}:${page}:${index}`}>{paragraph}</p>)}</div><span className={styles.folio}>{page}</span>
      </article>
      <nav className={styles.pagination} aria-label="Paginação da leitura"><button disabled={page <= 1 && chapter <= 0} onClick={() => page > 1 ? navigate(page - 1) : changePart(chapter - 1, true)}><ChevronLeft size={18} />Anterior</button>
        <label>Página<select aria-label="Ir para página" value={page} onChange={event => navigate(Number(event.target.value))}>{pages.map((_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}</select><span>de {pages.length}</span></label>
        <button disabled={page >= pages.length && chapter >= parts.length - 1} onClick={() => page < pages.length ? navigate(page + 1) : changePart(chapter + 1)}>{page >= pages.length && chapter < parts.length - 1 ? 'Próxima parte' : 'Próxima'}<ChevronRight size={18} /></button></nav>
      <progress className={styles.progress} value={page} max={pages.length} aria-label="Posição na parte do livro" />
    </>}
    <footer className={styles.credits}><p>A grafia segue a edição de origem. Guarde o endereço para retomar a mesma parte e página. A leitura exige que seu empréstimo continue ativo.</p>
      <details><summary>Fonte, créditos e licença</summary><p>Texto consultado na Wikisource em português. Autores, colaboradores e licenças estão indicados na edição de origem.{payload?.revision ? ` Revisão consultada: ${payload.revision}.` : ''}</p>
        {payload?.sourceUrl && <a href={payload.sourceUrl} target="_blank" rel="noreferrer">Consultar a edição e seus créditos na Wikisource</a>}<a href="https://pt.wikisource.org/wiki/Wikisource:Direitos_de_autor" target="_blank" rel="noreferrer">Licenças e direitos de autor</a>
      </details></footer>
  </div>;
}
