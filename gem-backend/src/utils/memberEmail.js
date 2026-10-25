const { Resend } = require('resend');
const { deliver } = require('./sendEmail');
const prisma = require('./prisma');
const { buildReceiptPdf } = require('./receiptPdf');
const { formatMoney, currencyOf } = require('./money');
const E = require('./emailLayout');
const { textFor, languageOf } = require('./memberEmailText');

const TONE = {
  active: 'green', visitor: 'green', registered: 'gold', pending: 'amber', expiring: 'amber', frozen: 'grey',
  suspended: 'red', expired: 'red', cancelled: 'red', deactivated: 'red',
};
const statusBadge = (status, T) => {
  const label = T.statuses[status] || String(status || '').replace(/_/g, ' ');
  return label ? E.badge(label, TONE[status] || 'grey') : '';
};

async function getGym(gymId) {
  return prisma.gym.findUnique({
    where: { id: gymId },
    select: {
      name: true, code: true, logo: true, location: true, phone: true, email: true, currency: true,
      city: true, country: true, website: true, facebook: true, instagram: true, twitter: true, settings: true,
    },
  });
}

// Replies to the sending address go nowhere, so the member is pointed at the gym
const callUs = (gym, T) => (gym.phone
  ? E.pHtml(E.esc(T.callUsPhone('\u0000')).replace('\u0000', E.strong(gym.phone)))
  : E.p(T.callUsDesk));

async function send({ gym, to, subject, html, attachments }) {
  if (!process.env.RESEND_API_KEY || !to) return false;
  const resend = new Resend(process.env.RESEND_API_KEY);
  await deliver(resend, {
    from: E.sender(gym?.name),
    to,
    subject,
    html,
    ...(attachments?.length ? { attachments } : {}),
  }, gym);
  return true;
}

// ── Welcome email, sent when a member is registered ───────────────────────────
async function sendMemberWelcome(member, gymId) {
  if (!member?.email) return false;
  const gym = await getGym(gymId);
  if (!gym) return false;
  const lang = languageOf(gym), T = textFor(gym), W = T.welcome;

  const body = [
    E.greeting(member.firstName, lang),
    E.p(W.line(gym.name)),
    E.tiles([
      member.memberCode && { label: T.memberId, value: member.memberCode, mono: true },
      member.accessCode && { label: T.checkInCode, value: member.accessCode, mono: true },
    ]),
    E.details([
      [W.package, member.package?.name],
      [W.starts, E.longDate(member.startDate, lang)],
      [W.validUntil, E.longDate(member.endDate, lang)],
    ]),
    E.note(E.esc(W.keepCode)),
    E.p(W.seeYou),
  ].join('');

  return send({
    gym, to: member.email, subject: W.subject(gym.name),
    html: E.layout({ lang, brand: E.gymBrand(gym), gym, preheader: W.preheader(member.memberCode || ''), eyebrow: W.eyebrow, title: W.subject(gym.name), body }),
  });
}

// ── Payment receipt with a downloadable PDF attached ──────────────────────────
async function sendPaymentReceipt(payment, member, gymId) {
  if (!member?.email) return false;
  const gym = await getGym(gymId);
  if (!gym) return false;
  const lang = languageOf(gym), T = textFor(gym), R = T.receipt;

  const currency = currencyOf(gym);
  const amount = formatMoney(payment.amount, currency);
  const paidOn = E.longDate(payment.createdAt || Date.now(), lang);

  const body = [
    E.greeting(member.firstName, lang),
    E.p(R.thanks),
    E.highlight({ label: R.amountPaid, value: amount, sub: paidOn }),
    E.details([
      [R.reference, payment.reference],
      [T.memberId, member.memberCode],
      [R.for, payment.note],
      [R.paidBy, T.methods[payment.method] || String(payment.method || '').replace(/_/g, ' ')],
      [R.balanceLeft, payment.balanceAfter != null ? formatMoney(payment.balanceAfter, currency) : null],
    ]),
    E.note(E.esc(R.attached)),
    callUs(gym, T),
  ].join('');

  let attachments;
  try {
    const pdf = await buildReceiptPdf({ gym, member, payment, currencyCode: currency, lang });
    attachments = [{
      filename: `receipt-${payment.reference || 'payment'}.pdf`,
      content: pdf.toString('base64'),
    }];
  } catch (err) {
    // Still send the email even if the PDF could not be produced
    console.error('Receipt PDF generation failed:', err.message);
  }

  return send({
    gym, to: member.email, subject: R.subject(amount, gym.name), attachments,
    html: E.layout({ lang, brand: E.gymBrand(gym), gym, preheader: R.preheader(amount), eyebrow: R.eyebrow, title: R.title, body }),
  });
}

