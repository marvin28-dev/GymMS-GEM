// Emails GEM itself sends a gym's owner (not the gym to its members): bills,
// reminders, an account paused or reopened, an answer to a support report,
// announcements. On the shared layout, from "GEM", in English like every
// email to staff. Each one is best-effort: what it reports already happened.
const { Resend } = require('resend');
const prisma = require('./prisma');
const E = require('./emailLayout');
const { deliver } = require('./sendEmail');
const { formatMoney } = require('./money');
const { supportEmail } = require('./support');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (period) => {
  const [y, m] = String(period).split('-').map(Number);
  return m ? `${MONTHS[m - 1]} ${y}` : String(period);
};
const appUrl = (path) => `${process.env.FRONTEND_URL || 'http://localhost:5173'}${path}`;

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  return new Resend(process.env.RESEND_API_KEY);
}

// The owners of a gym who can be written to
const ownersOf = async (gymId) => (await prisma.staff.findMany({
  where: { gymId, role: 'general_manager', isActive: true },
  select: { id: true, firstName: true, email: true },
})).filter(o => String(o.email || '').trim());

async function toOwners(gym, build) {
  const owners = await ownersOf(gym.id);
  const resend = owners.length ? getResend() : null;
  let sent = 0;
  for (const owner of owners) {
    try {
      const { subject, html } = build(owner);
      await deliver(resend, { from: E.sender(null), to: owner.email, replyTo: supportEmail(), subject, html }, gym);
      sent += 1;
    } catch (err) {
      console.error(`GEM email to ${gym.code} could not be sent:`, err.message);
    }
  }
  return sent;
}

// The bill's figures as rows
function billRows(inv) {
  const money = (n) => formatMoney(n, inv.currency);
  return [
    ['Month', monthName(inv.period)],
    ['Active members', String(inv.members)],
    ['Price per member', money(inv.rate)],
    inv.billableDays < inv.daysInPeriod ? ['Days charged', `${inv.billableDays} of ${inv.daysInPeriod} (after your free trial)`] : null,
    inv.discount ? ['Discount', `-${money(inv.discount)}`] : null,
    inv.dueDate ? ['Due by', E.longDate(inv.dueDate)] : null,
  ];
}

const howToPay = (settings) => (settings.paymentInstructions
  ? E.note(`<strong>How to pay</strong><br>${E.esc(settings.paymentInstructions).replace(/\r?\n/g, '<br>')}`)
  : E.note('Reply to this email to arrange payment.'));

// A bill sent, a reminder that it is due or overdue, or a thank-you once paid
function sendBill(gym, inv, settings, kind = 'sent') {
  const amount = formatMoney(kind === 'paid' ? (inv.paidAmount ?? inv.amount) : inv.amount, inv.currency);
  const month = monthName(inv.period);
  const copy = {
    sent: { subject: `Your GEM bill for ${month}: ${amount}`, eyebrow: 'Your GEM bill', title: `${month}: ${amount}`, line: `Here is what ${gym.name} owes GEM for ${month}.` },
    reminder: { subject: `Reminder: your GEM bill for ${month} is due`, eyebrow: 'Payment reminder', title: `${amount} is due`, line: `Your GEM bill for ${month} has not been paid yet. Please pay it so your account stays open.` },
    paid: { subject: `Thank you: GEM received ${amount}`, eyebrow: 'Payment received', title: 'Thank you', line: `We received ${amount} for ${gym.name}'s GEM bill for ${month}.` },
  }[kind];
  return toOwners(gym, (owner) => ({
    subject: copy.subject,
    html: E.layout({
      brand: E.gemBrand, preheader: copy.line, eyebrow: copy.eyebrow, title: copy.title,
      body: [
        E.greeting(owner.firstName),
        E.p(copy.line),
        E.highlight({ label: kind === 'paid' ? 'Paid' : 'Amount due', value: amount, tone: kind === 'paid' ? 'green' : kind === 'reminder' ? 'amber' : 'gold' }),
        E.details(billRows(inv)),
        inv.note ? E.note(E.esc(inv.note), 'grey') : '',
        kind === 'paid' ? '' : howToPay(settings),
        E.button(appUrl('/settings?section=billing'), 'See it in GEM'),
      ].join(''),
    }),
  }));
}

