import { useEffect, useState } from 'react';
import { getMyGym } from '../services/gym.service';
import { DATA_CHANGED } from '../utils/events';
import { PAYMENT_METHODS } from '../utils/paymentMethods';

// The gym's own settings - which payment methods it takes, what it notifies
// about, the front desk expense limit. They live on the gym record, so one
// fetch serves every screen and a change in Settings is felt everywhere.

const DEFAULTS = {
  // A gym that has not chosen yet takes every method, Mobile Money included
  payment: { methods: PAYMENT_METHODS.map(m => m.key), taxRate: '0', lateFee: '5', paymentDueDays: '30' },
  notifications: { expiryReminders: true, lowStockAlerts: true, taskOverdue: true, eodSummary: false, welcomeEmail: true },
  expenseLimit: 50000,
};

let cache = null;
let inFlight = null;
const listeners = new Set();
// Any save anywhere may have changed the settings. Mark the copy stale even
// when no screen using it is open (the Settings page itself does not), so the
// next screen to open fetches fresh instead of showing the old values.
let stale = false;
if (typeof window !== 'undefined') window.addEventListener(DATA_CHANGED, () => { stale = true; });

function merge(settings) {
  const s = settings || {};
  return {
    payment: { ...DEFAULTS.payment, ...(s.payment || {}), methods: s.payment?.methods?.length ? s.payment.methods : DEFAULTS.payment.methods },
    notifications: { ...DEFAULTS.notifications, ...(s.notifications || {}) },
    expenseLimit: s.expenseLimit > 0 ? s.expenseLimit : DEFAULTS.expenseLimit,
    // What freezing a membership costs, and how often it is charged again
    freeze: { fee: Math.max(0, Number(s.freeze?.fee) || 0), intervalDays: Math.max(0, Number(s.freeze?.intervalDays) || 0) },
    // null until the gym has saved its own list
    accessTypes: Array.isArray(s.accessTypes) ? s.accessTypes : null,
    productCategories: Array.isArray(s.productCategories) ? s.productCategories : null,
  };
}

// A list one browser kept before it moved to the gym. It is only the starting
// point until the gym saves its own, so nobody loses the names they had.
export function legacyList(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return Array.isArray(v) && v.length ? v : null;
  } catch { return null; }
}

function load(force) {
  if (cache && !force && !stale) return Promise.resolve(cache);
  if (inFlight) return inFlight;
  inFlight = getMyGym()
    .then(res => {
      stale = false;
      cache = merge(res.data?.settings);
      listeners.forEach(fn => fn(cache));
      return cache;
    })
    .catch(() => {
      // An unreachable server should not leave the forms with nothing to offer
      cache = cache || merge(null);
      return cache;
    })
    .finally(() => { inFlight = null; });
  return inFlight;
}

// Called after Settings saves, so open screens pick the change up
export function refreshGymSettings() { return load(true); }

export function useGymSettings() {
  const [settings, setSettings] = useState(() => cache || merge(null));
  useEffect(() => {
    let alive = true;
    const onChange = (next) => { if (alive) setSettings(next); };
    listeners.add(onChange);
    load(false).then(onChange);
    // Any write anywhere may have been a settings save
    const refetch = () => load(true);
    window.addEventListener(DATA_CHANGED, refetch);
    return () => { alive = false; listeners.delete(onChange); window.removeEventListener(DATA_CHANGED, refetch); };
  }, []);
  return settings;
}
