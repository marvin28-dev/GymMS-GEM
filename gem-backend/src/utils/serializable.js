const prisma = require('./prisma');

// Postgres asks for a retry with 40001 (could not serialize) or 40P01
// (deadlock). Prisma names it P2034, except when the refusal comes at the
// commit: then the database driver's own error is passed on as it is.
function mustRetry(err) {
  if (err?.code === 'P2034') return true;
  const cause = err?.cause || err?.meta?.driverAdapterError?.cause;
  return cause?.kind === 'TransactionWriteConflict' || ['40001', '40P01'].includes(cause?.originalCode);
}

// A serializable transaction checks and writes as if nothing else ran at the
// same time. Postgres keeps that promise by refusing one of two transactions
// that touch the same table at once, even when they are about different
// people or gyms. Nothing was written, so the refused one is run again: once
// the other has finished it sees that one's rows, and decides afresh.
async function serializable(work, { attempts = 10 } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(work, { isolationLevel: 'Serializable' });
    } catch (err) {
      if (!mustRetry(err) || attempt >= attempts) throw err;
      // A wait that grows with each refusal, at random within it, so the
      // refused ones do not all come back together and collide again
      await new Promise(resolve => setTimeout(resolve, Math.random() * Math.min(1000, 25 * 2 ** attempt)));
    }
  }
}

module.exports = { serializable };
