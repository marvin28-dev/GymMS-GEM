const router = require('express').Router();
const crypto = require('crypto');
const prisma = require('../utils/prisma');
const { subscribe } = require('../utils/liveHub');
const { logFailure } = require('../utils/bestEffort');
const { authenticate } = require('../middleware/auth.middleware');

// EventSource cannot send an Authorization header, and a sign-in token in the
// URL ends up in proxy and server logs (F-006). So the page asks for a ticket
// with its header, and opens the stream with that: good for one stream, for a
// minute. Tickets live in this process, which is enough for one instance.
const TICKET_LIFE = 60 * 1000;
const tickets = new Map();

function sweep(now = Date.now()) {
  for (const [id, t] of tickets) if (t.expiresAt <= now) tickets.delete(id);
}

router.post('/ticket', authenticate, (req, res) => {
  sweep();
  const ticket = crypto.randomBytes(32).toString('hex');
  tickets.set(ticket, { staffId: req.user.id, gymId: req.user.gymId, tokenExp: req.user.exp, expiresAt: Date.now() + TICKET_LIFE });
  res.set('Cache-Control', 'no-store');
  res.json({ ticket });
});

router.get('/', async (req, res) => {
  const id = String(req.query.ticket || '');
  const t = tickets.get(id);
  tickets.delete(id);
  if (!t || t.expiresAt <= Date.now()) return res.status(401).json({ error: 'Invalid or expired ticket' });
  const account = await prisma.staff.findUnique({ where: { id: t.staffId }, select: { gymId: true, isActive: true } }).catch(logFailure('Checking the live stream account'));
  if (!account || !account.isActive || account.gymId !== t.gymId) return res.status(401).json({ error: 'Unauthorized' });

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  const unsubscribe = subscribe(account.gymId, res);
  // Proxies close a stream that stays silent, so say something every 25s
  const beat = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* closing */ } }, 25000);
  // The sign-in runs out; end the stream then so a signed-out screen stops listening
  const ttl = Math.max(0, (t.tokenExp || 0) * 1000 - Date.now());
  const expire = setTimeout(() => res.end(), Math.min(ttl, 2 ** 31 - 1));
  req.on('close', () => { clearInterval(beat); clearTimeout(expire); unsubscribe(); });
});

module.exports = router;
