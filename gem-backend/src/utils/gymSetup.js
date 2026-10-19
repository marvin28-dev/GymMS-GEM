const prisma = require('./prisma');

// The Settings sections a new gym is asked to go through and confirm.
const REQUIRED_SECTIONS = ['gym-profile', 'payment', 'membership', 'packages', 'notifications'];

// The owner's own profile is set up once it has what the rest of the system
// relies on: a photo, an ID, a way to reach them, their pay and their rota.
function ownerProfileDone(owner) {
  if (!owner) return false;
  const rota = owner.schedule && typeof owner.schedule === 'object' ? owner.schedule : {};
  const worksSomeDay = Object.values(rota).some(d => d && !d.off);
  return !!owner.photo && !!owner.photoId && !!owner.email && !!owner.emergencyContact
    && Number(owner.salary) > 0 && worksSomeDay;
}

// Where the gym stands. Worked out from the gym's actual records on every
// call, apart from the Settings confirmations, which only the owner can make.
// Once every step is done the gym is marked finished and stays finished, so
// deleting the last package later does not bring the whole list back.
async function setupStatus(gymId) {
  const [gym, owner, packages, staff] = await Promise.all([
    prisma.gym.findUnique({ where: { id: gymId }, select: { setupConfirmed: true, setupCompletedAt: true } }),
    prisma.staff.findFirst({
      where: { gymId, role: 'general_manager' },
      orderBy: { createdAt: 'asc' },
      select: { photo: true, photoId: true, email: true, emergencyContact: true, salary: true, schedule: true },
    }),
    prisma.package.count({ where: { gymId, isVisitor: false } }),
    prisma.staff.count({ where: { gymId, NOT: { role: 'general_manager' } } }),
  ]);
  if (!gym) return null;

  const confirmed = (gym.setupConfirmed || []).filter(s => REQUIRED_SECTIONS.includes(s));
  const items = {
    ownerProfile: ownerProfileDone(owner),
    settings: REQUIRED_SECTIONS.every(s => confirmed.includes(s)),
    packages: packages > 0,
    staff: staff > 0,
  };
  let completedAt = gym.setupCompletedAt;
  if (!completedAt && Object.values(items).every(Boolean)) {
    completedAt = new Date();
    await prisma.gym.update({ where: { id: gymId }, data: { setupCompletedAt: completedAt } });
  }
  return {
    complete: !!completedAt,
    completedAt,
    items,
    confirmedSections: confirmed,
    requiredSections: REQUIRED_SECTIONS,
  };
}

module.exports = { REQUIRED_SECTIONS, setupStatus };
