const router = require('express').Router();
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const { subscribe } = require('../utils/liveHub');
const { logFailure } = require('../utils/bestEffort');

// EventSource cannot send an Authorization header, so the token comes in the query
router.get('/', async (req, res) => {
  let payload;
  try {
    payload = jwt.verify(String(req.query.token || ''), process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  const account = await prisma.staff.findUnique({ where: { id: payload.id }, select: { gymId: true, isActive: true } }).catch(logFailure('Checking the live stream account'));
  if (!account || !account.isActive || account.gymId !== payload.gymId) return res.status(401).json({ error: 'Unauthorized' });

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
  // The token runs out; end the stream then so a signed-out screen stops listening
  const ttl = Math.max(0, (payload.exp || 0) * 1000 - Date.now());
  const expire = setTimeout(() => res.end(), Math.min(ttl, 2 ** 31 - 1));
  req.on('close', () => { clearInterval(beat); clearTimeout(expire); unsubscribe(); });
});

module.exports = router;
