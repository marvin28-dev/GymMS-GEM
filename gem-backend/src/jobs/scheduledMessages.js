const prisma = require('../utils/prisma');
const { deliverCommunication } = require('../utils/messaging');
const { logFailure } = require('../utils/bestEffort');

// Scheduled messages go out on their minute. Each is claimed before it is sent
// (scheduled -> sending in one update), so two servers or two runs can never
// send the same message twice.
const CHECK_INTERVAL_MS = 30 * 1000;

async function runScheduledMessages() {
  try {
    const due = await prisma.communication.findMany({
      where: { status: 'scheduled', scheduledAt: { lte: new Date() } },
      select: { id: true },
      take: 20,
    });
    for (const { id } of due) {
      const { count } = await prisma.communication.updateMany({ where: { id, status: 'scheduled' }, data: { status: 'sending' } });
      if (!count) continue;
      await deliverCommunication(id).catch(async (err) => {
        console.error(`Scheduled message ${id} failed:`, err.message);
        await prisma.communication.update({ where: { id }, data: { status: 'failed' } }).catch(logFailure('Marking the scheduled message failed'));
      });
    }
  } catch (err) {
    console.error('Scheduled messages check failed:', err.message);
  }
}

function startScheduledMessages() {
  runScheduledMessages();
  return setInterval(runScheduledMessages, CHECK_INTERVAL_MS);
}

module.exports = { startScheduledMessages, runScheduledMessages };
