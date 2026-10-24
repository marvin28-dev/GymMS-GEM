// The same ladder the server enforces (gem-backend/src/utils/hierarchy.js), so
// the screens only offer what will actually be allowed. The server is still the
// authority: hiding a button here is a courtesy, not the protection.
//
// You act on people below you, never on a peer or a boss. Your own record is
// yours for contact details only; the owner, with nobody above him, is the
// exception.

export const RANK = {
  general_manager: 3,
  manager: 2,
  front_desk: 1,
  trainer: 1,
  other: 1,
  // Older accounts, kept so their records still read
  instructor: 1,
  coach: 1,
};

export const rankOf = (role) => RANK[role] ?? 0;
export const isOwner = (role) => role === 'general_manager';
export const isManagement = (role) => rankOf(role) >= RANK.manager;

const same = (a, b) => String(a ?? '') === String(b ?? '');

// Can this person open someone's profile at all? A colleague's name, role,
// schedule and contact details are an open book - everyone at the gym already
// sees that much on the staff list. What is withheld is decided per field, by
// canSeePrivateFields below, not by blocking the page.
export function canView(actor, target) {
  return !!actor && !!target;
}

// Can this person see someone's pay, private notes and emergency contact?
// Someone above you is not yours to inspect that closely; a peer or someone
// below you is not either - only someone who outranks them, or themselves.
export function canSeePrivateFields(actor, target) {
  if (!actor || !target) return false;
  if (same(actor.id, target.id)) return true;
  if (!isManagement(actor.role)) return false;
  return rankOf(actor.role) > rankOf(target.role);
}

// Can this person edit, deactivate, or reveal the code of someone?
export function canManage(actor, target) {
  if (!actor || !target || !isManagement(actor.role)) return false;
  if (same(actor.id, target.id)) return isOwner(actor.role);
  return rankOf(actor.role) > rankOf(target.role);
}

// Can this person change their own role, department, status, pay or rota?
// Only the owner - everyone else needs someone more senior.
export const canChangeOwnStanding = (role) => isOwner(role);

// Roles this person may give to someone: strictly below their own.
export function assignableRoles(role) {
  return Object.keys(RANK).filter(r => rankOf(r) < rankOf(role));
}
