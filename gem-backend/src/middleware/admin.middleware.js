// GEM's own admin (the owner of GEM, not of any gym) signs in with the email
// and password set in the server's environment (ADMIN_EMAIL, ADMIN_PASSWORD).
// Their token is marked for the admin dashboard alone: gym routes refuse it,
// and this refuses a gym's.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { isRevoked } = require('./auth.middleware');

const AUDIENCE = 'gem-admin';
const adminEmail = () => String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const adminConfigured = () => !!adminEmail() && String(process.env.ADMIN_PASSWORD || '').length > 0;

// Compared in constant time, so the answer's speed gives nothing away
function sameSecret(given, expected) {
  const a = crypto.createHash('sha256').update(String(given ?? '')).digest();
  const b = crypto.createHash('sha256').update(String(expected ?? '')).digest();
  return crypto.timingSafeEqual(a, b);
}

const credentialsMatch = (email, password) => adminConfigured()
  && sameSecret(String(email || '').trim().toLowerCase(), adminEmail())
  && sameSecret(password, process.env.ADMIN_PASSWORD);

const signAdmin = () => jwt.sign({ admin: true, email: adminEmail() }, process.env.JWT_SECRET, { expiresIn: '8h', jwtid: crypto.randomUUID(), audience: AUDIENCE });

async function authenticateAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Sign in to the admin dashboard.' });
  let payload;
  try {
    payload = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET, { audience: AUDIENCE });
  } catch {
    return res.status(401).json({ error: 'Sign in to the admin dashboard again.' });
  }
  // A changed or removed admin address ends the sessions it opened
  if (!payload.admin || !adminConfigured() || payload.email !== adminEmail()) return res.status(401).json({ error: 'Sign in to the admin dashboard again.' });
  try {
    if (payload.jti && await isRevoked(payload.jti)) return res.status(401).json({ error: 'You signed out. Sign in again.' });
  } catch (err) {
    console.error('Admin token check failed:', err.message);
    return res.status(503).json({ error: 'Could not confirm your session. Try again.' });
  }
  req.admin = { email: payload.email, jti: payload.jti, exp: payload.exp };
  return next();
}

module.exports = { authenticateAdmin, credentialsMatch, signAdmin, adminConfigured, adminEmail };
