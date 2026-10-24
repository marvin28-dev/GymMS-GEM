// Resend answers with { data, error } rather than throwing, so a send that was
// refused looks exactly like a delivered one unless the result is read. Every
// send in the app goes through here so a failure is never silent.
// The public demo gym's people are made up, and an address there may still
// belong to a real stranger, so nothing is ever sent for it (D-2)
const demoCode = () => String(process.env.DEMO_GYM_CODE || 'elite').toLowerCase();
const isDemoGym = (gym) => !!gym?.code && String(gym.code).toLowerCase() === demoCode();

async function deliver(resend, message, gym) {
  if (isDemoGym(gym)) {
    console.log(`Demo gym: "${message.subject}" was not sent`);
    return { skipped: 'demo' };
  }
  const { data, error } = await resend.emails.send(message);
  if (error) {
    const err = new Error(error.message || 'Email send failed');
    err.resend = error;
    throw err;
  }
  return data;
}

// Sending to a group as one message fails as a unit: one address the provider
// will not accept and nobody gets it. One send per recipient keeps a refusal
// from costing everybody else their copy.
async function deliverEach(resend, addresses, buildMessage, gym) {
  const list = (addresses || []).filter(Boolean);
  if (list.length === 0) return { sent: 0, failed: [] };

  const results = await Promise.allSettled(list.map(a => deliver(resend, buildMessage(a), gym)));
  const failed = results
    .map((r, i) => (r.status === 'rejected' ? { to: list[i], why: r.reason?.message } : null))
    .filter(Boolean);
  if (failed.length) {
    console.error('Email could not be delivered to:', failed.map(f => `${f.to} (${f.why})`).join('; '));
  }
  return { sent: list.length - failed.length, failed };
}

module.exports = { deliver, deliverEach, isDemoGym, demoCode };
