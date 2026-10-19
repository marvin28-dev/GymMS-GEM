import { getAuth } from './auth';

// A per-gym, per-page corner of localStorage behind the "show the last data at
// once, then refresh quietly" behaviour. A list that fetches on every visit
// otherwise flashes a skeleton and then collapses to the real, often shorter,
// rows - which reads as flicker. Seeding the list's state from here means a
// page that has been open before appears already filled, and the fetch only
// swaps in changes. The Dashboard and Front Desk have done this by hand; this
// is the same thing in one place.
//
// Scoped to the gym on the session so two accounts on one browser never read
// each other's data. Every access is wrapped: storage can be full, blocked, or
// cleared, and a caching convenience must never take the page down with it.
export function gymCache(namespace) {
  const gymId = getAuth()?.user?.gymId || 'default';
  const keyOf = (k) => `gem_${namespace}_${gymId}_${k}`;
  return {
    read(key, fallback) {
      try {
        const v = JSON.parse(localStorage.getItem(keyOf(key)) || 'null');
        if (v == null) return fallback;
        // A stored value of the wrong shape (e.g. an array expected, but an
        // object left by an earlier bug) must never take the page down - fall
        // back when the kind doesn't match what the caller asked for.
        if (Array.isArray(fallback) && !Array.isArray(v)) return fallback;
        return v;
      } catch { return fallback; }
    },
    write(key, val) {
      try { localStorage.setItem(keyOf(key), JSON.stringify(val)); } catch {}
    },
    // Whether anything has ever been cached - drives whether a first visit
    // shows a skeleton or a return visit shows the last data straight away.
    has(key) {
      try { return localStorage.getItem(keyOf(key)) !== null; } catch { return false; }
    },
  };
}