// The account paused for an unpaid bill, or opened again
function sendLockChange(gym, locked, reason, settings) {
  return toOwners(gym, (owner) => ({
    subject: locked ? `Your GEM account for ${gym.name} is paused` : `Your GEM account for ${gym.name} is open again`,
    html: E.layout({
      brand: E.gemBrand,
      preheader: locked ? 'Your staff cannot use GEM until the account is reopened.' : 'Everyone can use GEM again.',
      eyebrow: locked ? 'Account paused' : 'Account open', title: locked ? 'Your account is paused' : 'Welcome back',
      body: [
        E.greeting(owner.firstName),
        E.p(locked
          ? `GEM has paused ${gym.name}'s account. Until it is reopened, your staff can sign in but cannot use GEM.`
          : `${gym.name}'s GEM account is open again. Everyone can carry on as before.`),
        locked && reason ? E.details([['Why', reason]]) : '',
        locked ? howToPay(settings) : '',
        E.button(appUrl(locked ? '/settings?section=billing' : '/dashboard'), locked ? 'See what is due' : 'Open GEM'),
      ].join(''),
    }),
  }));
}

// GEM support's answer to a report
async function sendSupportReply(report, gym) {
  if (!report.senderEmail) return 0;
  await deliver(getResend(), {
    from: E.sender(null), to: report.senderEmail, replyTo: supportEmail(),
    subject: `Re: ${report.subject}`,
    html: E.layout({
      brand: E.gemBrand, preheader: String(report.reply).slice(0, 110), eyebrow: 'GEM support', title: report.subject,
      body: [
        E.greeting(String(report.senderName || '').split(' ')[0]),
        E.pHtml(E.esc(report.reply).replace(/\r?\n/g, '<br>')),
        E.details([['Your report', report.subject], ['Status', report.status === 'resolved' ? 'Resolved' : 'In progress']]),
        E.button(appUrl('/support'), 'See it in GEM'),
      ].join(''),
    }),
  }, gym);
  return 1;
}

// A message from GEM to a gym's owners
function sendAnnouncement(gym, title, body) {
  return toOwners(gym, (owner) => ({
    subject: title,
    html: E.layout({
      brand: E.gemBrand, preheader: String(body).slice(0, 110), eyebrow: 'From GEM', title,
      body: [E.greeting(owner.firstName), ...String(body).split(/\n\s*\n/).map(b => E.pHtml(E.esc(b.trim()).replace(/\n/g, '<br>')))].join(''),
    }),
  }));
}

// To GEM: someone asked for a demo, or a month's bills are ready to check
const adminAddress = () => String(process.env.ADMIN_EMAIL || '').trim() || supportEmail();
async function toAdmin(subject, title, body) {
  try {
    await deliver(getResend(), { from: E.sender(null), to: adminAddress(), subject, html: E.layout({ brand: E.gemBrand, preheader: subject, eyebrow: 'GEM admin', title, body }) });
    return true;
  } catch (err) {
    console.error(`Admin email "${subject}" could not be sent:`, err.message);
    return false;
  }
}

function sendLeadAlert(lead) {
  return toAdmin(`New lead: ${lead.gymName}`, lead.gymName, [
    E.p(`${lead.name} asked about GEM for ${lead.gymName}.`),
    E.details([['Name', lead.name], ['Gym', lead.gymName], ['Email', lead.email], ['Phone', lead.phone], ['City', [lead.city, lead.country].filter(Boolean).join(', ')], ['Members', lead.members != null ? String(lead.members) : null]]),
    lead.message ? E.note(E.esc(lead.message).replace(/\r?\n/g, '<br>'), 'grey') : '',
    E.button(appUrl('/admin/leads'), 'Open the leads'),
  ].join(''));
}

function sendBillsReady(period, count) {
  return toAdmin(`${count} GEM bill${count === 1 ? '' : 's'} ready for ${monthName(period)}`, `Bills for ${monthName(period)}`, [
    E.p(`${count} draft bill${count === 1 ? ' is' : 's are'} ready. Check the figures, then send them to the gyms.`),
    E.button(appUrl(`/admin/billing?period=${period}`), 'Review the bills'),
  ].join(''));
}

module.exports = { monthName, sendBill, sendLockChange, sendSupportReply, sendAnnouncement, sendLeadAlert, sendBillsReady };
