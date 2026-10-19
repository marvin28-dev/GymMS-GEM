// One place that decides what a given user may see of the notification feed.
// Every read, mark, and delete goes through this, so a handler cannot forget
// the filter and quietly expose or clobber someone else's notifications.

const FITNESS_ROLES = ['trainer', 'instructor', 'coach'];

// Gym-wide notifications carry an audience tag. An untagged one predates the
// tag and is treated as open, so nothing silently disappears from the feed.
const AUDIENCE_BY_ROLE = {
  general_manager: ['all', 'managers', 'owner'],
  manager: ['all', 'managers'],
  front_desk: ['all'],
};

function gymWideWhere(role, userId) {
  const allowed = AUDIENCE_BY_ROLE[role] || ['all'];
  return {
    staffId: null,
    AND: [
      // Nobody hears about themselves. A notice addressed to them directly still
      // arrives: that is the branch below, not this one. A notice about nobody
      // must be named here: in SQL "not about me" is unknown, not true, when it
      // is about no one, which hid every new member and payment notice.
      { OR: [{ aboutStaffId: null }, { aboutStaffId: { not: userId } }] },
      { OR: [{ audience: null }, { audience: { in: allowed } }] },
    ],
  };
}

// Fitness staff only ever see what is addressed to them. Everyone else also
// sees the gym-wide notifications their role is cleared for.
// Anything this person cleared from their own list stays out of it.
function visibilityWhere(user) {
  const notCleared = { dismissals: { none: { staffId: user.id } } };
  if (FITNESS_ROLES.includes(user.role)) {
    return { gymId: user.gymId, staffId: user.id, ...notCleared };
  }
  return {
    gymId: user.gymId,
    OR: [gymWideWhere(user.role, user.id), { staffId: user.id }],
    ...notCleared,
  };
}

module.exports = { visibilityWhere, FITNESS_ROLES };
