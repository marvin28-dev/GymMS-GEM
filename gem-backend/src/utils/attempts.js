// Wrong guesses at something short, like a 4-digit code, counted per key in
// the server's memory. Once a key has `max` misses inside the window it is
// refused until the window ends. A right guess does not wipe the count when the
// key is the person guessing: knowing one good code must not buy more tries.
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

  return {
    // Milliseconds until this key may try again; 0 when it may try now
    lockedFor(key) {
      const entry = live(key);
      return entry && entry.count >= max ? entry.until - Date.now() : 0;
    },
    miss(key) {
      const entry = live(key) || { count: 0, until: Date.now() + windowMs };
      entry.count += 1;
      entries.set(key, entry);
    },
    clear(key) { entries.delete(key); },
  };
}

module.exports = { attemptCounter };
