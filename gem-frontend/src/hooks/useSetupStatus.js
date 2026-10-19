import { useEffect, useState } from 'react';
import { getSetupStatus } from '../services/gym.service';
import { getAuth, getRole } from '../utils/auth';
import { DATA_CHANGED } from '../utils/events';

// How far the owner is through setting the gym up. The server holds it, so a
// second browser or a phone shows the same list as the first. Every screen
// that shows a part of the list reads it from here, and it refreshes itself
// after any change is saved and whenever the window comes back into view.

let cache = { key: null, status: null };
let inflight = null;
const listeners = new Set();

const accountKey = () => {
  const u = getAuth()?.user;
  return u ? `${u.gymId}:${u.id}` : null;
};

function publish(status) {
  cache = { key: accountKey(), status };
  listeners.forEach(fn => fn(status));
}

export function refreshSetupStatus() {
  if (getRole() !== 'general_manager') return Promise.resolve(null);
  if (inflight) return inflight;
  inflight = getSetupStatus()
    .then(res => { publish(res.data || null); return res.data || null; })
    .catch(() => cache.status)
    .finally(() => { inflight = null; });
  return inflight;
}

// A confirmation from Settings comes back with the new status, so it is used
// straight away rather than asked for again.
export function setSetupStatus(status) {
  if (status) publish(status);
}

export function useSetupStatus() {
  const isOwner = getRole() === 'general_manager';
  const key = accountKey();
  const [status, setStatus] = useState(() => (isOwner && cache.key === key ? cache.status : null));

  useEffect(() => {
    if (!isOwner) return undefined;
    listeners.add(setStatus);
    refreshSetupStatus();
    const refresh = () => refreshSetupStatus();
    window.addEventListener(DATA_CHANGED, refresh);
    window.addEventListener('focus', refresh);
    return () => {
      listeners.delete(setStatus);
      window.removeEventListener(DATA_CHANGED, refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [isOwner, key]);

  return isOwner ? status : null;
}
