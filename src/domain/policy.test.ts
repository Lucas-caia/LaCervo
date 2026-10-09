import { describe, expect, it } from '@jest/globals';
import { canBorrow, canReserve, dueDate, isOverdue } from './policy';
import type { Loan } from './models';

const loan = (id: string, userId = 'reader'): Loan => ({ id, userId, workId: 'OL1W', borrowedAt: '2026-10-01T12:00:00.000Z', dueAt: '2026-10-15T12:00:00.000Z', returnedAt: null });
describe('circulation policy', () => {
  it('adds 14 days without changing the original date, across months', () => {
    const date = new Date('2026-01-25T12:00:00.000Z');
    expect(dueDate(date)).toBe('2026-02-08T12:00:00.000Z');
    expect(date.toISOString()).toBe('2026-01-25T12:00:00.000Z');
  });
  it('requires a reader and honors availability and reservation ownership', () => {
    const copy = { workId: 'OL1W', activeLoanId: null, reservedForUserId: null };
    expect(canBorrow('', copy, [])).toBe(false);
    expect(canBorrow('reader', copy, [])).toBe(true);
    expect(canBorrow('reader', { ...copy, activeLoanId: 'busy' }, [])).toBe(false);
    expect(canBorrow('reader', { ...copy, reservedForUserId: 'other' }, [])).toBe(false);
    expect(canBorrow('reader', { ...copy, reservedForUserId: 'reader' }, [])).toBe(true);
  });
  it('enforces the loan limit per reader, ignoring returned and other readers loans', () => {
    const copy = { workId: 'OL1W', activeLoanId: null, reservedForUserId: null };
    expect(canBorrow('reader', copy, [loan('1'), loan('2'), loan('3')])).toBe(false);
    expect(canBorrow('reader', copy, [loan('1'), loan('2'), loan('3', 'other')])).toBe(true);
    expect(canBorrow('reader', copy, [loan('1'), loan('2'), { ...loan('3'), returnedAt: '2026-10-02' }])).toBe(true);
  });
  it('rejects own borrowed books and duplicate active reservations', () => {
    const copy = { workId: 'OL1W', activeLoanId: '1', reservedForUserId: null };
    expect(canReserve('reader', copy, [loan('1')], [])).toBe(false);
    expect(canReserve('other', copy, [loan('1')], [])).toBe(true);
    expect(canReserve('other', copy, [], [{ id: 'r', userId: 'other', workId: 'OL1W', status: 'waiting', createdAt: '2026-10-01' }])).toBe(false);
  });
  it('marks only active loans past the deadline as overdue', () => {
    const now = new Date('2026-10-16T12:00:00Z');
    expect(isOverdue(loan('1'), now)).toBe(true);
    expect(isOverdue({ ...loan('1'), returnedAt: '2026-10-12' }, now)).toBe(false);
  });
});
