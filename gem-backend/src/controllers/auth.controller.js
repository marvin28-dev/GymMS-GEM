const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Resend } = require('resend');
const prisma = require('../utils/prisma');
const { currencyForCountry } = require('../utils/money');
const E = require('../utils/emailLayout');
const { logActivity, fullName } = require('../utils/activityLog');
const { DEACTIVATED } = require('../middleware/auth.middleware');
const { attemptCounter, refuseTooMany } = require('../utils/attempts');
const { bestEffort } = require('../utils/bestEffort');
const { newResetToken, hashResetToken } = require('../utils/resetToken');
const { isDemoGym, demoCode } = require('../utils/sendEmail');

const asActor = (s) => ({ id: s.id, name: fullName(s), role: s.role });
const MINUTE = 60 * 1000;
const MIN_PASSWORD = 6;

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  return new Resend(process.env.RESEND_API_KEY);
}

// The owner of a new gym is its first account, so no other code can clash
function generateAccessCode() {
  return String(crypto.randomInt(1000, 10000));
}

// Gym codes are stored in lower case and matched without regard to case or
// stray spaces, the way the public gym lookup already matched them
function findGym(code, select) {
  const value = String(code ?? '').trim();
  if (!value) return null;
  return prisma.gym.findFirst({ where: { code: { equals: value, mode: 'insensitive' } }, ...(select ? { select } : {}) });
}

// What can be tried, and how often. Each is counted per address (behind
// Railway's proxy that is the visitor's own; see TRUST_PROXY in app.js) and,
// where there is one, per account, so one person signing in is never stopped
// and a sweep is.
const registrations = attemptCounter({ max: 10, windowMs: 60 * MINUTE });
const loginMissesByAccount = attemptCounter({ max: 10, windowMs: 15 * MINUTE });
const loginMissesByAddress = attemptCounter({ max: 50, windowMs: 15 * MINUTE });
const resetsByAccount = attemptCounter({ max: 5, windowMs: 60 * MINUTE });
const resetsByAddress = attemptCounter({ max: 20, windowMs: 60 * MINUTE });
const managerMisses = attemptCounter({ max: 5, windowMs: 15 * MINUTE });

