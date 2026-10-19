// Tries at something that can be guessed or abused (a 4-digit code, a password,
// a reset email), counted per key in the server's memory. Once a key has `max`
// inside the window it is refused until the window ends. A right guess does not
// wipe the count when the key is the person guessing: knowing one good code
// must not buy more tries.
function attemptCounter({ max, windowMs }) {
  const entries = new Map();

  const live = (key) => {
    const entry = entries.get(key);
    if (entry && entry.until <= Date.now()) {
      entries.delete(key);
      return null;
    }
    return entry || null;
  };

  const sweep = setInterval(() => { for (const key of entries.keys()) live(key); }, windowMs);
  sweep.unref?.();

  const add = (key) => {
    const entry = live(key) || { count: 0, until: Date.now() + windowMs };
    entry.count += 1;
    entries.set(key, entry);
  };

  return {
    // Milliseconds until this key may try again; 0 when it may try now
    lockedFor(key) {
      const entry = live(key);
      return entry && entry.count >= max ? entry.until - Date.now() : 0;
    },
    // A wrong guess
    miss: add,
    // Something that is limited whether it succeeds or not (an email sent, a gym made)
    count: add,
    clear(key) { entries.delete(key); },
  };
}

// The refusal for a key that has run out of tries. The code lets the screens
// say it in the user's own language.
function refuseTooMany(res, waitMs, message) {
  const minutes = Math.max(1, Math.ceil(waitMs / 60000));
  res.set('Retry-After', String(Math.ceil(waitMs / 1000)));
  return res.status(429).json({
    error: message || `Too many tries. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    code: 'TOO_MANY_TRIES',
    retryInMinutes: minutes,
  });
}

module.exports = { attemptCounter, refuseTooMany };
