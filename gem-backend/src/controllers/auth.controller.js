const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Resend } = require('resend');
const prisma = require('../utils/prisma');
const { currencyForCountry } = require('../utils/money');
const E = require('../utils/emailLayout');
const { logActivity, fullName } = require('../utils/activityLog');
const { DEACTIVATED } = require('../middleware/auth.middleware');

const asActor = (s) => ({ id: s.id, name: fullName(s), role: s.role });

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  return new Resend(process.env.RESEND_API_KEY);
}

function generateAccessCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function register(req, res) {
  const { gymCode, gymName, location, phone, email: gymEmail, city, country, currency, firstName, lastName, email, password, managerPhone } = req.body;
  if (!gymCode || !gymName || !firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'gymCode, gymName, firstName, lastName, email, and password are required' });
  }

  const existing = await prisma.gym.findUnique({ where: { code: gymCode.toLowerCase() } });
  if (existing) return res.status(409).json({ error: 'Gym code already taken' });

  const passwordHash = await bcrypt.hash(password, 10);

  const gym = await prisma.gym.create({
    data: {
      code: gymCode.toLowerCase(),
      name: gymName,
      location,
      phone,
      email: gymEmail,
      city: city || null,
      country: country || null,
      // A gym is paid in its country's money unless the form names one
      ...((currency || currencyForCountry(country)) ? { currency: currency || currencyForCountry(country) } : {}),
      staff: {
        create: {
          firstName,
          lastName,
          email,
          phone: managerPhone || null,
          department: 'Management',
          // The owner joins the moment the gym is created
          joinDate: new Date(),
          passwordHash,
          role: 'general_manager',
          avatarColor: '#c9a96e',
          accessCode: generateAccessCode(),
        },
      },
    },
    include: { staff: true },
  });

  // Seed setup notifications - two individual creates, fully non-blocking
  try {
    prisma.notification.create({ data: { gymId: gym.id, title: 'Finish your gym setup', body: 'Configure your packages, payment rules, expense categories, and staff roles in Settings to get the most out of GEM.', type: 'system', audience: 'owner' } }).catch(() => {});
    prisma.notification.create({ data: { gymId: gym.id, title: 'Complete your gym profile', body: 'Add your gym phone number, email, location, and branding details so everything looks professional.', type: 'system', audience: 'owner' } }).catch(() => {});
  } catch (_) {}

  // Welcome email - fully non-blocking
  try {
    const owner = gym.staff[0];
    getResend().emails.send({
      from: E.sender(null),
      to: owner.email,
      subject: `Welcome to GEM, ${owner.firstName}! Your gym is ready.`,
      html: E.layout({
        brand: E.gemBrand, preheader: `${gym.name} is live on GEM. Your gym code is ${gym.code}.`, eyebrow: 'Your gym is ready', title: `Welcome, ${owner.firstName}`,
        body: [
          E.pHtml(`Your gym ${E.strong(gym.name)} is live on GEM. Keep these details somewhere safe.`),
          E.tiles([{ label: 'Gym code', value: gym.code, mono: true }, { label: 'Your role', value: 'General Manager' }]),
          E.details([['Sign-in email', owner.email]]),
          E.button(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/${encodeURIComponent(gym.code)}/login`, 'Open your gym'),
          '<div style="font-family:Manrope,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;font-weight:800;color:#16161d;margin:0 0 12px;">Next steps</div>',
          E.steps(['Add your packages and prices in Settings.', 'Choose the payment methods you accept.', 'Add your staff. Each one gets an email with how to sign in.']),
          E.small("If you didn't create this account, you can ignore this email."),
        ].join(''),
      }),
    }).catch(() => {});
  } catch (_) {}

  logActivity(null, {
    gymId: gym.id, actor: asActor(gym.staff[0]),
    category: 'settings', action: 'gym.created', summary: `Created the gym ${gym.name}`,
  });

  const owner = gym.staff[0];
  const token = jwt.sign(
    { id: owner.id, gymId: gym.id, role: owner.role, email: owner.email },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.status(201).json({
    token,
    accessCode: owner.accessCode,
    user: {
      id: owner.id,
      firstName: owner.firstName,
      lastName: owner.lastName,
      email: owner.email,
      role: owner.role,
      gymId: gym.id,
      gymCode: gym.code,
      gymName: gym.name,
      gymCountry: gym.country || null,
      gymCity: gym.city || null,
      gymCurrency: gym.currency || null,
    },
  });
}

async function login(req, res) {
  const { gymCode, email, password } = req.body;
  if (!gymCode || !email || !password) {
    return res.status(400).json({ error: 'gymCode, email and password are required' });
  }

  const gym = await prisma.gym.findUnique({ where: { code: gymCode } });
  if (!gym) return res.status(404).json({ error: 'Gym not found' });

  const staff = await prisma.staff.findFirst({
    where: { gymId: gym.id, email: { equals: String(email || '').trim(), mode: 'insensitive' } },
    orderBy: { isActive: 'desc' },
  });
  if (!staff) {
    logActivity(null, {
      gymId: gym.id, actor: null, category: 'security', action: 'auth.login_failed',
      summary: `Failed sign-in for ${String(email).slice(0, 120)}: no account with that email`,
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (staff.isActive && staff.mustSetPassword) {
    return res.status(409).json({ error: 'Choose a password for your new account first.', code: 'SET_PASSWORD' });
  }

  const valid = await bcrypt.compare(password, staff.passwordHash);
  if (!valid) {
    logActivity(null, {
      gymId: gym.id, actor: asActor(staff), category: 'security', action: 'auth.login_failed',
      summary: 'Failed sign-in: wrong password',
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (!staff.isActive) {
    logActivity(null, {
      gymId: gym.id, actor: asActor(staff), category: 'security', action: 'auth.login_blocked',
      summary: 'Tried to sign in while their account is deactivated',
    });
    return res.status(403).json(DEACTIVATED);
  }

  logActivity(null, { gymId: gym.id, actor: asActor(staff), category: 'security', action: 'auth.login', summary: 'Signed in' });
  res.json(openSession(staff, gym));
}

// Signs someone in: the token and who they are. A part-time front desk
// employee's shift is not started here: the desk asks them, and they choose.
function openSession(staff, gym) {
  const token = jwt.sign(
    { id: staff.id, gymId: gym.id, role: staff.role, email: staff.email },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
  return {
    token,
    user: {
      id: staff.id,
      firstName: staff.firstName,
      lastName: staff.lastName,
      email: staff.email,
      role: staff.role,
      department: staff.department || null,
      gymId: gym.id,
      gymCode: gym.code,
      gymName: gym.name,
      // Where the gym is, so the forms can suggest an address and a phone
      // number that look like the ones people there actually write.
      gymCountry: gym.country || null,
      gymCity: gym.city || null,
      gymCurrency: gym.currency || null,
    },
  };
}

// Whether an email belongs to a new account still waiting for its first
// password, so the sign-in page can ask for one. Anything else, unknown emails
// included, gets the ordinary password field.
// Asking about an email is how the sign-in page decides what to show next, so
// it answers whether the account exists. That is worth saying plainly to
// somebody typing their own address, but it would also let a stranger holding
// the gym code read off which addresses belong to the gym. Lookups are counted
// per caller, so one person signing in is fine and a sweep is not.
const STATUS_TRIES = 30;
const STATUS_WINDOW_MS = 10 * 60 * 1000;
const statusHits = new Map();
function statusAllowed(key) {
  const now = Date.now();
  const entry = statusHits.get(key);
  if (!entry || now > entry.resetAt) {
    statusHits.set(key, { count: 1, resetAt: now + STATUS_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= STATUS_TRIES;
}
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of statusHits) if (now > entry.resetAt) statusHits.delete(key);
}, STATUS_WINDOW_MS).unref?.();

async function loginStatus(req, res) {
  const { gymCode, email } = req.body || {};
  if (!gymCode || !email) return res.json({ status: 'unknown', setPassword: false });

  if (!statusAllowed(req.ip || 'anon')) {
    // Refusing to answer is safer than guessing; the sign-in form falls back to
    // asking for a password, which still works for anyone who has one.
    return res.status(429).json({ error: 'Too many lookups. Try again in a few minutes.' });
  }

  const gym = await prisma.gym.findUnique({ where: { code: String(gymCode) }, select: { id: true } });
  if (!gym) return res.json({ status: 'unknown', setPassword: false });
  const staff = await prisma.staff.findFirst({
    where: { gymId: gym.id, email: { equals: String(email).trim(), mode: 'insensitive' } },
    orderBy: { isActive: 'desc' },
    select: { mustSetPassword: true, isActive: true },
  });
  // A deactivated account is not told apart from one that never existed: the
  // person is not getting in either way, and saying so would confirm they work here.
  if (!staff || !staff.isActive) return res.json({ status: 'unknown', setPassword: false });
  const status = staff.mustSetPassword ? 'new' : 'existing';
  res.json({ status, setPassword: status === 'new' });
}

// Guessing a 4-digit code is cheap, so wrong tries are counted per account
const CODE_TRIES = 5;
const CODE_LOCK_MS = 15 * 60 * 1000;
const setupMisses = new Map();
function setupLockedFor(key) {
  const entry = setupMisses.get(key);
  if (!entry?.until) return 0;
  if (entry.until > Date.now()) return entry.until - Date.now();
  setupMisses.delete(key);
  return 0;
}
function setupMiss(key) {
  const entry = setupMisses.get(key) || { count: 0, until: 0 };
  entry.count += 1;
  if (entry.count >= CODE_TRIES) { entry.until = Date.now() + CODE_LOCK_MS; entry.count = 0; }
  setupMisses.set(key, entry);
}

// A new employee's first sign-in. Nothing is emailed: the manager reads them
// the 4-digit code from their profile, and that code, with a password of their
// own choosing, is what claims the account. Knowing the email is not enough.
async function setFirstPassword(req, res) {
  const { gymCode, email, password } = req.body || {};
  const code = String(req.body?.code ?? '').trim();
  if (!gymCode || !email || !password) return res.status(400).json({ error: 'Gym code, email and password are required.' });
  if (!/^\d{4}$/.test(code)) return res.status(400).json({ error: 'Enter the 4-digit code your manager gave you.' });
  if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const gym = await prisma.gym.findUnique({ where: { code: String(gymCode) } });
  if (!gym) return res.status(404).json({ error: 'Gym not found' });
  const staff = await prisma.staff.findFirst({
    where: { gymId: gym.id, email: { equals: String(email).trim(), mode: 'insensitive' } },
    orderBy: { isActive: 'desc' },
  });
  if (staff && !staff.isActive) return res.status(403).json(DEACTIVATED);
  if (!staff || !staff.mustSetPassword) {
    return res.status(409).json({ error: 'This account already has a password. Sign in with it, or ask your manager for a password reset link.' });
  }

  const lockKey = `${gym.id}:${staff.id}`;
  const wait = setupLockedFor(lockKey);
  if (wait) {
    return res.status(429).json({ error: `Too many wrong codes. Try again in ${Math.ceil(wait / 60000)} minutes.` });
  }
  if (!staff.accessCode || code !== String(staff.accessCode)) {
    setupMiss(lockKey);
    logActivity(null, {
      gymId: gym.id, actor: asActor(staff), category: 'security', action: 'auth.setup_code_refused',
      summary: 'Wrong 4-digit code entered while trying to set up this account',
    });
    return res.status(401).json({ error: 'That code does not match. Ask your manager to read it to you again.' });
  }
  setupMisses.delete(lockKey);

  const passwordHash = await bcrypt.hash(String(password), 10);
  const updated = await prisma.staff.update({
    where: { id: staff.id },
    data: { passwordHash, mustSetPassword: false, resetToken: null, resetTokenExpiry: null },
  });

  logActivity(null, {
    gymId: gym.id, actor: asActor(updated), category: 'security', action: 'auth.password_first_set',
    summary: 'Set their password and signed in for the first time',
  });
  // Management hears about it, so a stranger claiming a new account is noticed
  prisma.notification.create({
    data: {
      gymId: gym.id,
      title: 'New Staff Account Set Up',
      body: `${fullName(updated)} chose a password and signed in for the first time.`,
      type: 'system',
      link: `/staff/${updated.id}`,
      audience: 'managers',
      aboutStaffId: updated.id,
    },
  }).catch(() => {});

  res.json(openSession(updated, gym));
}

async function me(req, res) {
  const staff = await prisma.staff.findUnique({
    where: { id: req.user.id },
    select: {
      id: true, firstName: true, lastName: true,
      email: true, role: true, department: true, gymId: true, avatarColor: true, photo: true,
      gym: { select: { code: true, name: true, country: true, city: true, currency: true } },
    },
  });
  if (!staff) return res.status(404).json({ error: 'User not found' });
  // Flattened the same way a sign-in reports it, so a session that refreshes
  // itself here ends up with the same gym details it signed in with.
  res.json({
    ...staff,
    gymCode: staff.gym?.code || null,
    gymName: staff.gym?.name || null,
    gymCountry: staff.gym?.country || null,
    gymCity: staff.gym?.city || null,
    gymCurrency: staff.gym?.currency || null,
  });
}

// Approving a sensitive action is done with the manager's own 4-digit code, and
// the comparison happens here rather than in the browser: handing the real code
// to the client so it can check for itself would give it away to anyone looking.
//
// Revealing an access code is the one exception. Gating that behind the very
// code being revealed is circular, so it asks for the account password instead.
async function verifyManager(req, res) {
  const password = req.body.password != null ? String(req.body.password) : null;
  const code = req.body.code != null ? String(req.body.code).trim() : null;
  if (!password && !code) {
    return res.status(400).json({ authorized: false, error: 'Access code required' });
  }

  // Anyone may confirm their own code: it proves the person at the keyboard is
  // whoever is signed in, nothing more. Whether the action itself is allowed is
  // settled by the endpoint that carries it out, against utils/hierarchy.js.

  const staff = await prisma.staff.findUnique({
    where: { id: req.user.id },
    select: { accessCode: true, passwordHash: true, isActive: true },
  });
  if (!staff) return res.status(404).json({ authorized: false });
  if (!staff.isActive) {
    return res.status(403).json({ authorized: false, error: 'This account is not active' });
  }

  // What the screen says the code is for. Only used to make the log readable.
  const purpose = String(req.body.purpose || '').trim().slice(0, 200) || 'an action';

  if (password) {
    const valid = await bcrypt.compare(password, staff.passwordHash);
    logActivity(req, {
      category: 'authorization', action: valid ? 'auth.password_confirmed' : 'auth.password_refused',
      summary: valid ? `Confirmed their password to: ${purpose}` : `Entered a wrong password to: ${purpose}`,
    });
    return res.json({ authorized: valid });
  }

  if (!staff.accessCode) {
    return res.status(409).json({ authorized: false, error: 'You have no access code set. Ask the owner to issue one.' });
  }
  const valid = code === String(staff.accessCode);
  logActivity(req, {
    category: 'authorization', action: valid ? 'auth.code_used' : 'auth.code_refused',
    summary: valid ? `Used their manager code to: ${purpose}` : `Entered a wrong manager code to: ${purpose}`,
  });
  res.json({ authorized: valid });
}

async function checkGymCode(req, res) {
  const code = (req.params.code || '').toLowerCase().trim();
  if (!code || !/^[a-z0-9-]+$/.test(code)) return res.json({ available: false });
  const existing = await prisma.gym.findUnique({ where: { code } });
  res.json({ available: !existing });
}

async function forgotPassword(req, res) {
  const { gymCode, email } = req.body;
  if (!gymCode || !email) return res.status(400).json({ error: 'gymCode and email are required' });

  try {
    const gym = await prisma.gym.findUnique({ where: { code: gymCode.toLowerCase() } });
    if (!gym) return res.status(404).json({ error: 'No account found with that email address.' });

    const staff = await prisma.staff.findFirst({ where: { gymId: gym.id, email: { equals: String(email).trim(), mode: 'insensitive' } } });
    if (!staff) return res.status(404).json({ error: 'No account found with that email address.' });
    if (!staff.isActive) return res.status(403).json(DEACTIVATED);
    logActivity(null, { gymId: gym.id, actor: asActor(staff), category: 'security', action: 'auth.reset_requested', summary: 'Asked for a password reset email' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.staff.update({
      where: { id: staff.id },
      data: { resetToken: token, resetTokenExpiry: expiry },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    const { error: sendError } = await getResend().emails.send({
      from: E.sender(gym.name),
      to: email,
      subject: 'Reset your GEM password',
      html: E.layout({
        brand: E.gymBrand(gym), gym, preheader: 'A link to choose a new password, valid for 15 minutes.', eyebrow: 'Password', title: 'Reset your password',
        body: [
          E.greeting(staff.firstName),
          E.pHtml(`We received a request to reset the password for your ${E.strong(gym.name)} account on GEM. Press the button to choose a new one.`),
          E.button(resetUrl, 'Reset password'),
          E.note('<strong style="color:#b4232a;">This link expires in 15 minutes.</strong> If you asked for another link after this one, only the newest works.', 'red'),
          E.small("If you didn't ask for this, you can ignore this email: your password stays as it is."),
        ].join(''),
      }),
    });

    if (sendError) {
      console.error('Resend send error:', sendError);
      return res.status(500).json({ error: 'Failed to send the reset email. Please try again or contact support.' });
    }

    return res.json({ message: 'Reset link sent.' });
  } catch (err) {
    console.error('forgotPassword error:', err.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

async function resetPassword(req, res) {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const staff = await prisma.staff.findFirst({
    where: { resetToken: token, resetTokenExpiry: { gt: new Date() } },
  });
  if (!staff) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  if (!staff.isActive) return res.status(403).json(DEACTIVATED);

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.staff.update({
    where: { id: staff.id },
    data: { passwordHash, mustSetPassword: false, resetToken: null, resetTokenExpiry: null },
  });

  logActivity(null, { gymId: staff.gymId, actor: asActor(staff), category: 'security', action: 'auth.password_reset', summary: 'Reset their password with an email link' });
  res.json({ message: 'Password updated successfully.' });
}

async function verifyResetToken(req, res) {
  const { token } = req.params;
  if (!token) return res.json({ valid: false, reason: 'missing' });

  const staff = await prisma.staff.findFirst({ where: { resetToken: token } });

  if (!staff) return res.json({ valid: false, reason: 'replaced' });
  if (staff.resetTokenExpiry <= new Date()) return res.json({ valid: false, reason: 'expired' });

  res.json({ valid: true });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

  const staff = await prisma.staff.findUnique({ where: { id: req.user.id } });
  if (!staff) return res.status(404).json({ error: 'Staff not found' });

  // 400, not 401: the caller is authenticated, the supplied password is simply
  // wrong. A 401 here trips the client's session-expired handler and logs them out.
  const valid = await bcrypt.compare(currentPassword, staff.passwordHash);
  if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.staff.update({ where: { id: req.user.id }, data: { passwordHash } });
  logActivity(req, { category: 'security', action: 'auth.password_changed', summary: 'Changed their password' });
  res.json({ message: 'Password changed successfully' });
}

module.exports = { register, login, me, verifyManager, checkGymCode, forgotPassword, resetPassword, verifyResetToken, changePassword, loginStatus, setFirstPassword };
