// The sums behind GEM's bills (admin dashboard, 20 November 2026): a month's
// days, the days charged after a free trial, the amount, when a sent bill is
// due and when it is overdue.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const M = createRequire(new URL('../../gem-backend/src/app.js', import.meta.url))('./utils/billingMath.js');

describe('a month', () => {
  it('runs from its first day to the next month\'s, and knows its length', () => {
    expect(M.periodBounds('2026-02')).toMatchObject({ days: 28 });
    expect(M.periodBounds('2028-02').days).toBe(29);
    expect(M.periodBounds('2026-10').start).toEqual(new Date(2026, 9, 1));
    expect(M.periodBounds('2026-13')).toBeNull();
    expect(M.periodBounds('nov')).toBeNull();
    expect(M.previousPeriod(new Date(2027, 0, 5))).toBe('2026-12');
  });
});

describe('the days charged', () => {
  const oct = M.periodBounds('2026-10');
  it('are the whole month once the trial is long over', () => {
    expect(M.billableDaysOf(oct, new Date(2026, 6, 1))).toBe(31);
  });
  it('start the day after a trial that ends during the day', () => {
    expect(M.billableDaysOf(oct, new Date(2026, 9, 10, 14))).toBe(21);
    // A trial ending exactly at midnight is charged from that day
    expect(M.billableDaysOf(oct, new Date(2026, 9, 10))).toBe(22);
  });
  it('are none while the trial lasts all month', () => {
    expect(M.billableDaysOf(oct, new Date(2026, 10, 3))).toBe(0);
  });
  it('start from the gym\'s sign-up and its trial days when no end is set', () => {
    expect(M.trialEndOf({ createdAt: new Date(2026, 9, 1, 9) }, { trialDays: 7 })).toEqual(new Date(2026, 9, 8, 9));
    expect(M.trialEndOf({ createdAt: new Date(2026, 9, 1), trialEndsAt: new Date(2026, 9, 30) }, { trialDays: 7 })).toEqual(new Date(2026, 9, 30));
  });
});

describe('a bill', () => {
  it('is members times the price, for the days charged, less any discount, never below nothing', () => {
    expect(M.amountOf({ members: 40, rate: 250, billableDays: 31, daysInPeriod: 31 })).toBe(10000);
    expect(M.amountOf({ members: 3, rate: 250, billableDays: 21, daysInPeriod: 31 })).toBe(508);
    expect(M.amountOf({ members: 5, rate: 250, billableDays: 30, daysInPeriod: 30, discount: 50 })).toBe(1200);
    expect(M.amountOf({ members: 1, rate: 250, billableDays: 30, daysInPeriod: 30, discount: 1000 })).toBe(0);
  });
  it('falls due at the end of the day, the set number of days after it is sent', () => {
    expect(M.dueDateFrom(new Date(2026, 10, 1, 9, 30), 10)).toEqual(new Date(2026, 10, 11, 23, 59, 59, 999));
  });
  it('is overdue once a sent bill passes its due date, and counts the days', () => {
    const now = new Date(2026, 10, 20, 12);
    const sent = { status: 'sent', dueDate: new Date(2026, 10, 17, 12) };
    expect(M.invoiceState(sent, now)).toBe('overdue');
    expect(M.daysOverdue(sent, now)).toBe(3);
    expect(M.invoiceState({ status: 'sent', dueDate: new Date(2026, 10, 25) }, now)).toBe('sent');
    expect(M.invoiceState({ status: 'paid', dueDate: new Date(2026, 10, 1) }, now)).toBe('paid');
    expect(M.daysOverdue({ status: 'draft' }, now)).toBe(0);
  });
});
