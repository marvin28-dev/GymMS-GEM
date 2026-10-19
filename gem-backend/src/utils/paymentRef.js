// Every payment carries a reference the member can quote: TXN-, the time it was
// taken, and three random characters
function generatePaymentRef() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `TXN-${ts}-${rand}`;
}

module.exports = { generatePaymentRef };
