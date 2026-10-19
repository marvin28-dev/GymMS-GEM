const prisma = require('./prisma');

// How long an entry is kept before jobs/logRetention.js deletes it
const RETENTION_DAYS = 30;

const CATEGORIES = ['authorization', 'security', 'staff', 'members', 'money', 'payroll', 'timecards', 'settings'];

const fullName = (p) => (p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : '');
const { formatMoney } = require('./money');
const money = (n) => formatMoney(n);

// The token only carries an id and a role, so the name is looked up. Kept
// briefly, since one request can write more than one entry.
const actorCache = new Map();
async function actorFor(user) {
  if (!user?.id) return null;
  const hit = actorCache.get(user.id);
  if (hit && hit.at > Date.now() - 5 * 60 * 1000) return hit.actor;
  const staff = await prisma.staff.findUnique({
    where: { id: user.id },
    select: { id: true, firstName: true, lastName: true, role: true },
  });
  const actor = staff ? { id: staff.id, name: fullName(staff), role: staff.role } : { id: user.id, name: null, role: user.role };
  actorCache.set(user.id, { actor, at: Date.now() });
  return actor;
}

// Writes one entry. Never throws and never holds the request up: a log that
// fails to write must not block or undo the thing it describes.
//
//   req      the request, for the gym and the person acting. Pass null from a job.
//   entry    { category, action, summary, target: { type, id }, details,
//              gymId (jobs), actor (jobs: null means the system) }
function logActivity(req, entry) {
  const gymId = entry.gymId || req?.user?.gymId;
  if (!gymId || !entry.summary) return;
  (async () => {
    const actor = entry.actor !== undefined ? entry.actor : await actorFor(req?.user);
    await prisma.activityLog.create({
      data: {
        gymId,
        actorId: actor?.id ? String(actor.id) : null,
        actorName: actor?.name || null,
        actorRole: actor?.role || null,
        category: CATEGORIES.includes(entry.category) ? entry.category : 'settings',
        action: entry.action,
        summary: entry.summary,
        targetType: entry.target?.type || null,
        targetId: entry.target?.id != null ? String(entry.target.id) : null,
        details: entry.details ?? undefined,
      },
    });
  })().catch(err => console.error('Activity log write failed:', err.message));
}

// What changed between a record and an update, for the fields worth keeping.
// Values the owner should never read back, like passwords, are only named.
function changesBetween(before, after, fields, { hidden = [], format = {} } = {}) {
  const out = [];
  for (const [field, label] of Object.entries(fields)) {
    if (!(field in after) || after[field] === undefined) continue;
    const show = format[field] || ((v) => (v === null || v === undefined || v === '' ? 'empty' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v)));
    const a = show(before?.[field]);
    const b = show(after[field]);
    if (a === b) continue;
    out.push(hidden.includes(field) ? { field: label } : { field: label, from: a, to: b });
  }
  return out;
}

const describeChanges = (changes) => changes.map(c => c.field.toLowerCase()).join(', ');

module.exports = { logActivity, changesBetween, describeChanges, fullName, money, RETENTION_DAYS, CATEGORIES };
