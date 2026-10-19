// A task is given to one person, to everyone who does a particular job, or to
// a whole department (management, spanning both the owner and the managers).
export const ASSIGNABLE_ROLES = ['manager', 'front_desk', 'trainer'];
export const GROUP_ROLES = { management: ['general_manager', 'manager'] };

// A task form holds one value for "assign to": a department reads
// 'group:management', a job reads 'role:trainer', anything else is a staff id.
export const ROLE_PREFIX = 'role:';
export const GROUP_PREFIX = 'group:';
export const roleOf = (value) => (String(value || '').startsWith(ROLE_PREFIX) ? String(value).slice(ROLE_PREFIX.length) : null);
export const groupOf = (value) => (String(value || '').startsWith(GROUP_PREFIX) ? String(value).slice(GROUP_PREFIX.length) : null);
export const assignValue = (task) => (
  task?.assignedGroup ? GROUP_PREFIX + task.assignedGroup
    : task?.assignedRole ? ROLE_PREFIX + task.assignedRole
    : (task?.assignedToId || '')
);

// What a task form sends: a department, a job, or a person - never more than one
export function assignFields(value) {
  const group = groupOf(value);
  if (group) return { assignedGroup: group, assignedRole: null, assignedToId: undefined };
  const role = roleOf(value);
  if (role) return { assignedRole: role, assignedGroup: null, assignedToId: undefined };
  return { assignedRole: null, assignedGroup: null, assignedToId: value || undefined };
}

// Older accounts still carry these, and they do a trainer's job
const SAME_JOB = { instructor: 'trainer', coach: 'trainer' };
export const jobOf = (role) => SAME_JOB[role] || role;

// A department is a shelf a task can sit on: everyone who works in it, and the
// value that means "everyone" rather than one of them by name. "Other" has no
// such value - a cleaner or a technician is only ever picked by name.
export const DEPARTMENTS = [
  { id: 'management', labelKey: 'tasks.deptManagement', roles: ['general_manager', 'manager'], everyoneValue: GROUP_PREFIX + 'management' },
  { id: 'trainer',     labelKey: 'tasks.deptTraining',   roles: ['trainer', 'instructor', 'coach'], everyoneValue: ROLE_PREFIX + 'trainer' },
  { id: 'front_desk',  labelKey: 'tasks.deptFrontDesk',  roles: ['front_desk'], everyoneValue: ROLE_PREFIX + 'front_desk' },
  { id: 'other',       labelKey: 'tasks.deptOther',      roles: ['other'], everyoneValue: null },
];

export const departmentOfRole = (role) => DEPARTMENTS.find(d => d.roles.includes(jobOf(role))) || null;

// Which department a task's current value belongs to, so a form editing an
// existing task opens with the right department already picked.
export function departmentOfValue(value, staffList) {
  const group = groupOf(value);
  if (group) return DEPARTMENTS.find(d => d.everyoneValue === GROUP_PREFIX + group) || null;
  const role = roleOf(value);
  if (role) return DEPARTMENTS.find(d => d.everyoneValue === ROLE_PREFIX + role) || null;
  if (value) {
    const staff = (staffList || []).find(s => s.id === value);
    if (staff) return departmentOfRole(staff.role);
  }
  return null;
}