// ── Access code, re-sent to a member on request from the front desk ───────────
async function sendAccessCode(member, gymId) {
  if (!member?.email) return false;
  const gym = await getGym(gymId);
  if (!gym) return false;
  const lang = languageOf(gym), T = textFor(gym), C = T.code;

  const body = [
    E.greeting(member.firstName, lang),
    E.p(C.line(gym.name)),
    E.highlight({ label: T.checkInCode, value: member.accessCode, mono: true }),
    E.note(E.esc(C.keep)),
  ].join('');

  return send({
    gym, to: member.email, subject: C.subject(gym.name),
    html: E.layout({ lang, brand: E.gymBrand(gym), gym, preheader: C.preheader, eyebrow: C.eyebrow, title: C.title, body }),
  });
}

// ── A change to the member's membership (extend / freeze / renew / …) ─────────
async function sendMembershipUpdate(member, action, gymId) {
  if (!member?.email) return false;
  const gym = await getGym(gymId);
  if (!gym) return false;
  const lang = languageOf(gym), T = textFor(gym);
  const m = T.changes[action];
  if (!m) return false;
  const showUntil = action !== 'cancel_membership' && action !== 'convert_to_visitor';

  const body = [
    E.greeting(member.firstName, lang),
    E.p(m.line),
    E.details([
      [T.memberId, member.memberCode],
      [T.status, statusBadge(member.status, T)],
      [T.welcome.validUntil, showUntil ? E.longDate(member.endDate, lang) : null],
    ]),
    callUs(gym, T),
  ].join('');

  return send({
    gym, to: member.email, subject: `${m.subject}, ${gym.name}`,
    html: E.layout({ lang, brand: E.gymBrand(gym), gym, preheader: m.line, eyebrow: m.eyebrow, title: m.subject, body }),
  });
}

// ── A coach takes the member on: who they are and how to reach them ─────────
async function sendCoachIntro(member, coach, gymId) {
  if (!member?.email || !coach) return false;
  const gym = await getGym(gymId);
  if (!gym) return false;
  const lang = languageOf(gym), T = textFor(gym), K = T.coach;
  const name = `${coach.firstName || ''} ${coach.lastName || ''}`.trim();

  const body = [
    E.greeting(member.firstName, lang),
    E.pHtml(E.esc(K.line('\u0000', gym.name)).replace('\u0000', E.strong(name))),
    E.details([
      [K.coach, name],
      [K.email, coach.email ? { html: E.link(`mailto:${coach.email}`, coach.email) } : null],
      [K.phone, coach.phone ? { html: E.link(`tel:${String(coach.phone).replace(/[^\d+]/g, '')}`, coach.phone) } : null],
    ], K.section),
    E.p(K.next),
  ].join('');

  return send({
    gym, to: member.email, subject: K.subject(gym.name),
    html: E.layout({ lang, brand: E.gymBrand(gym), gym, preheader: K.preheader(name), eyebrow: K.eyebrow, title: K.title, body }),
  });
}

module.exports = { sendMemberWelcome, sendPaymentReceipt, sendAccessCode, sendMembershipUpdate, sendCoachIntro };
