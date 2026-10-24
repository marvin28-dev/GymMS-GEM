const prisma = require('./prisma');

// New work only goes to people who still work here: staff of this gym whose
// account is active. Returns the reason to refuse, or null when all is well.
async function refuseAssignees(gymId, ids) {
  const wanted = [...new Set((ids || []).filter(Boolean).map(String))];
  if (!wanted.length) return null;
  const found = await prisma.staff.findMany({
    where: { gymId, id: { in: wanted } },
    select: { id: true, firstName: true, lastName: true, isActive: true },
  });
  if (found.length !== wanted.length) return 'Staff not found';
  const off = found.filter(s => !s.isActive);
  if (!off.length) return null;
  const names = off.map(s => `${s.firstName || ''} ${s.lastName || ''}`.trim()).join(', ');
  return off.length === 1
    ? `${names}'s account is deactivated, so they cannot be given new work.`
    : `These accounts are deactivated, so they cannot be given new work: ${names}.`;
}

// Older accounts still carry these, and they do a trainer's job
const SAME_JOB = { instructor: 'trainer', coach: 'trainer' };
const jobOf = (role) => SAME_JOB[role] || role;

module.exports = { refuseAssignees, jobOf };
