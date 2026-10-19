const crypto = require('crypto');

// A password link carries a random token, and only a hash of it is stored: the
// database on its own never holds a link that works.
const hashResetToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

function newResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashResetToken(token) };
}

module.exports = { newResetToken, hashResetToken };
