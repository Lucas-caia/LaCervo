import type { Book, LibraryCopy, Loan } from './models';

export const isWikiBook = (id: string) => /^WS[1-9]\d{0,11}$/.test(id);
export const hasDigitalEdition = (book: Book) => isWikiBook(book.id) && book.source === 'wikisource' && book.readable === true;
export function initialDigitalCopy(book?: Book): LibraryCopy | null {
  return book && hasDigitalEdition(book) ? { workId: book.id, activeLoanId: null, reservedForUserId: null, queue: [],
    book: { title: book.title.slice(0, 300), authors: book.authors.slice(0, 4).map(name => name.slice(0, 150)), coverId: null } } : null;
}
export const canReadLoan = (loan: Loan | undefined, now = Date.now()) => Boolean(loan && !loan.returnedAt && Number.isFinite(Date.parse(loan.dueAt)) && Date.parse(loan.dueAt) > now);
export interface WikiChapter { index: number; label: string; }
export interface WikiEdition extends Book { chapters: WikiChapter[]; revision: number | null; }
export interface WikiReading { book: Book; chapter: number; chapterLabel: string; chapters: WikiChapter[]; paragraphs: string[]; revision: number | null; sourceUrl: string; }
