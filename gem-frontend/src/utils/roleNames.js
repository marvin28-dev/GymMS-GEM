// A staff role by its name in the reader's language, never the stored code
// (front_desk). Older records may hold a display name instead; both resolve.
const ROLE_KEYS = {
  general_manager: 'generalManager', 'General Manager': 'generalManager',
  manager: 'manager', 'Manager': 'manager',
  trainer: 'trainer', 'Trainer': 'trainer',
  instructor: 'instructor', 'Instructor': 'instructor',
  front_desk: 'frontDesk', 'Front Desk': 'frontDesk',
  coach: 'coach', 'Coach': 'coach',
  other: 'roleOther', 'Other': 'roleOther',
  accountant: 'accountant',
};

export function roleName(role, t) {
  const key = ROLE_KEYS[role];
  return key ? t(`staff.${key}`) : (role || '');
}
