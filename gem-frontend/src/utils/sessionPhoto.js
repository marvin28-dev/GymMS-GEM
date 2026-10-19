import { useSyncExternalStore } from 'react';

// The signed-in person's own photo, for the chrome that shows it - the header
// avatar. It is not part of the stored session: a photo can be changed from
// another device, and the session is only written at sign-in. The regular
// account check refreshes it instead, and whatever is showing it follows.

let photo = null;
const listeners = new Set();

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const getSnapshot = () => photo;

export function setSessionPhoto(next) {
  const value = next || null;
  if (value === photo) return;
  photo = value;
  listeners.forEach(fn => fn());
}

export function useSessionPhoto() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function clearSessionPhoto() { setSessionPhoto(null); }
