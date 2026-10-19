// For side effects that must never hold up or undo what they follow (a
// notification, a task, an email): a failure is written to the log instead of
// being thrown, so it is noticed without breaking the request.
function bestEffort(work, what) {
  return Promise.resolve(work).catch((err) => {
    console.error(`${what} failed:`, err?.message || err);
    return null;
  });
}

module.exports = { bestEffort };
