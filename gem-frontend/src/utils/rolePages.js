// Which pages a role may open. This is the rule itself, not a setting: a gym
// cannot hand out extra pages from the settings screen, so a trainer is a
// trainer everywhere.
export const ALL_PAGES = ['dashboard', 'members', 'attendance', 'calendar', 'front-desk', 'tasks', 'sales', 'operations', 'payments', 'accounting', 'packages', 'communication', 'staff', 'settings'];

// A trainer's pages, shared by the older roles that do a trainer's job
const TRAINER_PAGES = ['dashboard', 'members', 'attendance', 'calendar', 'notifications', 'my-profile'];

export const ROLE_PAGES = [
  // null pages = unrestricted (owns everything)
  { id: 'general_manager', name: 'General Manager', color: '#c9a96e', pages: null },
  // Manager: same reach as the owner except gym settings, and prices are his to
  // read, not to set
  { id: 'manager',         name: 'Manager',         color: '#60a5fa', pages: ['dashboard', 'members', 'attendance', 'calendar', 'front-desk', 'tasks', 'sales', 'operations', 'payments', 'accounting', 'packages', 'communication', 'staff', 'notifications', 'my-profile'] },
  // Trainer: their schedule and the members they work with. No Tasks page:
  // their work is listed on their own profile, under Tasks Assigned.
  { id: 'trainer',         name: 'Trainer',         color: '#fb923c', pages: TRAINER_PAGES },
  // Front desk: the desk itself and the day to day, no money and no staff
  // records. A calendar of their own, same as a trainer's - their own diary,
  // plus whatever gym events they have been put on and accepted.
  { id: 'front_desk',      name: 'Front Desk',      color: '#f59e0b', pages: ['front-desk', 'members', 'attendance', 'calendar', 'tasks', 'sales', 'operations', 'notifications', 'my-profile'] },
  // Other: a cleaner, a technician. An account to be paid and clocked, nothing more.
  { id: 'other',           name: 'Other',           color: '#94a3b8', pages: ['my-profile', 'notifications'] },
  // Older accounts that were given these do a trainer's job
  { id: 'instructor',      name: 'Trainer',         color: '#818cf8', pages: TRAINER_PAGES },
  { id: 'coach',           name: 'Trainer',         color: '#a78bfa', pages: TRAINER_PAGES },
];

// A role this table does not know (an old "accountant" account, or none at
// all) gets its own record only. "No entry" used to read as the owner's
// "everything": every page was listed and each came up empty.
const UNKNOWN_ROLE = { id: 'unknown', name: 'Staff', color: '#94a3b8', pages: ['my-profile', 'notifications'] };
export const pagesFor = (role) => ROLE_PAGES.find(r => r.id === role) || UNKNOWN_ROLE;

// Trainers have no Tasks page and no say over the gym's money, so anything that
// would send them to either goes to their own profile instead.
export const FITNESS_ROLES = ['trainer', 'instructor', 'coach'];
export const isFitness = (role) => FITNESS_ROLES.includes(role);
export const TASKS_PATH = (role) => (isFitness(role) ? '/my-profile?tab=tasks' : '/tasks');

// Somebody whose only page is their own record has nothing to navigate to, so
// the sidebar, the drawer and the bottom bar are left out altogether rather
// than shown empty.
const NOT_NAVIGATION = ['my-profile', 'notifications'];
export function hasNavigation(role) {
  const pages = pagesFor(role)?.pages;
  if (!pages) return true; // the owner: everything
  return pages.some(p => !NOT_NAVIGATION.includes(p));
}
