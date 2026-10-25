const { Resend } = require('resend');
const { deliver } = require('./sendEmail');
const E = require('./emailLayout');

// What a new employee gets the moment their account is made: where to sign in,
// the gym's code, and what to do first. Never their 4-digit code - that is read
// to them in person, and it is what proves the account is being claimed by the
// right person when they choose a password.

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  return new Resend(process.env.RESEND_API_KEY);
}

function welcomeHtml({ staff, gym, loginUrl }) {
  const body = [
    E.greeting(staff.firstName),
    E.p(`An account has been made for you on GEM, the system ${gym.name} runs on. Here is how to get in.`),
    E.tiles([
      { label: 'Gym code', value: gym.code, mono: true },
      { label: 'Your email', value: staff.email },
    ]),
    E.button(loginUrl, 'Sign in to GEM'),
    `<div style="font-family:'Manrope','Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:800;color:#16161d;margin:0 0 12px;">Signing in the first time</div>`,
    E.steps([
      'Open the button above. It already knows your gym.',
      `Type your email and press <strong style="color:#16161d;">Continue</strong>.`,
      `As it is your first time, you are asked to <strong style="color:#16161d;">choose a password</strong> (at least 8 characters).`,
      `Enter the <strong style="color:#16161d;">4-digit code</strong> your manager reads out to you. It proves the account is yours.`,
      'From then on, the same screen asks for your password.',
    ]),
    E.note(`If it asks for a password instead of offering to create one, your account is already set up: use <strong style="color:#16161d;">Forgot password</strong> on that screen.`),
    E.small('Your 4-digit code is never sent by email; ask your manager for it. If you were not expecting this email, you can ignore it.'),
  ].join('');
  return E.layout({ brand: E.gymBrand(gym), gym, preheader: `Your account at ${gym.name} is ready. Gym code ${gym.code}.`, eyebrow: 'Your new account', title: `Welcome to ${gym.name}`, body });
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
      subject: `Your ${gym.name} account on GEM`,
      html: welcomeHtml({ staff, gym, loginUrl }),
    }, gym);
    return { sent: true };
  } catch (err) {
    console.error(`Welcome email to ${staff.email} failed:`, err.message);
    return { sent: false, why: err.message };
  }
}

module.exports = { sendWelcomeEmail, welcomeHtml };
