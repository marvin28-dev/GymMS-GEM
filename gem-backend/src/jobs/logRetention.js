const prisma = require('../utils/prisma');
const { RETENTION_DAYS } = require('../utils/activityLog');

const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;

// Each entry lives for 30 days from the moment it was written, then goes
async function purgeOldLogs() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  try {
    const { count } = await prisma.activityLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    if (count) console.log(`Activity log: removed ${count} entries older than ${RETENTION_DAYS} days`);
  } catch (err) {
    console.error('Activity log cleanup failed:', err.message);
  }
}

function startLogRetention() {
  setTimeout(purgeOldLogs, 45_000);
  const timer = setInterval(purgeOldLogs, CHECK_INTERVAL_MS);
  timer.unref?.();
  return timer;
}

module.exports = { startLogRetention, purgeOldLogs };