async function register(req, res) {
  const { gymName, location, phone, email: gymEmail, city, country, firstName, lastName, email, password, managerPhone } = req.body;
  const wait = registrations.lockedFor(req.ip);
  if (wait) return refuseTooMany(res, wait);

  if (!req.body.gymCode || !gymName || !firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'gymCode, gymName, firstName, lastName, email, and password are required' });
  }
  // The code goes into every sign-in address (/elite/login), so it keeps to
  // what the availability check already allowed
  const gymCode = String(req.body.gymCode).trim().toLowerCase();
  if (!/^[a-z0-9-]{2,40}$/.test(gymCode)) {
    return res.status(400).json({ error: 'A gym code uses lower-case letters, numbers and hyphens, 2 to 40 of them.', field: 'gymCode' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(400).json({ error: 'Enter a valid email address.', field: 'email' });
  }
  if (String(password).length < MIN_PASSWORD) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters.`, field: 'password' });
  }
  // A currency is a 3-letter code; anything else would break every price shown
  const named = /^[A-Za-z]{3}$/.test(String(req.body.currency || '')) ? String(req.body.currency).toUpperCase() : null;
  const currency = named || currencyForCountry(country);

  // The demo's code is the web app's demo screen, whether or not the demo exists here
  const existing = gymCode === demoCode() || await prisma.gym.findUnique({ where: { code: gymCode } });
  if (existing) return res.status(409).json({ error: 'Gym code already taken', field: 'gymCode' });

  const passwordHash = await bcrypt.hash(String(password), 10);

  let gym;
  try {
    gym = await prisma.gym.create({
      data: {
        code: gymCode,
        name: String(gymName).trim(),
        location,
        phone,
        email: gymEmail,
        city: city || null,
        country: country || null,
        // A gym is paid in its country's money unless the form names one
        ...(currency ? { currency } : {}),
        staff: {
          create: {
            firstName: String(firstName).trim(),
            lastName: String(lastName).trim(),
            email: String(email).trim(),
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
  } catch (err) {
    // Two sign-ups racing for one code: the database keeps the first
    if (err.code === 'P2002') return res.status(409).json({ error: 'Gym code already taken', field: 'gymCode' });
    throw err;
  }
  registrations.count(req.ip);

  // Setup notifications, best-effort: the gym exists whether they land or not
  bestEffort(prisma.notification.create({ data: { gymId: gym.id, title: 'Finish your gym setup', body: 'Configure your packages, payment rules, expense categories, and staff roles in Settings to get the most out of GEM.', type: 'system', audience: 'owner' } }), 'Setup notification');
  bestEffort(prisma.notification.create({ data: { gymId: gym.id, title: 'Complete your gym profile', body: 'Add your gym phone number, email, location, and branding details so everything looks professional.', type: 'system', audience: 'owner' } }), 'Profile notification');

  const owner = gym.staff[0];
  // Welcome email, best-effort for the same reason
  bestEffort(Promise.resolve().then(() => getResend().emails.send({
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
  })).then((sent) => { if (sent?.error) throw new Error(sent.error.message || 'refused'); }), 'New gym welcome email');

  logActivity(null, {
    gymId: gym.id, actor: asActor(owner),
    category: 'settings', action: 'gym.created', summary: `Created the gym ${gym.name}`,
  });

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

  const gym = await findGym(gymCode);
  if (!gym) return res.status(404).json({ error: 'Gym not found' });

  // Wrong passwords are counted for the account and for the address they come
  // from: guessing at one account, or at many from one place, is stopped
  const accountKey = `${gym.id}:${String(email).trim().toLowerCase()}`;
  const wait = Math.max(loginMissesByAccount.lockedFor(accountKey), loginMissesByAddress.lockedFor(req.ip));
  if (wait) return refuseTooMany(res, wait, `Too many wrong sign-ins. Try again in ${Math.ceil(wait / MINUTE)} minutes, or reset your password.`);
  const missed = () => { loginMissesByAccount.miss(accountKey); loginMissesByAddress.miss(req.ip); };

  const staff = await prisma.staff.findFirst({
    where: { gymId: gym.id, email: { equals: String(email).trim(), mode: 'insensitive' } },
    orderBy: { isActive: 'desc' },
  });
  if (!staff) {
    missed();
    logActivity(null, {
      gymId: gym.id, actor: null, category: 'security', action: 'auth.login_failed',
      summary: `Failed sign-in for ${String(email).slice(0, 120)}: no account with that email`,
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (staff.isActive && staff.mustSetPassword) {
    return res.status(409).json({ error: 'Choose a password for your new account first.', code: 'SET_PASSWORD' });
  }

  const valid = await bcrypt.compare(String(password), staff.passwordHash);
  if (!valid) {
    missed();
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

  loginMissesByAccount.clear(accountKey);
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
const statusLookups = attemptCounter({ max: 30, windowMs: 10 * MINUTE });

async function loginStatus(req, res) {
  const { gymCode, email } = req.body;
  if (!gymCode || !email) return res.json({ status: 'unknown', setPassword: false });

  const wait = statusLookups.lockedFor(req.ip);
  if (wait) {
    // Refusing to answer is safer than guessing; the sign-in form falls back to
    // asking for a password, which still works for anyone who has one.
    return refuseTooMany(res, wait, 'Too many lookups. Try again in a few minutes.');
  }
  statusLookups.count(req.ip);

  const gym = await findGym(gymCode, { id: true });
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
const setupMisses = attemptCounter({ max: 5, windowMs: 15 * MINUTE });

// A new employee's first sign-in. Nothing is emailed: the manager reads them
// the 4-digit code from their profile, and that code, with a password of their
// own choosing, is what claims the account. Knowing the email is not enough.
async function setFirstPassword(req, res) {
  const { gymCode, email, password } = req.body;
  const code = String(req.body.code ?? '').trim();
  if (!gymCode || !email || !password) return res.status(400).json({ error: 'Gym code, email and password are required.' });
  if (!/^\d{4}$/.test(code)) return res.status(400).json({ error: 'Enter the 4-digit code your manager gave you.' });
  if (String(password).length < MIN_PASSWORD) return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters.` });

  const gym = await findGym(gymCode);
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
  const wait = setupMisses.lockedFor(lockKey);
  if (wait) return refuseTooMany(res, wait, `Too many wrong codes. Try again in ${Math.ceil(wait / MINUTE)} minutes.`);
  if (!staff.accessCode || code !== String(staff.accessCode)) {
    setupMisses.miss(lockKey);
    logActivity(null, {
      gymId: gym.id, actor: asActor(staff), category: 'security', action: 'auth.setup_code_refused',
      summary: 'Wrong 4-digit code entered while trying to set up this account',
    });
    return res.status(401).json({ error: 'That code does not match. Ask your manager to read it to you again.' });
  }
  setupMisses.clear(lockKey);

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
  bestEffort(prisma.notification.create({
    data: {
      gymId: gym.id,
      title: 'New Staff Account Set Up',
      body: `${fullName(updated)} chose a password and signed in for the first time.`,
      type: 'system',
      link: `/staff/${updated.id}`,
      audience: 'managers',
      aboutStaffId: updated.id,
    },
  }), 'Account set up notification');

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
  // Wrong tries are counted for the account: anyone at a signed-in screen could
  // otherwise try all 10,000 codes.
  const triesKey = `${req.user.gymId}:${req.user.id}`;
  const wait = managerMisses.lockedFor(triesKey);
  if (wait) return refuseTooMany(res, wait, `Too many wrong tries. Try again in ${Math.ceil(wait / MINUTE)} minutes.`);

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
    if (valid) managerMisses.clear(triesKey); else managerMisses.miss(triesKey);
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
  if (valid) managerMisses.clear(triesKey); else managerMisses.miss(triesKey);
  logActivity(req, {
    category: 'authorization', action: valid ? 'auth.code_used' : 'auth.code_refused',
    summary: valid ? `Used their manager code to: ${purpose}` : `Entered a wrong manager code to: ${purpose}`,
  });
  res.json({ authorized: valid });
}

