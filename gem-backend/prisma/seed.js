require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // ── Gym ──────────────────────────────────────────────────────────────────────
  const gym = await prisma.gym.upsert({
    where: { code: 'elite' },
    update: {},
    create: {
      code: 'elite',
      name: 'Elite Fitness Club',
      location: 'Shell Nsimeyong, Yaoundé',
      phone: '+237 222 123 456',
      email: 'info@elitefitness.cm',
      currency: 'XAF',
      registrationFee: 5000,
      registrationFeeRequired: true,
      registrationFeeFrequency: 'yearly',
      registrationGracePeriodDays: 7,
      minUpfrontPercent: 50,
      paymentDeadlineDays: 30,
      managerCode: '9721',
    },
  });
  console.log('Gym:', gym.name, `(code: ${gym.code})`);

  // ── Staff ─────────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('admin123', 10);

  const staffData = [
    { firstName: 'Marvin', lastName: 'Ekokobe', email: 'marvin@elite.cm', role: 'general_manager', department: 'Management', accessCode: '9721', shiftStart: '08:00', avatarColor: '#c9a96e' },
    { firstName: 'Michel', lastName: 'Roko',    email: 'michel@elite.cm', role: 'trainer',         department: 'Fitness',    accessCode: '3847', shiftStart: '07:30', avatarColor: '#60a5fa' },
    { firstName: 'Sandrine', lastName: 'Kom',   email: 'sandrine@elite.cm', role: 'front_desk',   department: 'Operations', accessCode: '5163', shiftStart: '08:00', avatarColor: '#f59e0b' },
    { firstName: 'Claude', lastName: 'Nkemeni', email: 'claude@elite.cm', role: 'instructor',     department: 'Fitness',    accessCode: '7429', shiftStart: '09:00', avatarColor: '#a78bfa' },
    { firstName: 'Marie',  lastName: 'Samba',   email: 'marie@elite.cm',  role: 'instructor',     department: 'Fitness',    accessCode: '2856', shiftStart: '10:00', avatarColor: '#34d399' },
  ];

  const createdStaff = [];
  for (const s of staffData) {
    const staff = await prisma.staff.upsert({
      where: { gymId_email: { gymId: gym.id, email: s.email } },
      update: {},
      create: { gymId: gym.id, passwordHash, joinDate: new Date('2024-01-15'), ...s },
    });
    createdStaff.push(staff);
  }
  console.log('Staff seeded:', createdStaff.length);

  // ── Packages ──────────────────────────────────────────────────────────────────
  const pkgSeed = [
    { id: 'pkg-bm',  code: 'PKG-BM',  name: 'Basic Monthly',   price: 15000,  minPayment: 7500,  duration: '1 Month',   sessions: 'Unlimited', access: 'Gym Floor',            isVisitor: false, durationDays: 30 },
    { id: 'pkg-s6',  code: 'PKG-S6',  name: 'Standard 6M',     price: 75000,  minPayment: 25000, duration: '6 Months',  sessions: 'Unlimited', access: 'Full Access',          isVisitor: false, durationDays: 180 },
    { id: 'pkg-p12', code: 'PKG-P12', name: 'Premium 12M',     price: 130000, minPayment: 50000, duration: '12 Months', sessions: 'Unlimited', access: 'Full Access + Classes',isVisitor: false, durationDays: 365 },
    { id: 'pkg-vp',  code: 'PKG-VP',  name: 'Visitor Pass',    price: 5000,   minPayment: 5000,  duration: '1 Day',     sessions: '1',         access: 'Gym Floor',            isVisitor: true,  maxPasses: 1 },
    { id: 'pkg-sm',  code: 'PKG-SM',  name: 'Student Monthly', price: 10000,  minPayment: 5000,  duration: '1 Month',   sessions: 'Unlimited', access: 'Gym Floor',            isVisitor: false, durationDays: 30 },
  ];

  for (const pkg of pkgSeed) {
    await prisma.package.upsert({
      where: { id: pkg.id },
      update: {},
      create: { gymId: gym.id, ...pkg },
    });
  }
  console.log('Packages seeded:', pkgSeed.length);

  // ── Members ───────────────────────────────────────────────────────────────────
  const memberSeed = [
    { memberCode: 'GEM-0001', firstName: 'Armand',     lastName: 'Kamga',     phone: '+237 655 123 456', email: 'armand.k@gmail.com',     gender: 'Male',   avatarColor: 'gold',   accessCode: '4271', packageId: 'pkg-p12', status: 'active',   startDate: '2026-01-15', endDate: '2027-01-14', balance: 0,      regFeeDate: '2026-01-15' },
    { memberCode: 'GEM-0002', firstName: 'Sophie',     lastName: 'Ngono',     phone: '+237 677 234 567', email: 'sophie.n@gmail.com',     gender: 'Female', avatarColor: 'blue',   accessCode: '8364', packageId: 'pkg-s6',  status: 'active',   startDate: '2025-11-01', endDate: '2026-04-30', balance: 0,      regFeeDate: '2025-11-01' },
    { memberCode: 'GEM-0003', firstName: 'Patrick',    lastName: 'Mekontchou',phone: '+237 677 321 654', email: 'patrick.m@gmail.com',    gender: 'Male',   avatarColor: 'blue',   accessCode: '2938', packageId: 'pkg-p12', status: 'active',   startDate: '2025-09-10', endDate: '2026-09-09', balance: 0,      regFeeDate: '2025-09-10' },
    { memberCode: 'GEM-0004', firstName: 'Marcel',     lastName: 'Fonkoua',   phone: '+237 699 345 678', email: 'marcel.f@gmail.com',     gender: 'Male',   avatarColor: 'green',  accessCode: '5129', packageId: 'pkg-p12', status: 'expiring', startDate: '2025-04-01', endDate: '2026-03-31', balance: 45000,  regFeeDate: '2025-04-01' },
    { memberCode: 'GEM-0005', firstName: 'Théodore',   lastName: 'Nkolo',     phone: '+237 699 410 223', email: 'theodore.n@gmail.com',   gender: 'Male',   avatarColor: 'red',    accessCode: '3741', packageId: 'pkg-s6',  status: 'suspended',startDate: '2025-02-10', endDate: '2026-08-09', balance: 0,      regFeeDate: '2025-02-10' },
    { memberCode: 'GEM-0006', firstName: 'Bertrand',   lastName: 'Fotso',     phone: '+237 699 111 222', email: 'bertrand.f@gmail.com',   gender: 'Male',   avatarColor: 'blue',   accessCode: '1144', packageId: 'pkg-p12', status: 'frozen',   startDate: '2025-06-01', endDate: '2026-08-31', balance: 0,      regFeeDate: '2025-06-01', freezeStartDate: '2026-03-01', preFreezEndDate: '2026-07-31' },
    { memberCode: 'GEM-0007', firstName: 'René',       lastName: 'Nguimkeu',  phone: '+237 655 789 012', email: 'rene.n@gmail.com',       gender: 'Male',   avatarColor: 'blue',   accessCode: '9245', packageId: 'pkg-p12', status: 'expired',  startDate: '2025-02-01', endDate: '2026-01-31', balance: 360000, regFeeDate: '2025-02-01' },
    { memberCode: 'GEM-0008', firstName: 'Dieudonne',  lastName: 'Wamba',     phone: '+237 677 567 890', email: 'dieudonne.w@gmail.com',  gender: 'Male',   avatarColor: 'purple', accessCode: '3856', packageId: 'pkg-vp',  status: 'visitor',  startDate: '2026-03-22', endDate: null,         balance: 0,      passesTotal: 5, passesRemaining: 3, isVisitor: true },
  ];

  for (const m of memberSeed) {
    const existing = await prisma.member.findUnique({ where: { memberCode: m.memberCode } });
    if (!existing) {
      await prisma.member.create({
        data: {
          ...m,
          gymId: gym.id,
          startDate: m.startDate ? new Date(m.startDate) : null,
          endDate: m.endDate ? new Date(m.endDate) : null,
          regFeeDate: m.regFeeDate ? new Date(m.regFeeDate) : null,
          freezeStartDate: m.freezeStartDate ? new Date(m.freezeStartDate) : null,
          preFreezEndDate: m.preFreezEndDate ? new Date(m.preFreezEndDate) : null,
          lastVisit: new Date(),
          isVisitor: m.isVisitor ?? false,
        },
      });
    }
  }
  console.log('Members seeded:', memberSeed.length);

  // ── Products ──────────────────────────────────────────────────────────────────
  const productSeed = [
    { id: 'prod-001', name: 'Whey Protein (1kg)', category: 'Supplements', price: 13500, stock: 3 },
    { id: 'prod-002', name: 'Water Bottle',        category: 'Accessories', price: 600,   stock: 120 },
    { id: 'prod-003', name: 'Protein Bar',         category: 'Snacks',      price: 1200,  stock: 48 },
    { id: 'prod-004', name: 'Gym Gloves',          category: 'Accessories', price: 5400,  stock: 15 },
    { id: 'prod-005', name: 'Energy Drink',        category: 'Drinks',      price: 1050,  stock: 60 },
  ];
  for (const p of productSeed) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {},
      create: { gymId: gym.id, ...p },
    });
  }
  console.log('Products seeded:', productSeed.length);

  console.log('\n✓ Seed complete. Login with:');
  console.log('  Gym code: elite');
  console.log('  Email:    marvin@elite.cm');
  console.log('  Password: admin123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
