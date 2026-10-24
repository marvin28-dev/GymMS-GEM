// The rules CLAUDE.md leans on, as the screens and the server work them out:
// who needs attention, what "expiring soon" is, prices and profit, revenue,
// text-message parts and fill-ins, money and dates as written, and a coach's
// on-track reading. Where the browser and the server each keep a copy of a
// rule, both are checked against the same cases.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}
globalThis.localStorage = new MemoryStorage();

const { membershipEndsThisWeek, memberNeedsAttention, taskOverdue, taskNeedsAttention } = await import('../../gem-frontend/src/utils/attention.js');
const { saleUnitPrice, profitPerItem, marginPct, profitOf } = await import('../../gem-frontend/src/utils/productPrice.js');
const { revenueOf } = await import('../../gem-frontend/src/utils/revenue.js');
const { smsInfo, fillIn, hasFillIns } = await import('../../gem-frontend/src/utils/smsCount.js');
const { formatMoney } = await import('../../gem-frontend/src/utils/currency.js');
const { ordinalDay, addDaysStr, todayStr, dayStr } = await import('../../gem-frontend/src/utils/date.js');
const { trackOf, followUpsOf } = await import('../../gem-frontend/src/utils/coaching.js');
const ladder = await import('../../gem-frontend/src/utils/hierarchy.js');

const backend = createRequire(new URL('../../gem-backend/src/app.js', import.meta.url));
const server = {
  money: backend('./utils/money.js'),
  phone: backend('./utils/phone.js'),
  sms: backend('./utils/sms.js'),
  method: backend('./utils/paymentMethod.js'),
  ladder: backend('./utils/hierarchy.js'),
};

const today = todayStr();
const inDays = (n) => addDaysStr(today, n);

describe('expiring soon', () => {
  it('is a member whose running membership ends between today and a week from today', () => {
    const m = (endDate, extra = {}) => ({ status: 'active', isVisitor: false, endDate, ...extra });
    expect(membershipEndsThisWeek(m(inDays(0)))).toBe(true);
    expect(membershipEndsThisWeek(m(inDays(7)))).toBe(true);
    expect(membershipEndsThisWeek(m(inDays(8)))).toBe(false);
    expect(membershipEndsThisWeek(m(inDays(-1)))).toBe(false);
    expect(membershipEndsThisWeek(m(inDays(3), { isVisitor: true }))).toBe(false);
    expect(membershipEndsThisWeek(m(inDays(3), { status: 'frozen' }))).toBe(false);
  });
});

describe('a member needing attention', () => {
  const member = (extra) => ({ status: 'active', balance: 10000, package: { price: 10000 }, startDate: inDays(-1), endDate: inDays(30), ...extra });
  it('is anyone with a request waiting for a manager', () => {
    expect(memberNeedsAttention({ ...member({ balance: 0 }), pendingApproval: { id: 'r' } })).toBe(true);
  });
  it('is never someone who owes nothing, a visitor, or a deactivated record', () => {
    expect(memberNeedsAttention(member({ balance: 0 }))).toBe(false);
    expect(memberNeedsAttention(member({ isVisitor: true }))).toBe(false);
    expect(memberNeedsAttention(member({ status: 'deactivated' }))).toBe(false);
  });
  it('is a started membership with nothing paid, from day one, but not one that has not started', () => {
    expect(memberNeedsAttention(member({ startDate: today }))).toBe(true);
    expect(memberNeedsAttention(member({ startDate: inDays(3) }))).toBe(false);
  });
  it('is anything owed when the end is two weeks away or past', () => {
    expect(memberNeedsAttention(member({ balance: 1000, endDate: inDays(14) }))).toBe(true);
    expect(memberNeedsAttention(member({ balance: 1000, endDate: inDays(15) }))).toBe(false);
  });
  it('is under half paid more than a week in', () => {
    expect(memberNeedsAttention(member({ balance: 6000, startDate: inDays(-7) }))).toBe(true);
    expect(memberNeedsAttention(member({ balance: 4000, startDate: inDays(-7) }))).toBe(false);
    expect(memberNeedsAttention(member({ balance: 6000, startDate: inDays(-6) }))).toBe(false);
  });
});

describe('a task', () => {
  const task = (extra) => ({ status: 'In Progress', dueDate: `${today}T00:00:00.000Z`, ...extra });
  it('is overdue once its day has passed, not during it, and never once settled', () => {
    expect(taskOverdue(task())).toBe(false);
    expect(taskOverdue(task({ dueDate: `${inDays(-1)}T00:00:00.000Z` }))).toBe(true);
    expect(taskOverdue(task({ dueDate: `${inDays(-1)}T00:00:00.000Z`, status: 'Done' }))).toBe(false);
  });
  it('needs attention while waiting to start or late', () => {
    expect(taskNeedsAttention(task({ status: 'Pending' }))).toBe(true);
    expect(taskNeedsAttention(task())).toBe(false);
    expect(taskNeedsAttention(task({ dueDate: `${inDays(-2)}T00:00:00.000Z` }))).toBe(true);
    expect(taskNeedsAttention(task({ status: 'Declined' }))).toBe(false);
  });
});

