// Phase 3, authorization sweep: every route that takes an id, and every create
// that names another record, refuses one from another gym and leaves it as it
// was. Gym A's owner passes every role check, so what is tested here is the
// gym boundary alone.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/server.mjs';
import { registerGym, addStaff, uniqueCode } from './helpers/fixtures.mjs';

let api, stop;
const A = {};
const B = {};
const day = (n = 0) => { const d = new Date(Date.now() + n * 864e5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const month = () => new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' });
const ok = (res, label) => { if (res.status >= 300) throw new Error(`${label}: ${res.status} ${res.text}`); return res.body; };

beforeAll(async () => {
  ({ api, stop } = await startServer());
  A.gym = await registerGym(api);
  B.gym = await registerGym(api);
  const t = { token: B.gym.token };
  B.pkg = ok(await api.post('/api/packages', { name: `Gold ${uniqueCode('p')}`, price: 15000, dayPassPrice: 2000, duration: '1 Months', durationDays: 30 }, t), 'package');
  B.member = ok(await api.post('/api/members', { firstName: 'Bea', lastName: 'Bgym', city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: day(), endDate: day(30), packageId: B.pkg.id, balance: 15000 }, t), 'member');
  B.payment = ok(await api.post('/api/payments', { memberId: B.member.id, amount: 5000, method: 'cash', type: 'membership' }, t), 'payment');
  B.expense = ok(await api.post('/api/expenses', { title: 'Electricity', category: 'Utilities', amount: 25000, date: day(), paidTo: 'ENEO', method: 'cash' }, t), 'expense');
  B.desk = await addStaff(api, B.gym, { role: 'front_desk' });
  B.trainer = await addStaff(api, B.gym, { role: 'trainer' });
  B.task = ok(await api.post('/api/tasks', { title: 'B task', category: 'Operations', dueDate: day(2), priority: 'Medium', assignedToId: B.desk.id }, t), 'task');
  B.issue = ok(await api.post('/api/equipment', { equipment: 'Treadmill B', description: 'Belt slips', severity: 'high' }, t), 'equipment');
  B.event = ok(await api.post('/api/calendar', { title: 'B class', date: day(1), time: '07:00', duration: '08:00' }, t), 'calendar');
  B.event = Array.isArray(B.event) ? B.event[0] : (B.event.event || B.event);
  B.draft = ok(await api.post('/api/communications', { action: 'draft', channel: 'email', subject: 'B news', body: 'Hello', audience: { type: 'all' } }, t), 'communication');
  B.draft = B.draft.communication || B.draft;
  B.product = ok(await api.post('/api/products', { name: 'B water', code: uniqueCode('w').slice(0, 10).toUpperCase(), category: 'Drinks', price: 500, costPrice: 300, stock: 10 }, t), 'product');
  B.approval = ok(await api.post('/api/approvals', { memberId: B.member.id, action: 'extend_membership', params: { days: 5 }, note: 'Travelled' }, { token: B.desk.token }), 'approval');
  B.approval = B.approval.request || B.approval;
  B.hourly = await addStaff(api, B.gym, { role: 'front_desk', employmentType: 'Part Time' });
  B.timecard = ok(await api.post('/api/timecards/punchin', { staffId: B.hourly.id }, t), 'timecard');
  B.timecard = B.timecard.timecard || B.timecard;
  B.adjustment = ok(await api.post('/api/pay-adjustments', { staffId: B.desk.id, kind: 'bonus', label: 'Transport', amount: 5000, recurring: true }, t), 'pay adjustment');
  ok(await api.patch(`/api/staff/${B.desk.id}`, { salary: 100000 }, t), 'salary');
  B.payroll = ok(await api.post('/api/payroll', { staffId: B.desk.id, month: month() }, t), 'payroll');
  B.payroll = B.payroll.record || B.payroll;
  ok(await api.post('/api/coach/assign', { memberId: B.member.id, coachId: B.trainer.id }, t), 'coach assign');
  B.progress = ok(await api.post(`/api/coach/progress/${B.member.id}`, { kind: 'note', category: 'general', note: 'B progress' }, t), 'progress');
  B.progress = B.progress.entry || B.progress;
  B.notification = (await api.get('/api/notifications', t)).body[0];
});
afterAll(() => stop());

// Refused (or, for a list, empty): never another gym's data, never a change
const refused = (res) => [400, 403, 404, 409].includes(res.status);
const emptyOrRefused = (res) => refused(res) || (res.status === 200 && Array.isArray(res.body) && res.body.length === 0);

describe('another gym\'s records, by id', () => {
  const as = () => ({ token: A.gym.token });
  const cases = () => [
    ['GET member', () => api.get(`/api/members/${B.member.id}`, as())],
    ['PATCH member', () => api.patch(`/api/members/${B.member.id}`, { firstName: 'Hacked' }, as())],
    ['send member code', () => api.post(`/api/members/${B.member.id}/send-code`, { via: 'email' }, as())],
    ['DELETE member', () => api.del(`/api/members/${B.member.id}`, as())],
    ['GET staff', () => api.get(`/api/staff/${B.desk.id}`, as())],
    ['GET staff code', () => api.get(`/api/staff/${B.desk.id}/code`, as())],
    ['verify staff code', () => api.post(`/api/staff/${B.desk.id}/verify-code`, { code: B.desk.accessCode }, as())],
    ['regenerate staff code', () => api.post(`/api/staff/${B.desk.id}/code/regenerate`, {}, as())],
    ['resend staff invite', () => api.post(`/api/staff/${B.desk.id}/resend-invite`, {}, as())],
    ['PATCH staff', () => api.patch(`/api/staff/${B.desk.id}`, { firstName: 'Hacked' }, as())],
    ['add staff note', () => api.post(`/api/staff/${B.desk.id}/notes`, { content: 'Hacked' }, as())],
    ['DELETE staff', () => api.del(`/api/staff/${B.desk.id}`, as())],
    ['PATCH package', () => api.patch(`/api/packages/${B.pkg.id}`, { price: 1 }, as())],
    ['DELETE package', () => api.del(`/api/packages/${B.pkg.id}`, as())],
    ['send receipt', () => api.post(`/api/payments/${B.payment.id}/receipt`, {}, as())],
    ['DELETE payment', () => api.del(`/api/payments/${B.payment.id}`, as())],
    ['review expense', () => api.patch(`/api/expenses/${B.expense.id}/approve`, {}, as())],
    ['PATCH expense', () => api.patch(`/api/expenses/${B.expense.id}`, { amount: 1 }, as())],
    ['DELETE expense', () => api.del(`/api/expenses/${B.expense.id}`, as())],
    ['PATCH task', () => api.patch(`/api/tasks/${B.task.id}`, { title: 'Hacked' }, as())],
    ['DELETE task', () => api.del(`/api/tasks/${B.task.id}`, as())],
    ['PATCH equipment', () => api.patch(`/api/equipment/${B.issue.id}`, { status: 'resolved' }, as())],
    ['PATCH event', () => api.patch(`/api/calendar/${B.event.id}`, { title: 'Hacked' }, as())],
    ['DELETE event', () => api.del(`/api/calendar/${B.event.id}`, as())],
    ['GET message', () => api.get(`/api/communications/${B.draft.id}`, as())],
    ['retry message', () => api.post(`/api/communications/${B.draft.id}/retry`, {}, as())],
    ['cancel message', () => api.post(`/api/communications/${B.draft.id}/cancel`, {}, as())],
    ['send another gym\'s draft', () => api.post('/api/communications', { id: B.draft.id, action: 'draft', channel: 'email', subject: 'Hacked', body: 'Hacked', audience: { type: 'all' } }, as())],
    ['DELETE message', () => api.del(`/api/communications/${B.draft.id}`, as())],
    ['read notification', () => api.patch(`/api/notifications/${B.notification.id}/read`, {}, as())],
    ['DELETE notification', () => api.del(`/api/notifications/${B.notification.id}`, as())],
    ['PATCH product', () => api.patch(`/api/products/${B.product.id}`, { price: 1 }, as())],
    ['restock product', () => api.post(`/api/products/${B.product.id}/restock`, { quantity: 5 }, as())],
    ['DELETE product', () => api.del(`/api/products/${B.product.id}`, as())],
    ['approve request', () => api.post(`/api/approvals/${B.approval.id}/approve`, {}, as())],
    ['reject request', () => api.post(`/api/approvals/${B.approval.id}/reject`, {}, as())],
    ['cancel request', () => api.post(`/api/approvals/${B.approval.id}/cancel`, {}, as())],
    ['punch out', () => api.patch(`/api/timecards/${B.timecard.id}/punchout`, {}, as())],
    ['adjust time card', () => api.patch(`/api/timecards/${B.timecard.id}/adjust`, { punchIn: '06:00', note: 'x' }, as())],
    ['approve time card', () => api.patch(`/api/timecards/${B.timecard.id}/approve`, {}, as())],
    ['reject time card', () => api.patch(`/api/timecards/${B.timecard.id}/reject`, {}, as())],
    ['DELETE time card', () => api.del(`/api/timecards/${B.timecard.id}`, as())],
    ['pay status', () => api.patch(`/api/payroll/${B.payroll.id}/status`, { status: 'paid' }, as())],
    ['DELETE pay record', () => api.del(`/api/payroll/${B.payroll.id}`, as())],
    ['PATCH pay adjustment', () => api.patch(`/api/pay-adjustments/${B.adjustment.id}`, { amount: 1 }, as())],
    ['DELETE pay adjustment', () => api.del(`/api/pay-adjustments/${B.adjustment.id}`, as())],
    ['set goals', () => api.put(`/api/coach/goals/${B.member.id}`, { goalType: 'lose_weight', goalWeight: 70 }, as())],
    ['add progress', () => api.post(`/api/coach/progress/${B.member.id}`, { kind: 'note', category: 'general', note: 'Hacked' }, as())],
    ['DELETE progress', () => api.del(`/api/coach/progress/entry/${B.progress.id}`, as())],
  ];

  it('refuses each one', async () => {
    const leaks = [];
    for (const [label, run] of cases()) {
      const res = await run();
      if (!refused(res)) leaks.push(`${label}: ${res.status} ${res.text.slice(0, 80)}`);
    }
    expect(leaks).toEqual([]);
  });

  it('their employee reads as not active here', async () => {
    // The desk asks this of whoever is signed in at it; for someone of another
    // gym it answers as for nobody, without saying anything about them
    const res = await api.get(`/api/staff/${B.desk.id}/active`, as());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ active: false });
  });

  it('lists that name another gym\'s person come back empty or refused', async () => {
    const lists = [
      ['approvals for a member', api.get(`/api/approvals/member/${B.member.id}`, as())],
      ['messages for a member', api.get(`/api/communications/member/${B.member.id}`, as())],
      ['progress of a member', api.get(`/api/coach/progress/${B.member.id}`, as())],
      ['a coach\'s clients', api.get(`/api/coach/clients/${B.trainer.id}`, as())],
      ['pay records of an employee', api.get(`/api/payroll/staff/${B.desk.id}`, as())],
      ['pay adjustments of an employee', api.get(`/api/pay-adjustments/staff/${B.desk.id}`, as())],
      ['pay preview of an employee', api.get(`/api/pay-adjustments/staff/${B.desk.id}/preview?month=${encodeURIComponent(month())}`, as())],
    ];
    const leaks = [];
    for (const [label, pending] of lists) {
      const res = await pending;
      const clientsEmpty = res.status === 200 && Array.isArray(res.body?.clients) && res.body.clients.length === 0;
      if (!emptyOrRefused(res) && !clientsEmpty) leaks.push(`${label}: ${res.status} ${res.text.slice(0, 80)}`);
    }
    expect(leaks).toEqual([]);
  });

  it('left every one of them as it was', async () => {
    const t = { token: B.gym.token };
    expect((await api.get(`/api/members/${B.member.id}`, t)).body.firstName).toBe('Bea');
    const staff = (await api.get(`/api/staff/${B.desk.id}`, t)).body;
    expect(staff.firstName).not.toBe('Hacked');
    expect(staff.isActive).toBe(true);
    expect((staff.staffNotes || []).some(n => n.content === 'Hacked')).toBe(false);
    expect((await api.get('/api/packages', t)).body.find(p => p.id === B.pkg.id)?.price).toBe(15000);
    expect((await api.get('/api/payments', t)).body.some(p => p.id === B.payment.id)).toBe(true);
    expect((await api.get('/api/expenses', t)).body.find(e => e.id === B.expense.id)?.amount).toBe(25000);
    expect((await api.get('/api/tasks', t)).body.find(x => x.id === B.task.id)?.title).toBe('B task');
    expect((await api.get('/api/products', t)).body.find(p => p.id === B.product.id)).toMatchObject({ price: 500, stock: 10 });
    expect((await api.get(`/api/approvals/member/${B.member.id}`, t)).body.find(r => r.id === B.approval.id)?.status).toBe('pending');
    expect((await api.get(`/api/coach/progress/${B.member.id}`, t)).body.some(e => e.note === 'Hacked')).toBe(false);
  });
});

