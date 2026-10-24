const app = require('./app');
const { checkConfig } = require('./utils/config');
const { startPayrollReminders } = require('./jobs/payrollReminders');
const { startTaskReminders } = require('./jobs/taskReminders');
const { startLogRetention } = require('./jobs/logRetention');
const { startFreezeFees } = require('./jobs/freezeFees');
const { startScheduledMessages } = require('./jobs/scheduledMessages');
const prisma = require('./utils/prisma');
const { closeGracefully } = require('./utils/shutdown');

try {
  checkConfig().warnings.forEach(w => console.warn(`Warning: ${w}`));
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const PORT = process.env.PORT || 5000;
let jobs = [];
const server = app.listen(PORT, () => {
  console.log(`GEM backend running on http://localhost:${PORT}`);
  jobs = [startPayrollReminders(), startTaskReminders(), startLogRetention(), startFreezeFees(), startScheduledMessages()];
});

// A deploy stops this server with SIGTERM; Node's default is to quit on the
// spot, cutting off whatever is under way (F-180)
let stopping = false;
async function stop(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`${signal}: finishing the requests under way, then stopping`);
  jobs.forEach(clearInterval);
  await closeGracefully(server);
  await prisma.$disconnect().catch(() => {});
  process.exit(0);
}
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));
