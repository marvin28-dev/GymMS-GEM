require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const prisma = require('./utils/prisma');

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
app.disable('x-powered-by');

// Behind a proxy (Railway's edge) every request arrives from the proxy, and the
// visitor's own address is in X-Forwarded-For. Without trusting that one hop,
// every visitor shared one rate limit: 30 sign-in lookups for the whole world.
// TRUST_PROXY overrides it (a number of hops, true or false); on Railway it is 1.
const trustProxy = process.env.TRUST_PROXY ?? (process.env.RAILWAY_ENVIRONMENT ? '1' : '');
if (trustProxy) app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === 'true');

const ALLOWED_ORIGINS = [
  'https://gym-ms-gem.vercel.app',
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : []),
];

// A development server on this machine, matched on the host itself: a check for
// "localhost" anywhere in the origin also let https://localhost.attacker.example in
const isLocalDevOrigin = (origin) => {
  try {
    const { protocol, hostname } = new URL(origin);
    return protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1');
  } catch {
    return false;
  }
};

app.use(cors({
  // Another site is simply not given the CORS headers, so the browser refuses it.
  // Throwing here turned every such request into a 500 and a stack trace.
  origin: (origin, callback) => callback(null, !origin || isLocalDevOrigin(origin) || ALLOWED_ORIGINS.includes(origin)),
  credentials: true,
}));
// Lists of members, payments and check-ins shrink several times over, which
// counts on a phone's data (F-177). Never the live stream: compressing holds
// its events back until enough has gathered.
app.use(compression({ filter: (req, res) => !String(res.getHeader('Content-Type') || '').startsWith('text/event-stream') && compression.filter(req, res) }));
// Logos and photos are sent as base64 data URIs, which overflow the 100kb default
app.use(express.json({ limit: '5mb' }));
// Express 5 leaves req.body undefined when a request carries no JSON, and the
// handlers read fields off it, which answered 500 instead of a proper refusal
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});
// The API answers JSON (and the odd PDF) to the site, never pages of its own,
// so nothing it sends may be framed, sniffed or allowed to load anything (F-005).
// The site's own headers are set where it is hosted.
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
  });
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
});

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

// Asks the database too: a deploy that cannot reach it must not look healthy
// (F-179). Three seconds is long enough for a slow answer, short enough for a
// health check.
app.get('/api/health', async (req, res) => {
  let timer;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('no answer within 3 seconds')), 3000); }),
    ]);
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Health check: the database could not be reached:', err.message);
    res.status(503).json({ status: 'unavailable' });
  } finally {
    clearTimeout(timer);
  }
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

const CLIENT_ERRORS = {
  'entity.parse.failed': 'The request body is not valid JSON.',
  'entity.too.large': 'The request is too large.',
};

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  // A request the client got wrong keeps its own status: it is not a fault here
  const status = Number(err.status || err.statusCode);
  if (status >= 400 && status < 500) {
    return res.status(status).json({ error: CLIENT_ERRORS[err.type] || (err.expose && err.message) || 'Bad request' });
  }
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
