const { Resend } = require('resend');
const { deliver } = require('./sendEmail');
const prisma = require('./prisma');
const { buildReceiptPdf } = require('./receiptPdf');
const { formatMoney, currencyOf } = require('./money');
const E = require('./emailLayout');

const METHOD_NAMES = { cash: 'Cash', card: 'Card', bank_transfer: 'Bank transfer', mobile_money: 'Mobile money' };
const STATUS_LOOK = {
  active: ['Active', 'green'], visitor: ['Active', 'green'], registered: ['Registered', 'gold'], pending: ['Starts soon', 'amber'],
  expiring: ['Ending soon', 'amber'], frozen: ['Frozen', 'grey'], suspended: ['Suspended', 'red'],
  expired: ['Expired', 'red'], cancelled: ['Cancelled', 'red'], deactivated: ['Deactivated', 'red'],
};
const statusBadge = (status) => {
  const [label, tone] = STATUS_LOOK[status] || [String(status || '').replace(/_/g, ' '), 'grey'];
  return label ? E.badge(label, tone) : '';
};

async function getGym(gymId) {
  return prisma.gym.findUnique({
    where: { id: gymId },
    select: {
      name: true, logo: true, location: true, phone: true, email: true, currency: true,
      city: true, country: true, website: true, facebook: true, instagram: true, twitter: true,
    },
  });
}

// Replies to the sending address go nowhere, so the member is pointed at the gym
const callUs = (gym) => (gym.phone
  ? E.pHtml(`If anything doesn't look right, call us on ${E.strong(gym.phone)} and we'll sort it out.`)
  : E.p("If anything doesn't look right, speak to us at the front desk and we'll sort it out."));

async function send({ gym, to, subject, html, attachments }) {
  if (!process.env.RESEND_API_KEY || !to) return false;
  const resend = new Resend(process.env.RESEND_API_KEY);
  await deliver(resend, {
    from: E.sender(gym?.name),
    to,
    subject,
    html,
    ...(attachments?.length ? { attachments } : {}),
  });
  return true;
}

// ── Welcome email, sent when a member is registered ───────────────────────────
async function sendMemberWelcome(member, gymId) {
  if (!member?.email) return false;
  const gym = await getGym(gymId);
  if (!gym) return false;

  const body = [
    E.greeting(member.firstName),
    E.p(`Your membership at ${gym.name} is set up. Here is what you need to check in.`),
    E.tiles([
      member.memberCode && { label: 'Member ID', value: member.memberCode, mono: true },
      member.accessCode && { label: 'Check-in code', value: member.accessCode, mono: true },
    ]),
    E.details([
      ['Package', member.package?.name],
      ['Starts', E.longDate(member.startDate)],
      ['Valid until', E.longDate(member.endDate)],
    ]),
    E.note('Keep your check-in code to yourself: it is how the front desk knows it is you.'),
    E.p('See you at the gym.'),
  ].join('');

  return send({
    gym, to: member.email, subject: `Welcome to ${gym.name}`,
    html: E.layout({ brand: E.gymBrand(gym), gym, preheader: `Your membership is set up. Member ID ${member.memberCode || ''}`.trim(), eyebrow: 'Welcome', title: `Welcome to ${gym.name}`, body }),
  });
}

// ── Payment receipt with a downloadable PDF attached ──────────────────────────
async function sendPaymentReceipt(payment, member, gymId) {
  if (!member?.email) return false;
  const gym = await getGym(gymId);
  if (!gym) return false;

  const currency = currencyOf(gym);
  const amount = formatMoney(payment.amount, currency);
  const paidOn = E.longDate(payment.createdAt || Date.now());

  const body = [
    E.greeting(member.firstName),
    E.p('Thank you, we have received your payment.'),
    E.highlight({ label: 'Amount paid', value: amount, sub: paidOn }),
    E.details([
      ['Reference', payment.reference],
      ['Member ID', member.memberCode],
      ['For', payment.note],
      ['Paid by', METHOD_NAMES[payment.method] || String(payment.method || '').replace(/_/g, ' ')],
      ['Balance left to pay', payment.balanceAfter != null ? formatMoney(payment.balanceAfter, currency) : null],
    ]),
    E.note('Your receipt is attached to this email as a PDF you can download and keep.'),
    callUs(gym),
  ].join('');

  let attachments;
  try {
    const pdf = await buildReceiptPdf({ gym, member, payment, currencyCode: currency });
    attachments = [{
      filename: `receipt-${payment.reference || 'payment'}.pdf`,
      content: pdf.toString('base64'),
    }];
  } catch (err) {
    // Still send the email even if the PDF could not be produced
    console.error('Receipt PDF generation failed:', err.message);
  }

  return send({
    gym, to: member.email, subject: `Payment receipt: ${amount}, ${gym.name}`, attachments,
    html: E.layout({ brand: E.gymBrand(gym), gym, preheader: `We received ${amount}. Your receipt is attached.`, eyebrow: 'Payment received', title: 'Thank you for your payment', body }),
  });
}

