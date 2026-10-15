import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { jest, it, expect } from '@jest/globals';
import BookDetails from './BookDetails';

jest.mock('../app/store', () => ({ useAppSelector: () => 'reader' }));
jest.mock('../services/books', () => ({ useBookDetailsQuery: () => ({ data: { id: 'OL1W', title: 'Livro anterior' }, currentData: undefined, isFetching: true }) }));
jest.mock('../services/wikisource', () => ({ useWikiBookQuery: () => ({}) }));

it('hides the previous work while the newly selected work is being fetched', () => {
  render(<MemoryRouter initialEntries={['/livros/OL2W']}><Routes><Route path="/livros/:id" element={<BookDetails />} /></Routes></MemoryRouter>);
  expect(screen.queryByText('Livro anterior')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toBeInTheDocument();
});
