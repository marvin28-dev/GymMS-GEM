// Every open screen keeps one Server-Sent Events stream to the server. When
// anything in a gym changes, each screen of that gym is told which resource
// moved, so a pass bought at one desk shows at the other without a refresh.
const streams = new Map(); // gymId -> Set<res>

function subscribe(gymId, res) {
  if (!streams.has(gymId)) streams.set(gymId, new Set());
  streams.get(gymId).add(res);
  return () => {
    const set = streams.get(gymId);
    if (!set) return;
    set.delete(res);
    if (!set.size) streams.delete(gymId);
  };
}

function broadcast(gymId, event) {
  const set = streams.get(gymId);
  if (!set) return;
  const line = `data: ${JSON.stringify({ ...event, at: Date.now() })}\n\n`;
  for (const res of set) {
    try { res.write(line); } catch { /* a closed stream is dropped on its own close event */ }
  }
}

// After any successful write under /api, name the resource that changed:
// /api/members/123/send-code -> "members"
function announceWrites(req, res, next) {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return next();
  res.on('finish', () => {
    if (res.statusCode >= 400 || !req.user?.gymId) return;
    const resource = (req.originalUrl.split('?')[0].split('/')[2]) || 'unknown';
    // A support report is the sender's alone: no other screen shows it
    if (resource === 'auth' || resource === 'live' || resource === 'support') return;
    broadcast(req.user.gymId, { resource, origin: req.headers['x-client-id'] || null });
  });
  next();
}

// The server is stopping: each screen's browser reconnects on its own
function endAll() {
  for (const set of streams.values()) {
    for (const res of set) {
      try { res.end(); } catch { /* already closed */ }
    }
  }
  streams.clear();
}

module.exports = { subscribe, broadcast, announceWrites, endAll };