describe('prices and profit', () => {
  it('sells at the offer price in whole money, the same sum the server charges', () => {
    const p = { price: 10000, discountPercent: 15, costPrice: 6000 };
    expect(saleUnitPrice(p)).toBe(8500);
    expect(profitPerItem(p)).toBe(2500);
    expect(marginPct(p)).toBe(29);
    // sale.controller unitPriceOf, written out
    const unitPriceOf = (x) => Math.round((x.price || 0) * (100 - (x.discountPercent || 0)) / 100);
    for (const x of [{ price: 999, discountPercent: 33 }, { price: 1500 }, { price: 7, discountPercent: 50 }]) {
      expect(saleUnitPrice(x)).toBe(unitPriceOf(x));
    }
  });
  it('has no profit without a cost price, and shows a loss as negative', () => {
    expect(profitPerItem({ price: 1000 })).toBeNull();
    expect(profitPerItem({ price: 1000, costPrice: 1200 })).toBe(-200);
  });
  it('counts a sale by the cost it was sold at, and leaves out one with an item of no known cost', () => {
    const sales = [
      { total: 2000, items: [{ productId: 'a', quantity: 2, unitCost: 600 }] },
      { total: 1000, items: [{ productId: 'b', quantity: 1 }] },
      { total: 1500, items: [{ productId: 'c', quantity: 1 }] },
    ];
    expect(profitOf(sales, { c: 1000 })).toEqual({ profit: 800 + 500, missing: 1 });
  });
});

describe('revenue', () => {
  it('is what members paid by kind plus the shop\'s profit, on the day asked', () => {
    const now = new Date().toISOString();
    const yesterday = new Date(Date.now() - 2 * 864e5).toISOString();
    const r = revenueOf(
      [{ type: 'membership', amount: 5000, createdAt: now }, { type: 'registration', amount: 2000, createdAt: now }, { type: 'product', amount: 1000, createdAt: now }, { type: 'membership', amount: 9000, createdAt: yesterday }],
      [{ total: 3000, createdAt: now, items: [{ quantity: 3, unitCost: 600 }] }],
      (day) => day === today,
    );
    expect(r).toMatchObject({ memberships: 5000, registration: 2000, passes: 1000, members: 8000, shop: 1200, shopSales: 3000, total: 9200 });
  });
});

describe('text messages', () => {
  const cases = ['', 'a'.repeat(160), 'a'.repeat(161), 'Réunion à 9h', 'Hi 😀', '€'.repeat(80), '€'.repeat(81), 'x'.repeat(153 * 6), 'ê'.repeat(71)];
  it('count their parts the same in the composer and on the server', () => {
    for (const text of cases) expect(smsInfo(text).parts, JSON.stringify(text.slice(0, 12))).toBe(server.sms.smsParts(text));
  });
  it('split at 160 and 153, or 70 and 67 once a character is outside the SMS alphabet', () => {
    expect(smsInfo('a'.repeat(160)).parts).toBe(1);
    expect(smsInfo('a'.repeat(161)).parts).toBe(2);
    expect(smsInfo('ê'.repeat(70))).toMatchObject({ parts: 1, unicode: true });
    expect(smsInfo('ê'.repeat(71)).parts).toBe(2);
    // The euro sign takes two places
    expect(smsInfo('€'.repeat(81)).parts).toBe(2);
  });
  it('fill in what they know, whatever the capitals, and leave the rest as written', () => {
    const sample = { firstname: 'Ada', balance: '3 500 FCFA' };
    expect(hasFillIns('Hi {firstName}')).toBe(true);
    expect(fillIn('Hi {FirstName}, you owe { balance }. {gymCode}', sample)).toBe('Hi Ada, you owe 3 500 FCFA. {gymCode}');
  });
});

describe('money as written', () => {
  const asGym = (gymCurrency) => localStorage.setItem('gem_auth', JSON.stringify({ token: 't', user: { gymCurrency }, loginDate: today }));
  it('follows the gym\'s currency, in the browser as on the server', () => {
    for (const [code, written] of [['XAF', '15 000 FCFA'], ['NGN', '₦15,000'], ['GHS', 'GH₵15,000'], ['EUR', '15 000 €']]) {
      asGym(code);
      expect(formatMoney(15000)).toBe(written);
      expect(server.money.formatMoney(15000, code)).toBe(written);
    }
    expect(server.money.formatMoney(15000, 'NGN', 'NGN')).toBe('NGN 15,000');
  });
  it('moves with the country when the gym has none of its own', () => {
    expect(server.money.currencyForCountry(' Nigeria ')).toBe('NGN');
    expect(server.money.currencyOf({ country: 'Ghana' })).toBe('GHS');
    expect(server.money.currencyOf({ currency: 'EUR', country: 'Ghana' })).toBe('EUR');
    expect(server.money.currencyOf({})).toBe('XAF');
  });
});

