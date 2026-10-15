import { Bell, Check, ExternalLink, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useReaderExtras } from '../app/ReaderExtras';
import { useLibraryAction } from '../app/useLibraryAction';
import { markNoticeRead } from '../services/readerExtras';
import styles from '../styles/ReaderExtras.module.css';

export default function NotificationBell() {
  const extras = useReaderExtras(), action = useLibraryAction(), details = useRef<HTMLDetailsElement>(null);
  function close(restoreFocus = true) {
    if (!details.current) return;
    details.current.open = false;
    if (restoreFocus) details.current.querySelector('summary')?.focus();
  }
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (details.current?.open && event.target instanceof Node && !details.current.contains(event.target)) close(false);
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  if (!extras?.uid) return null;
  const unread = extras.notifications.filter(item => !item.readAt).length;
  return <details ref={details} className={styles.notices} onKeyDown={event => { if (event.key === 'Escape') close(); }}>
    <summary aria-label={`Notificações, ${unread} não lidas`}><Bell size={19} />{unread > 0 && <span className={styles.count}>{unread > 99 ? '99+' : unread}</span>}</summary>
    <section className={styles.noticePanel} aria-label="Notificações de disponibilidade"><div className={styles.noticeHeading}><h2>Seu próximo capítulo</h2><button type="button" className={styles.closeNotice} aria-label="Fechar notificações" onClick={() => close()}><X size={18} /></button></div>{unread > 0 && <button className={styles.retry} disabled={action.busy} onClick={() => void action.run(() => Promise.all(extras.notifications.filter(item => !item.readAt).map(item => markNoticeRead(item.id))).then(() => {}), 'Notificações marcadas como lidas.')}>Marcar todas como lidas</button>}<p className={styles.intro}>Avisos dos livros na sua lista de desejos. Confira a disponibilidade antes de solicitar.</p>
      {extras.noticeError ? <div role="alert"><p>{extras.noticeError}</p><button className={styles.retry} onClick={extras.retry}>Tentar novamente</button></div>
        : extras.noticeLoading ? <p role="status">Carregando avisos…</p> : !extras.notifications.length ? <p>Nenhuma notificação por enquanto. Salve livros na lista de desejos para acompanhar sua disponibilidade.</p>
          : <ul>{extras.notifications.slice(0, 30).map(item => <li key={item.id} className={item.readAt ? '' : styles.unread}>
            <strong>{item.book.title}</strong><p>Um exemplar ficou disponível para você.</p><time dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleString('pt-BR')}</time>
            <div><Link to={`/livros/${item.workId}`} onClick={() => { if (details.current) details.current.open = false; }}>Ver disponibilidade<ExternalLink size={13} /></Link>
              {!item.readAt ? <button disabled={action.busy} aria-label={`Marcar aviso de ${item.book.title} como lido`} onClick={() => void action.run(() => markNoticeRead(item.id), 'Notificação marcada como lida.')}><Check size={14} />Marcar como lida</button> : <span>Lida</span>}</div>
          </li>)}</ul>}
      {extras.notifications.length > 30 && <p>Exibindo os 30 avisos mais recentes.</p>}
      {action.error && <p className={styles.error} role="alert">{action.error}</p>}<span role="status" className={styles.srOnly}>{action.message}</span>
    </section>
  </details>;
}
