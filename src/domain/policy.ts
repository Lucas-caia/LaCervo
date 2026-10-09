import type { LibraryCopy, Loan, Reservation } from './models';

export const LOAN_DAYS = 14;
export const MAX_ACTIVE_LOANS = 3;

export function dueDate(borrowedAt: Date): string {
  if (!Number.isFinite(borrowedAt.getTime())) throw new Error('Invalid loan date');
  const due = new Date(borrowedAt);
  due.setUTCDate(due.getUTCDate() + LOAN_DAYS);
  return due.toISOString();
}

export function canBorrow(userId: string, copy: LibraryCopy, loans: Loan[]): boolean {
  return Boolean(userId) && !copy.activeLoanId &&
    (!copy.reservedForUserId || copy.reservedForUserId === userId) &&
    loans.filter(loan => loan.userId === userId && !loan.returnedAt).length < MAX_ACTIVE_LOANS;
}

export function canReserve(userId: string, copy: LibraryCopy, loans: Loan[], reservations: Reservation[]): boolean {
  return Boolean(userId) && Boolean(copy.activeLoanId) &&
    !loans.some(loan => loan.userId === userId && loan.workId === copy.workId && !loan.returnedAt) &&
    !reservations.some(reservation => reservation.userId === userId && reservation.workId === copy.workId &&
      ['waiting', 'ready'].includes(reservation.status));
}

export function isOverdue(loan: Loan, now = new Date()): boolean {
  return loan.returnedAt === null && new Date(loan.dueAt).getTime() < now.getTime();
}
