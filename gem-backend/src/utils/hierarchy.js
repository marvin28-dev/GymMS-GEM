// Who may act on whom.
//
// One ladder, used everywhere, so the rules live in one place instead of being
// re-invented per controller. The principle throughout: you may act on someone
// BELOW you, never on a peer and never on someone above you. Your own record is
// yours for contact details only - anything that affects your standing (role,
// department, active status, pay, rota) needs someone more senior.
//
// The owner is the exception at the top: there is nobody above him, so his own
// record is his to manage.

const RANK = {
  general_manager: 3,
  manager: 2,
  front_desk: 1,
  trainer: 1,
  other: 1,
  // Older accounts, kept so their records still read
  instructor: 1,
  coach: 1,
};

const rankOf = (role) => RANK[role] ?? 0;

const isOwner = (role) => role === 'general_manager';
const isManagement = (role) => rankOf(role) >= RANK.manager;

// Fields someone may change on their own record without anyone's say-so: how
// to reach them, and the picture they show. Their name is not among them -
// what a record is called is settled by someone more senior. Nor is their
// photo ID: an identity document is filed by the person who checked it, not by
// the person it belongs to. The owner is exempt, as he is for everything.
const SELF_EDITABLE = new Set([
  'email', 'phone',
  'houseNumber', 'street', 'city', 'region', 'postalCode', 'country',
  'photo', 'avatarColor',
  'emergencyContact', 'emergencyPhone',
]);

// Fields that decide someone's standing or pay. Changing these on your own
// record needs a more senior person, because nobody should be able to promote
// themselves, unlock their own pay, or write their own hours.
const PRIVILEGED = new Set([
  'role', 'department', 'isActive', 'salary', 'payDay',
  'employmentType', 'schedule', 'scheduleOverrides',
  'joinDate', 'shiftStart', 'staffNotes', 'accessCode', 'password',
]);

// Can `actor` open this person's profile at all? A colleague's name, role,
// schedule and contact details are fine for anyone at the gym to see - the
// same basic read the staff list already gives everyone. What is withheld is
// decided per field, in refuseFields and canSeePrivateFields below, not by
// blocking the page outright.
function canView(_actor, _target) {
  return true;
}

// Can `actor` see this person's pay, private notes and emergency contact?
// Someone above you is not yours to inspect that closely; a peer or someone
// below you is not either - only someone who outranks them, or themselves.
function canSeePrivateFields(actor, target) {
  if (String(actor.id) === String(target.id)) return true;
  if (!isManagement(actor.role)) return false;
  return rankOf(actor.role) > rankOf(target.role);
}

// Can `actor` act on this person at all (edit, deactivate, reveal a code)?
function canManage(actor, target) {
  if (!isManagement(actor.role)) return false;
  if (String(actor.id) === String(target.id)) return isOwner(actor.role);
  return rankOf(actor.role) > rankOf(target.role);
}

// Which of the requested fields is this person not allowed to change, and why.
// Returns null when the whole change is permitted.
function refuseFields(actor, target, fields) {
  const self = String(actor.id) === String(target.id);
  const outranks = rankOf(actor.role) > rankOf(target.role);

  for (const field of fields) {
    // Pay is the owner's alone. A manager runs the people who work here; he
    // does not decide what any of them is paid, himself included.
    if (field === 'salary' && !isOwner(actor.role)) {
      return 'Only the general manager can change pay.';
    }
    if (self && SELF_EDITABLE.has(field)) continue;

    if (self) {
      // The owner answers to nobody, so his own record is his to manage
      if (isOwner(actor.role)) continue;
      // Everything outside the short list above belongs to someone senior,
      // not only the fields that decide pay and standing.
      return `You cannot change your own ${label(field)}. A more senior manager has to do it.`;
    }

    if (!isManagement(actor.role)) {
      return 'Only a manager can change a staff record.';
    }
    if (!outranks) {
      return rankOf(actor.role) === rankOf(target.role)
        ? 'You cannot change the record of someone at your own level.'
        : 'You cannot change the record of someone more senior than you.';
    }
  }
  return null;
}

// Can `actor` create an account with this role? You cannot hire your own equal
// or your own boss.
function canCreateRole(actor, role) {
  if (!isManagement(actor.role)) return false;
  return rankOf(actor.role) > rankOf(role);
}

const LABELS = {
  role: 'role',
  department: 'department',
  isActive: 'account status',
  salary: 'salary',
  payDay: 'pay day',
  employmentType: 'employment type',
  schedule: 'schedule',
  scheduleOverrides: 'schedule',
  joinDate: 'join date',
  shiftStart: 'shift',
  staffNotes: 'staff notes',
  accessCode: 'access code',
  password: 'password',
  firstName: 'name',
  lastName: 'name',
};
const label = (f) => LABELS[f] || f;

module.exports = {
  RANK, rankOf, isOwner, isManagement,
  canView, canSeePrivateFields, canManage, refuseFields, canCreateRole,
  SELF_EDITABLE, PRIVILEGED,
};
