const app = require('./app');
const { startPayrollReminders } = require('./jobs/payrollReminders');
const { startTaskReminders } = require('./jobs/taskReminders');
const { startLogRetention } = require('./jobs/logRetention');
const { startFreezeFees } = require('./jobs/freezeFees');
const { startScheduledMessages } = require('./jobs/scheduledMessages');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`GEM backend running on http://localhost:${PORT}`);
  startPayrollReminders();
  startTaskReminders();
  startLogRetention();
  startFreezeFees();
  startScheduledMessages();
});