async function checkGymCode(req, res) {
  const code = (req.params.code || '').toLowerCase().trim();
  if (!code || !/^[a-z0-9-]+$/.test(code)) return res.json({ available: false });
  const existing = code === demoCode() || await prisma.gym.findUnique({ where: { code } });
  res.json({ available: !existing });
}

async function forgotPassword(req, res) {
  const { gymCode, email } = req.body;
  if (!gymCode || !email) return res.status(400).json({ error: 'gymCode and email are required' });

  // Every request may send an email, so they are limited for the account and
  // for the address asking: unlimited, they could flood someone's inbox
  const accountKey = `${String(gymCode).trim().toLowerCase()}:${String(email).trim().toLowerCase()}`;
  const wait = Math.max(resetsByAccount.lockedFor(accountKey), resetsByAddress.lockedFor(req.ip));
  if (wait) return refuseTooMany(res, wait, `Too many reset requests. Try again in ${Math.ceil(wait / MINUTE)} minutes.`);
  resetsByAccount.count(accountKey);
  resetsByAddress.count(req.ip);

  try {
    const gym = await findGym(gymCode);
    if (!gym) return res.status(404).json({ error: 'No account found with that email address.' });

    const staff = await prisma.staff.findFirst({ where: { gymId: gym.id, email: { equals: String(email).trim(), mode: 'insensitive' } } });
    if (!staff) return res.status(404).json({ error: 'No account found with that email address.' });
    if (!staff.isActive) return res.status(403).json(DEACTIVATED);
    logActivity(null, { gymId: gym.id, actor: asActor(staff), category: 'security', action: 'auth.reset_requested', summary: 'Asked for a password reset email' });

    const { token, hash } = newResetToken();
    const expiry = new Date(Date.now() + 15 * MINUTE);

    await prisma.staff.update({
      where: { id: staff.id },
      data: { resetToken: hash, resetTokenExpiry: expiry },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    if (isDemoGym(gym)) return res.status(400).json({ error: 'The demo gym sends no email. Its sign-in details are on its sign-in screen.' });
    const { error: sendError } = await getResend().emails.send({
      from: E.sender(gym.name),
      // The address on the account, not as it was typed (spaces and all)
      to: staff.email,
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
  if (String(password).length < MIN_PASSWORD) return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters` });

  const staff = await prisma.staff.findFirst({
    where: { resetToken: hashResetToken(token), resetTokenExpiry: { gt: new Date() } },
  });
  if (!staff) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  if (!staff.isActive) return res.status(403).json(DEACTIVATED);

  const passwordHash = await bcrypt.hash(String(password), 10);
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

  const staff = await prisma.staff.findFirst({ where: { resetToken: hashResetToken(token) } });

  if (!staff) return res.json({ valid: false, reason: 'replaced' });
  if (staff.resetTokenExpiry <= new Date()) return res.json({ valid: false, reason: 'expired' });

  res.json({ valid: true });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  if (String(newPassword).length < MIN_PASSWORD) return res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD} characters` });

  const staff = await prisma.staff.findUnique({ where: { id: req.user.id } });
  if (!staff) return res.status(404).json({ error: 'Staff not found' });

  // 400, not 401: the caller is authenticated, the supplied password is simply
  // wrong. A 401 here trips the client's session-expired handler and logs them out.
  const valid = await bcrypt.compare(String(currentPassword), staff.passwordHash);
  if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

  const passwordHash = await bcrypt.hash(String(newPassword), 10);
  await prisma.staff.update({ where: { id: req.user.id }, data: { passwordHash } });
  logActivity(req, { category: 'security', action: 'auth.password_changed', summary: 'Changed their password' });
  res.json({ message: 'Password changed successfully' });
}

module.exports = { register, login, me, verifyManager, checkGymCode, forgotPassword, resetPassword, verifyResetToken, changePassword, loginStatus, setFirstPassword };
