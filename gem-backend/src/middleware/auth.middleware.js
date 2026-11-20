const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const { withCurrency } = require('../utils/money');

const DEACTIVATED = {
  error: 'Your account has been deactivated. Ask your manager to reactivate it.',
  code: 'ACCOUNT_DEACTIVATED',
};

// A token proves who someone was when they signed in, not that they may still
// work here. The account is read again on each request, so deactivating
// someone, or changing their role, applies to their very next request rather
// than when the token runs out 8 hours later. Held for a few seconds so the
// burst of requests behind one screen costs a single lookup.
const CACHE_MS = 5000;
const accounts = new Map();

async function currentAccount(id) {
  const hit = accounts.get(id);
  if (hit && hit.at > Date.now() - CACHE_MS) return hit.account;
  const account = await prisma.staff.findUnique({
    where: { id },
    select: { gymId: true, role: true, isActive: true, gym: { select: { currency: true, lockedAt: true } } },
  });
  accounts.set(id, { account, at: Date.now() });
  return account;
}

// A token signed out on the server (D-3). Revoked ones are remembered until
// they expire; a token found not revoked is believed for a few seconds, like
// the account, so one screen's burst of requests costs one lookup. Another
// server instance learns of a sign-out within those seconds.
const revoked = new Map();

function rememberRevoked(jti, expiresAt) {
  revoked.set(jti, { revoked: true, until: new Date(expiresAt).getTime() });
}

async function isRevoked(jti) {
  const now = Date.now();
  const hit = revoked.get(jti);
  if (hit && hit.until > now) return hit.revoked;
  if (revoked.size > 10000) {
    for (const [key, entry] of revoked) if (entry.until <= now) revoked.delete(key);
  }
  const row = await prisma.revokedToken.findUnique({ where: { jti }, select: { expiresAt: true } });
  revoked.set(jti, row ? { revoked: true, until: row.expiresAt.getTime() } : { revoked: false, until: now + CACHE_MS });
  return !!row;
}

const SIGNED_OUT = { error: 'You signed out on this session. Sign in again.', code: 'SIGNED_OUT' };

// Called whenever an account changes, so the next request sees it at once
function forgetAccount(id) {
  accounts.delete(String(id));
}

// The gym itself changed for everyone in it (paused or reopened by GEM)
function forgetGym(gymId) {
  for (const [id, hit] of accounts) if (hit.account?.gymId === gymId) accounts.delete(id);
}

// A gym GEM has paused (an unpaid bill) can still sign in, see what it owes,
// and write to GEM support; nothing else answers until it is reopened
const LOCKED = {
  error: 'This gym\'s GEM account is paused. The owner can see why in Settings, GEM billing.',
  code: 'GYM_LOCKED',
};
const LOCKED_MAY_REACH = ['/api/auth', '/api/live', '/api/billing', '/api/support'];

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  let payload;
  try {
    payload = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  // GEM's admin signs in apart from every gym; that token opens nothing here
  if (payload.admin || !payload.id) return res.status(401).json({ error: 'Invalid or expired token' });

  let account;
  try {
    if (payload.jti && await isRevoked(payload.jti)) return res.status(401).json(SIGNED_OUT);
    account = await currentAccount(payload.id);
  } catch (err) {
    console.error('Account check failed:', err.message);
    return res.status(503).json({ error: 'Could not confirm your account. Try again.' });
  }
  if (!account || account.gymId !== payload.gymId) {
    return res.status(401).json({ error: 'This account no longer exists.', code: 'ACCOUNT_GONE' });
  }
  if (!account.isActive) return res.status(401).json(DEACTIVATED);
  if (account.gym?.lockedAt) {
    const path = req.baseUrl || req.originalUrl || '';
    if (!LOCKED_MAY_REACH.some(p => path.startsWith(p))) return res.status(403).json(LOCKED);
  }

  req.user = { ...payload, role: account.role };
  return withCurrency(account.gym?.currency, () => confineOther(req, res, next));
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Your role does not allow this. Ask a manager.' });
    }
    next();
  };
}

// Somebody filed under "Other" - a cleaner, a technician - has an account so
// they can be paid, clocked and told things. The gym's members, money and
// records are not theirs to read, so only their own corner of the API answers.
const OTHER_MAY_REACH = ['/api/auth', '/api/live', '/api/staff', '/api/notifications', '/api/timecards', '/api/payroll', '/api/pay-adjustments', '/api/support'];

function confineOther(req, res, next) {
  if (req.user?.role !== 'other') return next();
  const path = req.baseUrl || req.originalUrl || '';
  if (OTHER_MAY_REACH.some(p => path.startsWith(p))) return next();
  return res.status(403).json({ error: 'Your account only opens your own profile.' });
}

module.exports = {
  confineOther, authenticate, requireRole, forgetAccount, forgetGym, rememberRevoked, isRevoked, DEACTIVATED, LOCKED };
