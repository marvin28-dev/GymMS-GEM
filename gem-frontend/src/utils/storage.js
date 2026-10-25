// Browser storage can refuse a read or a write: a private window, storage
// switched off, a full quota. What the app keeps there is a copy of what the
// server holds or a convenience for this browser, so a refusal means only that
// the copy is missing. Writes say whether they worked.

export function readStored(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function readStoredJson(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function store(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function storeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function storedKeys() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) keys.push(localStorage.key(i));
    return keys.filter(Boolean);
  } catch {
    return [];
  }
}

export function unstore(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
