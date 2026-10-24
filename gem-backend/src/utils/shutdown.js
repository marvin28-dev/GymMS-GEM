const { endAll } = require('./liveHub');

// Stops the server the way a deploy should (F-180): no new connections, the
// live streams ended so each screen reconnects to the new server, and requests
// under way allowed to finish. Whatever is still open after timeoutMs is cut.
function closeGracefully(server, { timeoutMs = 10000 } = {}) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => server.closeAllConnections(), timeoutMs);
    server.close(() => { clearTimeout(timer); resolve(); });
    endAll();
    // A browser's idle keep-alive connection would otherwise hold close() open
    server.closeIdleConnections();
  });
}

module.exports = { closeGracefully };
