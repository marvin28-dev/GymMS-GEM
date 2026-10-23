// The browser tests run their own backend and web server on ports apart from
// the everyday ones (5000 and 5173), so a development session can stay open.
const API_PORT = Number(process.env.E2E_API_PORT || 5055);
const WEB_PORT = Number(process.env.E2E_WEB_PORT || 5176);
// The test backend's fake mailer shows what it was given on this port
const OUTBOX_PORT = API_PORT + 1;

module.exports = {
  API_PORT,
  WEB_PORT,
  OUTBOX_PORT,
  OUTBOX_URL: `http://127.0.0.1:${OUTBOX_PORT}/outbox`,
  API_URL: `http://localhost:${API_PORT}/api`,
  WEB_ORIGIN: `http://localhost:${WEB_PORT}`,
};
