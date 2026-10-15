import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useReaderExtras } from '../app/ReaderExtras';
import CatalogBook from './CatalogBook';
import { LoadingState } from './States';
import type { Book } from '../domain/models';
import styles from '../styles/ReaderExtras.module.css';
import catalog from '../styles/Catalog.module.css';
import ui from '../styles/Ui.module.css';

export default function WishlistPanel() {
  const extras = useReaderExtras();
  if (!extras) return null;
  if (extras.wishLoading) return <LoadingState />;
  if (extras.wishError) return <div className={ui.empty} role="alert"><p>{extras.wishError}</p><button className={ui.secondary} onClick={extras.retry}>Tentar novamente</button></div>;
  return <section aria-label="Livros na lista de desejos"><p className={styles.wishlistNote}>Seu lugar para guardar próximas leituras. Edições digitais geram avisos quando um exemplar fica disponível para você; referências do catálogo geral permanecem salvas para consulta.</p>
    {extras.wishes.length ? <div className={catalog.grid}>{extras.wishes.map(item => {
      const book: Book = { id: item.workId, ...item.book, publicationYear: null, subjects: [], ...(item.digital ? { source: 'wikisource', readable: true } : {}) };
      return <CatalogBook key={item.id} book={book} />;
    })}</div> : <div className={ui.empty}><Heart size={34} /><h2>Sua lista de desejos está esperando uma história</h2><p>Use o coração na capa ou nos detalhes de um livro para guardá-lo aqui.</p><Link className={ui.primary} to="/estante">Encontrar uma leitura</Link></div>}
  </section>;
}
