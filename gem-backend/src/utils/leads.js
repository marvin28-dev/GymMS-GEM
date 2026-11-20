// A gym signing up whose owner had asked for a demo: the lead is won, and
// linked to the gym it became. Matched on the email, whatever its capitals.
const prisma = require('./prisma');

async function linkLeadToGym(gymId, email) {
  const address = String(email || '').trim();
  if (!address) return 0;
  const { count } = await prisma.lead.updateMany({
    where: { gymId: null, email: { equals: address, mode: 'insensitive' } },
    data: { gymId, status: 'won', nextFollowUp: null },
  });
  return count;
}

module.exports = { linkLeadToGym };
