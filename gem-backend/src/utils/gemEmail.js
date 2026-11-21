// Emails GEM itself sends a gym's owner (not the gym to its members): bills,
// reminders, an account paused or reopened, an answer to a support report,
// announcements. On the shared layout, from "GEM", in each owner's own language
// (Staff.language). Each one is best-effort: what it reports already happened.
const { Resend } = require('resend');
const prisma = require('./prisma');
const E = require('./emailLayout');
const { deliver } = require('./sendEmail');
const { formatMoney } = require('./money');
const { supportEmail } = require('./support');
const { TEXT, textFor, languageOf } = require('./staffEmailText');

// "November 2026", "novembre 2026": a bill's month in the reader's language
const monthName = (period, lang = 'en') => {
  const [y, m] = String(period).split('-').map(Number);
  return m ? new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : String(period);
};
const appUrl = (path) => `${process.env.FRONTEND_URL || 'http://localhost:5173'}${path}`;

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  return new Resend(process.env.RESEND_API_KEY);
}

// The owners of a gym who can be written to, each in their own language
const ownersOf = async (gymId) => (await prisma.staff.findMany({
  where: { gymId, role: 'general_manager', isActive: true },
  select: { id: true, firstName: true, email: true, language: true },
})).filter(o => String(o.email || '').trim());

async function toOwners(gym, build) {
  const owners = await ownersOf(gym.id);
  const resend = owners.length ? getResend() : null;
  let sent = 0;
  for (const owner of owners) {
    try {
      const { subject, html } = build(owner, languageOf(owner), textFor(owner).gem);
      await deliver(resend, { from: E.sender(null), to: owner.email, replyTo: supportEmail(), subject, html }, gym);
      sent += 1;
    } catch (err) {
      console.error(`GEM email to ${gym.code} could not be sent:`, err.message);
    }
  }
  return sent;
}

// The bill's figures as rows
function billRows(inv, lang = 'en', B = TEXT.en.gem.bill) {
  const money = (n) => formatMoney(n, inv.currency);
  return [
    [B.month, monthName(inv.period, lang)],
    [B.members, String(inv.members)],
    [B.rate, money(inv.rate)],
    inv.billableDays < inv.daysInPeriod ? [B.days, B.daysOf(inv.billableDays, inv.daysInPeriod)] : null,
    inv.discount ? [B.discount, `-${money(inv.discount)}`] : null,
    inv.dueDate ? [B.dueBy, E.longDate(inv.dueDate, lang)] : null,
  ];
}

const howToPay = (settings, B = TEXT.en.gem.bill) => (settings.paymentInstructions
  ? E.note(`<strong>${E.esc(B.howToPay)}</strong><br>${E.esc(settings.paymentInstructions).replace(/\r?\n/g, '<br>')}`)
  : E.note(E.esc(B.replyToPay)));

// A bill sent, a reminder that it is due or overdue, or a thank-you once paid
function sendBill(gym, inv, settings, kind = 'sent') {
  const amount = formatMoney(kind === 'paid' ? (inv.paidAmount ?? inv.amount) : inv.amount, inv.currency);
  return toOwners(gym, (owner, lang, G) => {
    const B = G.bill, copy = B[kind], month = monthName(inv.period, lang);
    const line = copy.line(gym.name, month, amount);
    return {
      subject: copy.subject(month, amount),
      html: E.layout({
        lang, brand: E.gemBrand, preheader: line, eyebrow: copy.eyebrow, title: copy.title(month, amount),
        body: [
          E.greeting(owner.firstName, lang),
          E.p(line),
          E.highlight({ label: kind === 'paid' ? B.paidLabel : B.due, value: amount, tone: kind === 'paid' ? 'green' : kind === 'reminder' ? 'amber' : 'gold' }),
          E.details(billRows(inv, lang, B)),
          inv.note ? E.note(E.esc(inv.note), 'grey') : '',
          kind === 'paid' ? '' : howToPay(settings, B),
          E.button(appUrl('/settings?section=billing'), B.see),
        ].join(''),
      }),
    };
  });
}

// The account paused for an unpaid bill, or opened again
function sendLockChange(gym, locked, reason, settings) {
  return toOwners(gym, (owner, lang, G) => {
    const L = G.lock;
    return {
      subject: L.subject(gym.name, locked),
      html: E.layout({
        lang, brand: E.gemBrand, preheader: L.preheader(locked), eyebrow: L.eyebrow(locked), title: L.title(locked),
        body: [
          E.greeting(owner.firstName, lang),
          E.p(L.line(gym.name, locked)),
          locked && reason ? E.details([[L.why, reason]]) : '',
          locked ? howToPay(settings, G.bill) : '',
          E.button(appUrl(locked ? '/settings?section=billing' : '/dashboard'), locked ? L.seeDue : L.open),
        ].join(''),
      }),
    };
  });
}

// GEM support's answer to a report, in the language of whoever sent it
async function sendSupportReply(report, gym) {
  if (!report.senderEmail) return 0;
  const sender = report.staffId ? await prisma.staff.findUnique({ where: { id: report.staffId }, select: { language: true } }) : null;
  const lang = languageOf(sender), R = textFor(sender).gem.reply;
  await deliver(getResend(), {
    from: E.sender(null), to: report.senderEmail, replyTo: supportEmail(),
    subject: `Re: ${report.subject}`,
    html: E.layout({
      lang, brand: E.gemBrand, preheader: String(report.reply).slice(0, 110), eyebrow: R.eyebrow, title: report.subject,
      body: [
        E.greeting(String(report.senderName || '').split(' ')[0], lang),
        E.pHtml(E.esc(report.reply).replace(/\r?\n/g, '<br>')),
        E.details([[R.yourReport, report.subject], [R.status, report.status === 'resolved' ? R.resolved : R.inProgress]]),
        E.button(appUrl('/support'), R.see),
      ].join(''),
    }),
  }, gym);
  return 1;
}

// A message from GEM to a gym's owners: the words are GEM's own, the frame
// around them is in each owner's language
function sendAnnouncement(gym, title, body) {
  return toOwners(gym, (owner, lang, G) => ({
    subject: title,
    html: E.layout({
      lang, brand: E.gemBrand, preheader: String(body).slice(0, 110), eyebrow: G.fromGem, title,
      body: [E.greeting(owner.firstName, lang), ...String(body).split(/\n\s*\n/).map(b => E.pHtml(E.esc(b.trim()).replace(/\n/g, '<br>')))].join(''),
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
