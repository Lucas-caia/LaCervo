import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import styles from '../styles/Ui.module.css';

export default function NotFound() {
  return <div className={styles.empty}><BookOpen size={38} /><h1>Página não encontrada</h1><p>Este endereço não está no nosso catálogo.</p><Link to="/" className={styles.primary}>Voltar ao catálogo</Link></div>;
}
