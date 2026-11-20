// GEM acting on a gym's account: telling its owners in the app, and reopening
// an account it paused. Used by the gyms page and by marking a bill paid.
const prisma = require('./prisma');
const { platformSettings } = require('./billing');
const { sendLockChange } = require('./gemEmail');
const { forgetGym } = require('../middleware/auth.middleware');
const { broadcast } = require('./liveHub');
const { logActivity } = require('./activityLog');
const { bestEffort } = require('./bestEffort');

// How GEM is named in a gym's activity log
const GEM_ACTOR = { id: null, name: 'GEM', role: 'gem' };

// Every owner of the gym sees it in their notifications
async function tellOwners(gymId, title, body, link) {
  await prisma.notification.create({ data: { gymId, title, body, type: 'system', audience: 'owner', link } });
  broadcast(gymId, { resource: 'notifications', origin: null });
}

async function reopenGym(gym) {
  await prisma.gym.update({ where: { id: gym.id }, data: { lockedAt: null, lockReason: null } });
  forgetGym(gym.id);
  logActivity(null, { gymId: gym.id, actor: GEM_ACTOR, category: 'security', action: 'gym.unlocked', summary: 'GEM reopened the account' });
  await tellOwners(gym.id, 'Your GEM account is open again', 'Everyone can use GEM again. Thank you.', '/dashboard').catch(err => console.error('Reopened notice failed:', err.message));
  const settings = await platformSettings();
  bestEffort(sendLockChange(gym, false, null, settings), 'Reopened account email');
  broadcast(gym.id, { resource: 'billing', origin: null });
}

module.exports = { GEM_ACTOR, tellOwners, reopenGym };
