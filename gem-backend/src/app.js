require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const gymRoutes = require('./routes/gym.routes');
const memberRoutes = require('./routes/member.routes');
const staffRoutes = require('./routes/staff.routes');
const payrollRoutes = require('./routes/payroll.routes');
const activityLogRoutes = require('./routes/activityLog.routes');
const payAdjustmentRoutes = require('./routes/payAdjustment.routes');
const packageRoutes = require('./routes/package.routes');
const paymentRoutes = require('./routes/payment.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const taskRoutes = require('./routes/task.routes');
const productRoutes = require('./routes/product.routes');
const expenseRoutes = require('./routes/expense.routes');
const approvalRoutes = require('./routes/approval.routes');
const notificationRoutes = require('./routes/notification.routes');
const equipmentRoutes = require('./routes/equipment.routes');
const timecardRoutes = require('./routes/timecard.routes');
const calendarRoutes = require('./routes/calendar.routes');
const communicationRoutes = require('./routes/communication.routes');
const saleRoutes = require('./routes/sale.routes');
const uploadRoutes = require('./routes/upload.routes');
const reportRoutes = require('./routes/report.routes');

const app = express();

const ALLOWED_ORIGINS = [
  'https://gym-ms-gem.vercel.app',
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : []),
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (origin.includes('localhost') || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
// Logos and photos are sent as base64 data URIs, which overflow the 100kb default
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static('uploads'));

app.use('/api', require('./utils/liveHub').announceWrites);
app.use('/api/live', require('./routes/live.routes'));
app.use('/api/auth', authRoutes);
app.use('/api/gyms', gymRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/logs', activityLogRoutes);
app.use('/api/pay-adjustments', payAdjustmentRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/products', productRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/timecards', timecardRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/communications', communicationRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/coach', require('./routes/coach.routes'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
