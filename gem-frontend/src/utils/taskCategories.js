// The kinds of work a gym actually raises tasks for. A fixed list keeps the
// data consistent, so tasks can be grouped and filtered later, which free text
// never allows.
export const TASK_CATEGORIES = [
  { value: 'Equipment Maintenance', labelKey: 'tasks.catEquipmentMaintenance', color: '#fbbf24' },
  { value: 'Front Desk',  labelKey: 'tasks.catFrontDesk',   color: '#60a5fa' },
  { value: 'Attendance',  labelKey: 'tasks.catAttendance',  color: '#38bdf8' },
  { value: 'Members',     labelKey: 'tasks.catMembers',     color: '#a78bfa' },
  { value: 'Stock',       labelKey: 'tasks.catStock',       color: '#22d3ee' },
  { value: 'Admin',       labelKey: 'tasks.catAdmin',       color: '#94a3b8' },
  { value: 'Other',       labelKey: 'tasks.catOther',       color: '#9ca3af' },
];

// Cleaning, Maintenance and Equipment were merged into one category; older
// tasks may still carry the old names until they are next saved
const LEGACY = { Cleaning: 'Equipment Maintenance', Maintenance: 'Equipment Maintenance', Equipment: 'Equipment Maintenance' };
export const normalizeCategory = (value) => LEGACY[value] || value;

export const categoryLabel = (value, t) => {
  const c = TASK_CATEGORIES.find(x => x.value === normalizeCategory(value));
  return c ? t(c.labelKey) : value;
};

export const categoryColor = (value) =>
  TASK_CATEGORIES.find(c => c.value === normalizeCategory(value))?.color || '#9ca3af';
