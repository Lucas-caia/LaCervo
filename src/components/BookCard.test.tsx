import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from '@jest/globals';
import BookCard from './BookCard';

it('links to details, handles a failed cover and renders titles as plain text', () => {
  render(<MemoryRouter><BookCard book={{ id: 'OL1W', title: '<script>alert(1)</script>', authors: ['Writer'], coverId: 1, publicationYear: 2000, subjects: [] }} /></MemoryRouter>);
  expect(screen.getByRole('link')).toHaveAttribute('href', '/livros/OL1W');
  expect(document.querySelector('script')).toBeNull();
  fireEvent.error(screen.getByRole('img'));
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.getByRole('heading')).toHaveTextContent('<script>alert(1)</script>');
});
