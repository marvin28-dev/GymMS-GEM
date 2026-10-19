const prisma = require('./prisma');

// One person cannot have two staff accounts, nor two member accounts - but the
// same person may be BOTH a staff member and a member (they train where they
// work), so the same email is allowed across the two. Each kind is therefore
// checked only against its own table: pass `scope: 'member'` or `scope: 'staff'`.
async function findEmailConflict(gymId, email, { scope, excludeMemberId, excludeStaffId } = {}) {
  const value = String(email || '').trim();
  if (!value) return null;

  const checks = [];
  if (scope !== 'member') {
    checks.push(prisma.staff.findFirst({
      where: {
        gymId,
        email: { equals: value, mode: 'insensitive' },
        ...(excludeStaffId ? { NOT: { id: excludeStaffId } } : {}),
      },
      select: { id: true },
    }).then(s => (s ? 'staff' : null)));
  }
  if (scope !== 'staff') {
    checks.push(prisma.member.findFirst({
      where: {
        gymId,
        email: { equals: value, mode: 'insensitive' },
        ...(excludeMemberId ? { NOT: { id: excludeMemberId } } : {}),
      },
      select: { id: true },
    }).then(m => (m ? 'member' : null)));
  }

  const results = await Promise.all(checks);
  return results.find(Boolean) || null;
}

function emailConflictMessage(kind) {
  return kind === 'staff'
    ? 'This email already belongs to a staff account at this gym.'
    : 'This email already belongs to another member at this gym.';
}

module.exports = { findEmailConflict, emailConflictMessage };