describe('creating something that names another gym\'s record', () => {
  const as = () => ({ token: A.gym.token });

  it('is refused', async () => {
    const attempts = [
      ['payment for their member', () => api.post('/api/payments', { memberId: B.member.id, amount: 1000, method: 'cash', type: 'other' }, as())],
      ['check-in of their member', () => api.post('/api/attendance/checkin', { memberId: B.member.id }, as())],
      ['task for their employee', () => api.post('/api/tasks', { title: 'Cross', category: 'Operations', dueDate: day(2), priority: 'Low', assignedToId: B.desk.id }, as())],
      ['approval for their member', () => api.post('/api/approvals', { memberId: B.member.id, action: 'extend_membership', params: { days: 5 }, note: 'x' }, as())],
      ['pay record for their employee', () => api.post('/api/payroll', { staffId: B.desk.id, month: month() }, as())],
      ['pay adjustment for their employee', () => api.post('/api/pay-adjustments', { staffId: B.desk.id, kind: 'bonus', label: 'x', amount: 1000, recurring: true }, as())],
      ['clock-in for their employee', () => api.post('/api/timecards/punchin', { staffId: B.hourly.id }, as())],
      ['their member given a coach', () => api.post('/api/coach/assign', { memberId: B.member.id, coachId: B.trainer.id }, as())],
      ['sale of their product', () => api.post('/api/sales', { items: [{ productId: B.product.id, quantity: 1 }], method: 'Cash' }, as())],
    ];
    const leaks = [];
    for (const [label, run] of attempts) {
      const res = await run();
      if (!refused(res)) leaks.push(`${label}: ${res.status} ${res.text.slice(0, 80)}`);
    }
    expect(leaks).toEqual([]);
    expect((await api.get('/api/products', { token: B.gym.token })).body.find(p => p.id === B.product.id)?.stock).toBe(10);
  });

  it('a message to chosen members reaches none of theirs', async () => {
    const res = await api.post('/api/communications/audience', { audience: { type: 'members', memberIds: [B.member.id] }, list: true }, as());
    expect(res.status).toBe(200);
    expect(res.body.total ?? res.body.count ?? (res.body.people || []).length).toBe(0);
  });

  it('a calendar event cannot put their employees on it', async () => {
    const res = await api.post('/api/calendar', { title: 'Cross class', date: day(1), time: '09:00', duration: '10:00', staffIds: [B.desk.id] }, as());
    if (res.status < 300) {
      const tasks = (await api.get('/api/tasks', { token: B.gym.token })).body;
      expect(tasks.some(x => x.title === 'Cross class' || x.eventId === (res.body.id || res.body[0]?.id))).toBe(false);
    } else {
      expect(refused(res)).toBe(true);
    }
  });

  it('a new member cannot be put on their package', async () => {
    const res = await api.post('/api/members', { firstName: 'Cross', lastName: 'Package', city: 'Douala', region: 'Littoral', regFeeMethod: 'cash', startDate: day(), endDate: day(30), packageId: B.pkg.id }, as());
    if (res.status < 300) expect(res.body.packageId ?? null).not.toBe(B.pkg.id);
    else expect(refused(res)).toBe(true);
  });
});
