const app = require('./app');
const { checkConfig } = require('./utils/config');
const { startPayrollReminders } = require('./jobs/payrollReminders');
const { startTaskReminders } = require('./jobs/taskReminders');
const { startLogRetention } = require('./jobs/logRetention');
const { startFreezeFees } = require('./jobs/freezeFees');
const { startScheduledMessages } = require('./jobs/scheduledMessages');

try {
  checkConfig().warnings.forEach(w => console.warn(`Warning: ${w}`));
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`GEM backend running on http://localhost:${PORT}`);
  startPayrollReminders();
  startTaskReminders();
  startLogRetention();
  startFreezeFees();
  startScheduledMessages();
});
