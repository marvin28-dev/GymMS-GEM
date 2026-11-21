const { Resend } = require('resend');
const prisma = require('./prisma');
const E = require('./emailLayout');
const { deliver } = require('./sendEmail');
const { newResetToken, hashResetToken } = require('./resetToken');
const { TEXT, textFor, languageOf } = require('./staffEmailText');

// Confirming the address someone signs in with (D-8): a new gym's owner, and
// anyone whose address changes. The link is what proves the address reaches
// them, so a password reset or a pay notice will too. Nothing is locked while
// it waits; the app shows a reminder until the link is used.
const CONFIRM_DAYS = 7;

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  return new Resend(process.env.RESEND_API_KEY);
}

// A new link, its hash kept on the account. Only the hash is stored, as for
// password links.
function newConfirmation() {
  const { token, hash } = newResetToken();
  return { token, data: { emailVerifyHash: hash, emailVerifyExpires: new Date(Date.now() + CONFIRM_DAYS * 86400000) } };
}

const confirmUrl = (token) => `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${encodeURIComponent(token)}`;

// The block a welcome email carries, and the whole email when an address changes
function confirmBlock(token, T = TEXT.en) {
  return [
    E.p(T.confirm.line),
    E.button(confirmUrl(token), T.confirm.button),
    E.small(T.confirm.valid(CONFIRM_DAYS)),
  ].join('');
}

// Never throws: the account and the change stand whether or not the email lands
async function sendConfirmation({ staff, gym, token }) {
  const lang = languageOf(staff), T = textFor(staff), C = T.confirm;
  try {
    await deliver(getResend(), {
      from: E.sender(gym?.name || null),
      to: staff.email,
      subject: C.subject,
      html: E.layout({
        lang, brand: gym ? E.gymBrand(gym) : E.gemBrand, ...(gym ? { gym } : {}),
        preheader: C.preheader,
        eyebrow: C.eyebrow, title: C.title,
        body: [E.greeting(staff.firstName, lang), confirmBlock(token, T)].join(''),
      }),
    }, gym);
    return { sent: true };
  } catch (err) {
    console.error('Email confirmation could not be sent:', err.message);
    return { sent: false };
  }
}

// Uses a link: the account it belongs to is confirmed and the link is spent
async function confirmByToken(token) {
  if (!token || typeof token !== 'string') return null;
  const staff = await prisma.staff.findFirst({
    where: { emailVerifyHash: hashResetToken(token), emailVerifyExpires: { gt: new Date() } },
    select: { id: true },
  });
  if (!staff) return null;
  return prisma.staff.update({
    where: { id: staff.id },
    data: { emailVerifiedAt: new Date(), emailVerifyHash: null, emailVerifyExpires: null },
    select: { id: true, email: true },
  });
}

module.exports = { newConfirmation, confirmBlock, sendConfirmation, confirmByToken };
