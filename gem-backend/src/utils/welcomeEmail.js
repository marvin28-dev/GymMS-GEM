const { Resend } = require('resend');
const { deliver } = require('./sendEmail');
const E = require('./emailLayout');
const { textFor, languageOf } = require('./staffEmailText');

// What a new employee gets the moment their account is made: where to sign in,
// the gym's code, and what to do first. Never their 4-digit code - that is read
// to them in person, and it is what proves the account is being claimed by the
// right person when they choose a password.

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  return new Resend(process.env.RESEND_API_KEY);
}

function welcomeHtml({ staff, gym, loginUrl }) {
  const lang = languageOf(staff), T = textFor(staff), W = T.welcome;
  const body = [
    E.greeting(staff.firstName, lang),
    E.p(W.line(gym.name)),
    E.tiles([
      { label: W.gymCode, value: gym.code, mono: true },
      { label: W.yourEmail, value: staff.email },
    ]),
    E.button(loginUrl, T.signInButton),
    `<div style="font-family:'Manrope','Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:800;color:#16161d;margin:0 0 12px;">${E.esc(W.firstTime)}</div>`,
    E.steps(W.steps),
    E.note(W.alreadySet),
    E.small(W.noCode),
  ].join('');
  return E.layout({ lang, brand: E.gymBrand(gym), gym, preheader: W.preheader(gym.name, gym.code), eyebrow: W.eyebrow, title: W.title(gym.name), body });
}

// Never throws: an employee's account is made whether or not the email lands.
async function sendWelcomeEmail({ staff, gym }) {
  if (!staff?.email) return { sent: false, why: 'no email address' };
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const loginUrl = `${frontendUrl}/${encodeURIComponent(gym.code)}/login`;
  try {
    await deliver(getResend(), {
      from: E.sender(gym.name),
      to: staff.email,
      subject: textFor(staff).welcome.subject(gym.name),
      html: welcomeHtml({ staff, gym, loginUrl }),
    }, gym);
    return { sent: true };
  } catch (err) {
    console.error(`Welcome email to ${staff.email} failed:`, err.message);
    return { sent: false, why: err.message };
  }
}

module.exports = { sendWelcomeEmail, welcomeHtml };