describe('payment methods', () => {
  it('are stored by one name whatever a form calls them', () => {
    expect(['Mobile Money', 'mobile_money', 'Mobile Pay'].map(server.method.toPaymentMethod)).toEqual(['mobile_money', 'mobile_money', 'mobile_money']);
    expect(['Credit/Debit Card', 'Card', 'card'].map(server.method.toPaymentMethod)).toEqual(['card', 'card', 'card']);
    expect(server.method.toPaymentMethod('Bank Transfer')).toBe('bank_transfer');
  });
});

describe('phone numbers for texts', () => {
  it('take the gym\'s country code when written the local way', () => {
    expect(server.phone.readPhone('6 77 12 34 56', 'Cameroon')).toEqual({ e164: '+237677123456' });
    expect(server.phone.readPhone('237677123456', 'Cameroon')).toEqual({ e164: '+237677123456' });
    expect(server.phone.readPhone('00237677123456', '')).toEqual({ e164: '+237677123456' });
    expect(server.phone.readPhone('+44 7700 900123', 'Cameroon')).toEqual({ e164: '+447700900123' });
    expect(server.phone.readPhone('0803 123 4567', 'Nigeria')).toEqual({ e164: '+2348031234567' });
  });
  it('fall back to the dial code of the gym\'s own phone, and say what is missing', () => {
    expect(server.phone.readPhone('677123456', '', '+237 670 000 000')).toEqual({ e164: '+237677123456' });
    expect(server.phone.readPhone('677123456', '', '')).toEqual({ problem: 'no_country' });
    expect(server.phone.readPhone('', 'Cameroon')).toEqual({ problem: 'missing' });
    expect(server.phone.readPhone('+12', 'Cameroon')).toEqual({ problem: 'invalid' });
  });
});

describe('dates', () => {
  it('write a day of the month as people say it', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(n => ordinalDay(n))).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '31st']);
    expect([ordinalDay(1, 'fr'), ordinalDay(21, 'fr')]).toEqual(['1er', '21']);
  });
  it('count days on the calendar across months and years', () => {
    expect(addDaysStr('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysStr('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysStr('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysStr('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('read a stored calendar day as that day wherever the viewer is', () => {
    expect(dayStr('2026-10-23T00:00:00.000Z')).toBe('2026-10-23');
    expect(dayStr('2026-10-23')).toBe('2026-10-23');
  });
});

describe('a coach\'s reading of a client', () => {
  const client = (extra = {}) => ({
    status: 'active', endDate: inDays(60), goalSetAt: `${inDays(-30)}T10:00:00.000Z`, goalSessionsPerWeek: 3,
    goalWeight: 75, goalWaist: 80, visitsLast14: 6, lastVisit: inDays(-1),
    baseline: { weight: 85, waist: 92, date: `${inDays(-30)}T10:00:00.000Z` },
    latestWeight: 80, latestWaist: 86, lastCheckIn: `${inDays(-3)}T10:00:00.000Z`, checkedInThisWeek: true, ...extra,
  });
  it('is on track while training as often as the goal and moving towards it', () => {
    expect(trackOf(client(), today).key).toBe('on');
  });
  it('is slipping when one thing is behind, off when both are or they have not come for two weeks', () => {
    expect(trackOf(client({ visitsLast14: 3 }), today).key).toBe('slipping');
    expect(trackOf(client({ visitsLast14: 1, latestWeight: 88, latestWaist: 95 }), today).key).toBe('off');
    expect(trackOf(client({ lastVisit: inDays(-14) }), today).key).toBe('off');
  });
  it('has nothing to judge without goals, or once the membership has ended', () => {
    expect(trackOf(client({ goalSetAt: null }), today).key).toBe('nogoal');
    expect(trackOf(client({ status: 'expired' }), today).key).toBe('ended');
  });
  it('lists what the coach has to do this week, most important first', () => {
    const birthday = `1990-${inDays(3).slice(5)}`;
    const todo = followUpsOf(client({ checkedInThisWeek: false, endDate: inDays(5), lastVisit: inDays(-8), dob: birthday }), today);
    expect(todo.map(x => x.type)).toEqual(['checkin', 'ending', 'away', 'birthday']);
    expect(followUpsOf(client({ goalSetAt: null }), today)[0].type).toBe('goals');
    expect(followUpsOf(client({ status: 'cancelled' }), today)).toEqual([]);
  });
});

// F-091: the screens offer only what the server allows, so both copies of
// the ladder must give the same answer for every pair of roles
describe('who may act on whom', () => {
  const roles = Object.keys(server.ladder.RANK);

  it('ranks every role the same in the browser and on the server', () => {
    expect(ladder.RANK).toEqual(server.ladder.RANK);
  });

  it('agrees on private fields and on managing, for someone else and for oneself', () => {
    for (const a of roles) {
      for (const b of roles) {
        const actor = { id: 'a', role: a };
        for (const target of [{ id: 'b', role: b }, { id: 'a', role: a }]) {
          expect(ladder.canSeePrivateFields(actor, target), `${a} -> ${target.role}`).toBe(server.ladder.canSeePrivateFields(actor, target));
          expect(ladder.canManage(actor, target), `${a} -> ${target.role}`).toBe(server.ladder.canManage(actor, target));
        }
      }
    }
  });
});
