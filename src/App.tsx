import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { ReaderExtrasProvider } from './app/ReaderExtras';
import { useSession } from './app/useSession';
import { LoadingState } from './components/States';

const Catalog = lazy(() => import('./pages/Catalog'));
const BookDetails = lazy(() => import('./pages/BookDetails'));
const MyLibrary = lazy(() => import('./pages/MyLibrary'));
const Login = lazy(() => import('./pages/Login'));
const NotFound = lazy(() => import('./pages/NotFound'));
const DigitalShelf = lazy(() => import('./pages/DigitalShelf'));
const Reader = lazy(() => import('./pages/Reader'));

export default function App() {
  useSession();
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [location.pathname]);
  return <ReaderExtrasProvider><Layout><Suspense fallback={<LoadingState />}>
    <Routes>
      <Route path="/" element={<Catalog />} />
      <Route path="/livros/:id" element={<BookDetails />} />
      <Route path="/estante" element={<DigitalShelf />} />
      <Route path="/ler/:id" element={<Reader />} />
      <Route path="/minha-biblioteca" element={<MyLibrary />} />
      <Route path="/entrar" element={<Login />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense></Layout></ReaderExtrasProvider>;
}
