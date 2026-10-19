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
    select: { gymId: true, role: true, isActive: true, gym: { select: { currency: true } } },
  });
  accounts.set(id, { account, at: Date.now() });
  return account;
}

// Called whenever an account changes, so the next request sees it at once
function forgetAccount(id) {
  accounts.delete(String(id));
}

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

  let account;
  try {
    account = await currentAccount(payload.id);
  } catch (err) {
    console.error('Account check failed:', err.message);
    return res.status(503).json({ error: 'Could not confirm your account. Try again.' });
  }
  if (!account || account.gymId !== payload.gymId) {
    return res.status(401).json({ error: 'This account no longer exists.', code: 'ACCOUNT_GONE' });
  }
  if (!account.isActive) return res.status(401).json(DEACTIVATED);

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
const OTHER_MAY_REACH = ['/api/auth', '/api/staff', '/api/notifications', '/api/timecards', '/api/payroll', '/api/pay-adjustments'];

function confineOther(req, res, next) {
  if (req.user?.role !== 'other') return next();
  const path = req.baseUrl || req.originalUrl || '';
  if (OTHER_MAY_REACH.some(p => path.startsWith(p))) return next();
  return res.status(403).json({ error: 'Your account only opens your own profile.' });
}

module.exports = {
  confineOther, authenticate, requireRole, forgetAccount, DEACTIVATED };
