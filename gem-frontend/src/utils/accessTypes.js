// What a package can give access to. Full Access is always offered and is
// everything, so a package that has it has no other. Every other type is the
// gym's own, added in Settings, Package Settings: a new gym starts with none
// (the owner asked on 30 October 2026; it used to start with six examples).
// The key is where an older browser kept the gym's list.
export const FULL_ACCESS = 'Full Access';
export const DEFAULT_ACCESS_TYPES = [];
export const ACCESS_TYPES_KEY = 'gem_access_types';

export const isFullAccess = (type) => String(type || '').trim().toLowerCase() === FULL_ACCESS.toLowerCase();

// The gym's own types: an older saved list may carry Full Access too
export const ownAccessTypes = (list) => (Array.isArray(list) ? list : []).filter(type => !isFullAccess(type));

// What the package form offers: Full Access, the gym's own, then any a package
// already has that the list no longer does, so editing it never drops one
export const accessOptions = (list, current = []) => {
  const own = ownAccessTypes(list);
  return [FULL_ACCESS, ...own, ...current.filter(type => !isFullAccess(type) && !own.includes(type))];
};

// A package's access as stored ("Full Access, Pool") in the reader's language
export const accessText = (stored, t) => String(stored || '')
  .split(',').map(s => s.trim()).filter(Boolean)
  .map(type => (isFullAccess(type) ? t('packages.fullAccess') : type))
  .join(', ');
