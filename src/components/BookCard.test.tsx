import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from '@jest/globals';
import BookCard from './BookCard';
import { digitalBooks } from '../test/fixtures';

it('links to details, handles a failed cover and renders titles as plain text', () => {
  render(<MemoryRouter><BookCard book={{ id: 'OL1W', title: '<script>alert(1)</script>', authors: ['Writer'], coverId: 1, publicationYear: 2000, subjects: [] }} /></MemoryRouter>);
  expect(screen.getByRole('link')).toHaveAttribute('href', '/livros/OL1W');
  expect(document.querySelector('script')).toBeNull();
  fireEvent.error(screen.getByRole('img'));
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.getByRole('heading')).toHaveTextContent('<script>alert(1)</script>');
});

it('shows unavailable digital access before the book is opened', () => {
  render(<MemoryRouter><BookCard book={{ id: 'OL999W', title: 'Obra sem texto', authors: [], coverId: null, publicationYear: null, subjects: [] }} loanStatus="Empréstimo indisponível" /></MemoryRouter>);
  expect(screen.getByText('Leitura indisponível')).toBeInTheDocument();
  expect(screen.getByText('Empréstimo indisponível')).toBeInTheDocument();
  expect(screen.queryByText('Wikisource')).not.toBeInTheDocument();
});
it('labels a available Wikisource edition without confusing it with an occupied loan copy', () => {
  render(<MemoryRouter><BookCard book={digitalBooks[0]} loanStatus="Emprestado · aceita reserva" /></MemoryRouter>);
  expect(screen.getByText('Leitura por empréstimo')).toBeInTheDocument();
  expect(screen.getByText('Emprestado · aceita reserva')).toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
