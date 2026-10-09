export interface Book {
  id: string;
  title: string;
  authors: string[];
  coverId: number | null;
  publicationYear: number | null;
  subjects: string[];
  description?: string;
}

export interface LibraryCopy {
  workId: string;
  activeLoanId: string | null;
  reservedForUserId: string | null;
  queue?: string[];
  book?: BookSummary;
}

export interface BookSummary { title: string; authors: string[]; coverId: number | null; }

export interface Loan {
  id: string;
  userId: string;
  workId: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
  book?: BookSummary;
}

export interface Reservation {
  id: string;
  userId: string;
  workId: string;
  createdAt: string;
  status: 'waiting' | 'ready' | 'fulfilled' | 'cancelled';
  book?: BookSummary;
}

export type ReadingStatus = 'not-started' | 'reading' | 'completed';
export interface ReadingProgress { userId: string; workId: string; status: ReadingStatus; book?: BookSummary; }
export interface Reader { uid: string; email: string | null; displayName: string | null; }