// ── Access code, re-sent to a member on request from the front desk ───────────
async function sendAccessCode(member, gymId) {
  if (!member?.email) return false;
  const gym = await getGym(gymId);
  if (!gym) return false;

  const body = [
    E.greeting(member.firstName),
    E.p(`Here is your check-in code for ${gym.name}. Give it at the front desk when you come in.`),
    E.highlight({ label: 'Check-in code', value: member.accessCode, mono: true }),
    E.note('Keep it to yourself: it is how we know it is you.'),
  ].join('');

  return send({
    gym, to: member.email, subject: `Your check-in code, ${gym.name}`,
    html: E.layout({ brand: E.gymBrand(gym), gym, preheader: 'Your check-in code is inside.', eyebrow: 'Check-in code', title: 'Your check-in code', body }),
  });
}

// ── A change to the member's membership (extend / freeze / renew / …) ─────────
const MEMBERSHIP_CHANGES = {
  extend_membership:   { subject: 'Your membership was extended',  eyebrow: 'Membership extended', line: 'Your membership has been extended.' },
  freeze_membership:   { subject: 'Your membership was frozen',    eyebrow: 'Membership frozen',   line: 'Your membership has been frozen (paused). It will carry on once it is unfrozen.' },
  unfreeze_membership: { subject: 'Your membership was unfrozen',  eyebrow: 'Membership resumed',  line: 'Your membership has been unfrozen and is active again.' },
  cancel_membership:   { subject: 'Your membership was cancelled', eyebrow: 'Membership cancelled', line: 'Your membership has been cancelled.' },
  convert_to_visitor:  { subject: 'You are now on a visitor pass', eyebrow: 'Visitor pass',         line: 'Your membership has been changed to a visitor pass.' },
  renew_membership:    { subject: 'Your membership was renewed',   eyebrow: 'Membership renewed',  line: 'Your membership has been renewed.' },
};
async function sendMembershipUpdate(member, action, gymId) {
  if (!member?.email) return false;
  const gym = await getGym(gymId);
  if (!gym) return false;
  const m = MEMBERSHIP_CHANGES[action];
  if (!m) return false;
  const showUntil = action !== 'cancel_membership' && action !== 'convert_to_visitor';

  const body = [
    E.greeting(member.firstName),
    E.p(m.line),
    E.details([
      ['Member ID', member.memberCode],
      ['Status', statusBadge(member.status)],
      ['Valid until', showUntil ? E.longDate(member.endDate) : null],
    ]),
    callUs(gym),
  ].join('');

  return send({
    gym, to: member.email, subject: `${m.subject}, ${gym.name}`,
    html: E.layout({ brand: E.gymBrand(gym), gym, preheader: m.line, eyebrow: m.eyebrow, title: m.subject, body }),
  });
}

// ── A coach takes the member on: who they are and how to reach them ─────────
async function sendCoachIntro(member, coach, gymId) {
  if (!member?.email || !coach) return false;
  const gym = await getGym(gymId);
  if (!gym) return false;
  const name = `${coach.firstName || ''} ${coach.lastName || ''}`.trim();

  const body = [
    E.greeting(member.firstName),
    E.pHtml(`${E.strong(name)} is now your coach at ${E.esc(gym.name)}. They will set your goals with you, take your measurements each week and help you stay on track.`),
    E.details([
      ['Coach', name],
      ['Email', coach.email ? { html: E.link(`mailto:${coach.email}`, coach.email) } : null],
      ['Phone', coach.phone ? { html: E.link(`tel:${String(coach.phone).replace(/[^\d+]/g, '')}`, coach.phone) } : null],
    ], 'Your coach'),
    E.p('Get in touch with them to plan your first session.'),
  ].join('');

  return send({
    gym, to: member.email, subject: `Meet your coach, ${gym.name}`,
    html: E.layout({ brand: E.gymBrand(gym), gym, preheader: `${name} is now your coach.`, eyebrow: 'Your coach', title: 'Meet your coach', body }),
  });
}

module.exports = { sendMemberWelcome, sendPaymentReceipt, sendAccessCode, sendMembershipUpdate, sendCoachIntro };
