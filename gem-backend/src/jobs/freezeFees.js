const prisma = require('../utils/prisma');

// Freeze fees: a gym can charge a member a fee for every N days their
// membership stays frozen (configured in Settings -> gym.settings.freeze).
// The first fee is added when the membership is frozen; this job adds another
// for every further N-day interval the member stays frozen, so the balance
// keeps growing while the account sits idle.
const DAY = 86400000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // a few times a day, survives restarts

async function runFreezeFees() {
  try {
    const gyms = await prisma.gym.findMany({ select: { id: true, settings: true } });
    const now = Date.now();
    for (const gym of gyms) {
      const fee = Number(gym.settings?.freeze?.fee) || 0;
      const intervalDays = Number(gym.settings?.freeze?.intervalDays) || 0;
      if (fee <= 0 || intervalDays <= 0) continue;
      const intervalMs = intervalDays * DAY;

      const frozen = await prisma.member.findMany({
        where: { gymId: gym.id, status: 'frozen' },
        select: { id: true, freezeStartDate: true, freezeFeeLastChargedAt: true },
      });
      for (const m of frozen) {
        const last = m.freezeFeeLastChargedAt || m.freezeStartDate;
        if (!last) continue; // no baseline to count from
        const elapsed = now - new Date(last).getTime();
        const intervals = Math.floor(elapsed / intervalMs);
        if (intervals < 1) continue;
        const charge = fee * intervals;
        const newLast = new Date(new Date(last).getTime() + intervals * intervalMs);
        // Charged only if nothing has charged it since it was read, and added
        // in the database: two runs at once charge once, and a payment taken
        // at the same moment is kept (writing the read balance back lost it)
        try {
          await prisma.member.updateMany({
            where: { id: m.id, status: 'frozen', freezeFeeLastChargedAt: m.freezeFeeLastChargedAt },
            data: { balance: { increment: charge }, freezeFeeLastChargedAt: newLast },
          });
        } catch (e) { console.error('Freeze fee update failed:', e.message); }
      }
    }
  } catch (err) {
    console.error('Freeze fee sweep failed:', err.message);
  }
}

function startFreezeFees() {
  setTimeout(runFreezeFees, 30_000);
  const timer = setInterval(runFreezeFees, CHECK_INTERVAL_MS);
  timer.unref?.();
  return timer;
}

module.exports = { startFreezeFees, runFreezeFees };
