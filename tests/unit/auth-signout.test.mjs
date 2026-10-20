// F-105: signing out takes the gym's data out of the browser, so the next
// person at a shared desk computer cannot read the last account's lists.
import { describe, it, expect, beforeEach } from 'vitest';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}
globalThis.localStorage = new MemoryStorage();
const { clearAuth } = await import('../../gem-frontend/src/utils/auth.js');

const GYM = 'cmgym0001abc';
const signedIn = () => localStorage.setItem('gem_auth', JSON.stringify({ token: 't', user: { id: 's1', gymId: GYM, role: 'general_manager' }, loginDate: '2026-10-19' }));

describe('clearAuth', () => {
  beforeEach(() => { localStorage.clear(); signedIn(); });

  it('removes every page cache of the gym', () => {
    const cached = [
      `gem_members_${GYM}_list`, `gem_staff_${GYM}_list`, `gem_payments_${GYM}_list`,
      `gem_accounting_${GYM}_expenses`, `gem_fd_${GYM}_members`, `gem_dash_${GYM}_members`,
      `gem_pkg_${GYM}_members`, `gem_pkg_${GYM}_packages`,
    ];
    cached.forEach(k => localStorage.setItem(k, '[{"phone":"677000000"}]'));
    clearAuth();
    expect(cached.filter(k => localStorage.getItem(k) !== null)).toEqual([]);
    expect(localStorage.getItem('gem_auth')).toBeNull();
  });

  it('removes the old unscoped copy of desk expenses', () => {
    localStorage.setItem('gem_expenses', '[{"title":"Water"}]');
    clearAuth();
    expect(localStorage.getItem('gem_expenses')).toBeNull();
  });

  it('keeps what only this browser holds and per-browser preferences', () => {
    const kept = {
      gem_member_notes_m1: '[{"content":"Knee injury"}]',
      'gem-lang': 'fr',
      'gem-theme': 'light',
      gem_tour_seen: '1',
      gem_dismiss_freeze_membership: '1',
    };
    Object.entries(kept).forEach(([k, v]) => localStorage.setItem(k, v));
    clearAuth();
    Object.entries(kept).forEach(([k, v]) => expect(localStorage.getItem(k)).toBe(v));
  });
});
