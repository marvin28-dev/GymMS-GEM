// Once a month ends, its bills are prepared as drafts for GEM's admin to check
// and send, and the admin is emailed that they are ready. Checked every hour;
// each month is prepared once (PlatformSettings.lastPreparedPeriod, claimed in
// one update so two servers never both do it). The first run only notes the
// month just ended: billing starts from the month it was switched on.
const prisma = require('../utils/prisma');
const { platformSettings, previousPeriod, periodBounds, periodOf, prepareInvoices } = require('../utils/billing');

// The months after `from` up to and including `to` ("2026-10", "2026-12" -> Nov, Dec)
function monthsAfter(from, to) {
  const out = [];
  let d = periodBounds(from).end;
  while (periodOf(d) <= to) { out.push(periodOf(d)); d = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
  return out;
}
const { sendBillsReady } = require('../utils/gemEmail');

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

async function runMonthlyBills(now = new Date()) {
  try {
    const due = previousPeriod(now);
    const settings = await platformSettings();
    if (!settings.lastPreparedPeriod) {
      await prisma.platformSettings.upsert({ where: { id: 1 }, create: { id: 1, lastPreparedPeriod: due }, update: { lastPreparedPeriod: due } });
      return { prepared: 0, started: due };
    }
    if (settings.lastPreparedPeriod >= due) return { prepared: 0 };
    const { count } = await prisma.platformSettings.updateMany({ where: { id: 1, lastPreparedPeriod: settings.lastPreparedPeriod }, data: { lastPreparedPeriod: due } });
    if (!count) return { prepared: 0 };
    // Normally just the month that ended; every one missed if the server was down
    let prepared = 0;
    for (const period of monthsAfter(settings.lastPreparedPeriod, due)) {
      const { created = [], error } = await prepareInvoices(period, now);
      if (error) throw new Error(error);
      if (created.length) await sendBillsReady(period, created.length);
      prepared += created.length;
    }
    return { prepared };
  } catch (err) {
    console.error('Preparing the monthly bills failed:', err.message);
    return { prepared: 0, error: err.message };
  }
}

function startMonthlyBills() {
  setTimeout(runMonthlyBills, 45_000).unref?.();
  const timer = setInterval(runMonthlyBills, CHECK_INTERVAL_MS);
  timer.unref?.();
  return timer;
}

module.exports = { startMonthlyBills, runMonthlyBills };
