const prisma = require('../utils/prisma');
const { deliverCommunication } = require('../utils/messaging');
const { logFailure } = require('../utils/bestEffort');
const { broadcast } = require('../utils/liveHub');

// Scheduled messages go out on their minute. Each is claimed before it is sent
// (scheduled -> sending in one update), so two servers or two runs can never
// send the same message twice.
const CHECK_INTERVAL_MS = 30 * 1000;

// A send cut off part way (the server restarted or stopped) stayed "sending"
// for good, and Retry and Edit refuse a message being sent. Its deliveries are
// recorded once all have gone, so it cannot be picked up again without mailing
// people twice: an hour after it began it is marked failed, for the staff to
// see and send again if they choose (F-178). A long run of texts takes minutes.
const CUT_OFF_AFTER_MS = 60 * 60 * 1000;

async function failCutOffSends() {
  const stuck = await prisma.communication.findMany({
    where: { status: 'sending', updatedAt: { lt: new Date(Date.now() - CUT_OFF_AFTER_MS) } },
    select: { id: true, gymId: true },
  });
  if (!stuck.length) return;
  await prisma.communication.updateMany({ where: { id: { in: stuck.map(c => c.id) }, status: 'sending' }, data: { status: 'failed' } });
  console.warn(`${stuck.length} message(s) cut off while sending were marked failed`);
  for (const gymId of new Set(stuck.map(c => c.gymId))) broadcast(gymId, { resource: 'communications', origin: null });
}

async function runScheduledMessages() {
  try {
    await failCutOffSends();
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
