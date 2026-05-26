export const members = [
  // ── Active ───────────────────────────────────────────────────────────────────
  { id: 'GEM-0342', firstName: 'Armand',    lastName: 'Kamga',     phone: '+237 655 123 456', email: 'armand.k@gmail.com',    package: 'Premium 12M',    status: 'active',      startDate: '2026-01-15', endDate: '2027-01-14', balance: 0,      lastVisit: '2026-03-23', gender: 'Male',   avatarColor: 'gold',   accessCode: '4271', regFeeDate: '2026-01-15' },
  { id: 'GEM-0518', firstName: 'Sophie',    lastName: 'Ngono',     phone: '+237 677 234 567', email: 'sophie.n@gmail.com',    package: 'Standard 6M',    status: 'active',      startDate: '2025-11-01', endDate: '2026-04-30', balance: 0,      lastVisit: '2026-03-23', gender: 'Female', avatarColor: 'blue',   accessCode: '8364', regFeeDate: '2025-11-01' },
  { id: 'GEM-0729', firstName: 'Laure',     lastName: 'Tchinda',   phone: '+237 655 456 789', email: 'laure.t@gmail.com',     package: 'Basic Monthly',  status: 'active',      startDate: '2026-03-01', endDate: '2026-03-31', balance: 0,      lastVisit: '2026-03-23', gender: 'Female', avatarColor: 'red',    accessCode: '7403', regFeeDate: '2026-03-01' },
  { id: 'GEM-0846', firstName: 'Esther',    lastName: 'Kouam',     phone: '+237 699 678 901', email: 'esther.k@gmail.com',    package: 'Standard 6M',    status: 'active',      startDate: '2026-03-20', endDate: '2026-09-19', balance: 22500,  lastVisit: '2026-03-21', gender: 'Female', avatarColor: 'gold',   accessCode: '6017', regFeeDate: '2026-03-20' },
  { id: 'GEM-0634', firstName: 'Patrick',   lastName: 'Mekontchou',phone: '+237 677 321 654', email: 'patrick.m@gmail.com',   package: 'Premium 12M',    status: 'active',      startDate: '2025-09-10', endDate: '2026-09-09', balance: 0,      lastVisit: '2026-03-22', gender: 'Male',   avatarColor: 'blue',   accessCode: '2938', regFeeDate: '2025-09-10' },
  { id: 'GEM-0711', firstName: 'Christelle',lastName: 'Abena',     phone: '+237 655 741 852', email: 'christelle.a@gmail.com',package: 'Student Monthly', status: 'active',      startDate: '2026-03-05', endDate: '2026-04-04', balance: 0,      lastVisit: '2026-03-20', gender: 'Female', avatarColor: 'purple', accessCode: '5574', regFeeDate: '2026-03-05' },
  { id: 'GEM-0503', firstName: 'Bruno',     lastName: 'Talla',     phone: '+237 699 852 963', email: 'bruno.t@gmail.com',     package: 'Basic Monthly',  status: 'active',      startDate: '2026-02-15', endDate: '2026-03-14', balance: 0,      lastVisit: '2026-03-19', gender: 'Male',   avatarColor: 'green',  accessCode: '8821', regFeeDate: '2026-02-15' },

  // ── Expiring Soon ─────────────────────────────────────────────────────────────
  { id: 'GEM-0201', firstName: 'Marcel',    lastName: 'Fonkoua',   phone: '+237 699 345 678', email: 'marcel.f@gmail.com',    package: 'Premium 12M',    status: 'expiring',    startDate: '2025-04-01', endDate: '2026-03-31', balance: 45000,  lastVisit: '2026-03-23', gender: 'Male',   avatarColor: 'green',  accessCode: '5129', regFeeDate: '2025-04-01' },
  { id: 'GEM-0388', firstName: 'Nadège',    lastName: 'Bisseck',   phone: '+237 655 963 741', email: 'nadege.b@gmail.com',    package: 'Standard 6M',    status: 'expiring',    startDate: '2025-10-05', endDate: '2026-04-04', balance: 0,      lastVisit: '2026-03-18', gender: 'Female', avatarColor: 'red',    accessCode: '3317', regFeeDate: '2025-10-05' },
  { id: 'GEM-0415', firstName: 'Serge',     lastName: 'Njike',     phone: '+237 677 159 357', email: 'serge.n@gmail.com',     package: 'Basic Monthly',  status: 'expiring',    startDate: '2026-03-03', endDate: '2026-04-02', balance: 15000,  lastVisit: '2026-03-15', gender: 'Male',   avatarColor: 'blue',   accessCode: '6692', regFeeDate: '2026-03-03' },

  // ── Suspended (registration fee lapsed) ──────────────────────────────────────
  { id: 'GEM-0560', firstName: 'Théodore',  lastName: 'Nkolo',     phone: '+237 699 410 223', email: 'theodore.n@gmail.com',  package: 'Standard 6M',    status: 'suspended',   startDate: '2025-02-10', endDate: '2026-08-09', balance: 0,      lastVisit: '2026-03-01', gender: 'Male',   avatarColor: 'red',    accessCode: '3741', regFeeDate: '2025-02-10' },
  { id: 'GEM-0473', firstName: 'Miriam',    lastName: 'Essomba',   phone: '+237 655 620 881', email: 'miriam.e@gmail.com',    package: 'Basic Monthly',  status: 'suspended',   startDate: '2025-03-15', endDate: '2026-03-14', balance: 5000,   lastVisit: '2026-02-20', gender: 'Female', avatarColor: 'purple', accessCode: '8102', regFeeDate: '2025-03-15' },

  // ── Frozen ───────────────────────────────────────────────────────────────────
  { id: 'GEM-0577', firstName: 'Bertrand',  lastName: 'Fotso',     phone: '+237 699 111 222', email: 'bertrand.f@gmail.com',  package: 'Premium 12M',    status: 'frozen',      startDate: '2025-06-01', endDate: '2026-08-31', balance: 0,      lastVisit: '2026-02-10', gender: 'Male',   avatarColor: 'blue',   accessCode: '1144', regFeeDate: '2025-06-01', freezeStartDate: '2026-03-01', preFreezEndDate: '2026-07-31' },
  { id: 'GEM-0622', firstName: 'Ingrid',    lastName: 'Mbia',      phone: '+237 655 333 444', email: 'ingrid.m@gmail.com',    package: 'Standard 6M',    status: 'frozen',      startDate: '2025-12-01', endDate: '2026-06-30', balance: 0,      lastVisit: '2026-01-20', gender: 'Female', avatarColor: 'purple', accessCode: '7756', regFeeDate: '2025-12-01', freezeStartDate: '2026-03-15', preFreezEndDate: '2026-06-15' },
  { id: 'GEM-0690', firstName: 'Rodrigue',  lastName: 'Tamko',     phone: '+237 677 555 666', email: 'rodrigue.t@gmail.com',  package: 'Basic Monthly',  status: 'frozen',      startDate: '2026-01-10', endDate: '2026-04-10', balance: 0,      lastVisit: '2026-02-28', gender: 'Male',   avatarColor: 'gold',   accessCode: '4483', regFeeDate: '2026-01-10', freezeStartDate: '2026-03-20', preFreezEndDate: '2026-03-31' },

  // ── Expired ───────────────────────────────────────────────────────────────────
  { id: 'GEM-0312', firstName: 'René',      lastName: 'Nguimkeu',  phone: '+237 655 789 012', email: 'rene.n@gmail.com',      package: 'Premium 12M',    status: 'expired',     startDate: '2025-02-01', endDate: '2026-01-31', balance: 360000, lastVisit: '2026-01-28', gender: 'Male',   avatarColor: 'blue',   accessCode: '9245', regFeeDate: '2025-02-01' },
  { id: 'GEM-0284', firstName: 'Sandrine',  lastName: 'Ebelle',    phone: '+237 699 777 888', email: 'sandrine.e@gmail.com',  package: 'Standard 6M',    status: 'expired',     startDate: '2025-07-01', endDate: '2025-12-31', balance: 75000,  lastVisit: '2025-12-30', gender: 'Female', avatarColor: 'red',    accessCode: '2267', regFeeDate: '2025-07-01' },
  { id: 'GEM-0193', firstName: 'Blaise',    lastName: 'Onana',     phone: '+237 655 999 000', email: 'blaise.o@gmail.com',    package: 'Basic Monthly',  status: 'expired',     startDate: '2025-11-15', endDate: '2025-12-14', balance: 15000,  lastVisit: '2025-12-12', gender: 'Male',   avatarColor: 'green',  accessCode: '8839', regFeeDate: '2025-11-15' },
  { id: 'GEM-0447', firstName: 'Flore',     lastName: 'Mezajou',   phone: '+237 677 112 334', email: 'flore.m@gmail.com',     package: 'Student Monthly', status: 'expired',     startDate: '2025-09-01', endDate: '2025-09-30', balance: 10000,  lastVisit: '2025-09-29', gender: 'Female', avatarColor: 'gold',   accessCode: '5501', regFeeDate: '2025-09-01' },

  // ── Deactivated ───────────────────────────────────────────────────────────────
  { id: 'GEM-0158', firstName: 'Cyrille',   lastName: 'Manga',     phone: '+237 699 221 443', email: 'cyrille.m@gmail.com',   package: 'Premium 12M',    status: 'deactivated', startDate: '2024-05-01', endDate: '2025-04-30', balance: 0,      lastVisit: '2025-03-15', gender: 'Male',   avatarColor: 'purple', accessCode: '3362', regFeeDate: '2024-05-01' },
  { id: 'GEM-0267', firstName: 'Annette',   lastName: 'Nkouaga',   phone: '+237 655 443 221', email: 'annette.n@gmail.com',   package: 'Standard 6M',    status: 'deactivated', startDate: '2024-08-01', endDate: '2025-01-31', balance: 0,      lastVisit: '2024-12-20', gender: 'Female', avatarColor: 'blue',   accessCode: '9918', regFeeDate: '2024-08-01' },
  { id: 'GEM-0331', firstName: 'Fabrice',   lastName: 'Lekene',    phone: '+237 677 664 882', email: 'fabrice.l@gmail.com',   package: 'Basic Monthly',  status: 'deactivated', startDate: '2024-10-01', endDate: '2024-10-31', balance: 0,      lastVisit: '2024-10-28', gender: 'Male',   avatarColor: 'red',    accessCode: '7745', regFeeDate: '2024-10-01' },

  // ── Visitors ──────────────────────────────────────────────────────────────────
  { id: 'GEM-0455', firstName: 'Dieudonne', lastName: 'Wamba',     phone: '+237 677 567 890', email: 'dieudonne.w@gmail.com', package: 'Visitor Pass',   status: 'visitor',     startDate: '2026-03-22', endDate: null,         balance: 0,      lastVisit: '2026-03-23', gender: 'Male',   avatarColor: 'purple', accessCode: '3856', passesTotal: 5, passesRemaining: 3 },
  { id: 'GEM-V101', firstName: 'Joëlle',    lastName: 'Abanda',    phone: '+237 655 881 772', email: 'joelle.a@gmail.com',    package: 'Visitor Pass',   status: 'visitor',     startDate: '2026-03-24', endDate: null,         balance: 0,      lastVisit: '2026-03-24', gender: 'Female', avatarColor: 'green',  accessCode: '1190', passesTotal: 5, passesRemaining: 5 },
  { id: 'GEM-V102', firstName: 'Kevin',     lastName: 'Simo',      phone: '+237 699 334 556', email: 'kevin.s@gmail.com',     package: 'Visitor Pass',   status: 'visitor',     startDate: '2026-03-23', endDate: null,         balance: 0,      lastVisit: '2026-03-23', gender: 'Male',   avatarColor: 'gold',   accessCode: '6623', passesTotal: 3, passesRemaining: 1 },
];

export const recentCheckins = [
  { memberId: 'GEM-0342', time: '09:42 AM', type: 'Member' },
  { memberId: 'GEM-0518', time: '09:38 AM', type: 'Member' },
  { memberId: 'GEM-0201', time: '09:31 AM', type: 'Member' },
  { memberId: 'GEM-0729', time: '09:15 AM', type: 'Member' },
  { memberId: 'GEM-0455', time: '09:02 AM', type: 'Visitor' },
];

export const recentPayments = [
  { memberId: 'GEM-0342', description: 'Premium 12M Renewal', method: 'Card', amount: 130000 },
  { memberId: 'GEM-0201', description: 'Personal Training (4x)', method: 'Cash', amount: 100000 },
  { memberId: 'GEM-0518', description: 'Protein Shake (x2)', method: 'Card', amount: 5400 },
];

export const todayEvents = [
  { id: 1, title: 'HIIT Group Class', time: '10:00', duration: '60 min', instructor: 'Claude Nkemeni', location: 'Studio A', spots: 18, color: 'gold' },
  { id: 2, title: 'Yoga Foundations', time: '14:00', duration: '45 min', instructor: 'Marie Samba', location: 'Studio B', spots: 12, color: 'blue' },
  { id: 3, title: 'Strength Training', time: '17:30', duration: '60 min', instructor: 'Michel Roko', location: 'Weight Room', spots: 8, color: 'green' },
];

export const notifications = [
  { id: 1, text: '5 memberships expiring this week', time: '10 min ago', unread: true, type: 'membership' },
  { id: 2, text: 'Low stock: Whey Protein (3 remaining)', time: '1 hour ago', unread: true, type: 'inventory' },
  { id: 3, text: 'Task "Fix AC Unit" is overdue', time: '3 hours ago', unread: false, type: 'task' },
  { id: 4, text: 'New signup: Esther Kouam registered', time: 'Yesterday', unread: false, type: 'signup' },
];

export const tasks = [
  { id: 1, title: 'Fix AC Unit in Studio A', description: 'AC not cooling properly', assignedTo: 'Michel Roko', dueDate: '2026-03-22', priority: 'High', status: 'Overdue', createdBy: 'Marvin Ekokobe' },
  { id: 2, title: 'Order new towels', description: 'Running low on gym towels', assignedTo: 'Sandrine Kom', dueDate: '2026-03-25', priority: 'Medium', status: 'Pending', createdBy: 'Marvin Ekokobe' },
  { id: 3, title: 'Update class schedule for April', description: 'New instructors joining', assignedTo: 'Marvin Ekokobe', dueDate: '2026-03-28', priority: 'Medium', status: 'In Progress', createdBy: 'Marvin Ekokobe' },
  { id: 4, title: 'Clean and sanitize weight room', description: 'Deep clean needed', assignedTo: 'Claude Nkemeni', dueDate: '2026-03-23', priority: 'Low', status: 'Pending', createdBy: 'Michel Roko' },
  { id: 5, title: 'Follow up with expired members', description: 'Call members whose memberships expired this month', assignedTo: 'Marie Samba', dueDate: '2026-03-26', priority: 'High', status: 'Pending', createdBy: 'Marvin Ekokobe' },
];

export const products = [
  { id: 1, name: 'Whey Protein (1kg)', code: 'PRD-001', category: 'Supplements', price: 13500, quantity: 3, status: 'active' },
  { id: 2, name: 'Water Bottle', code: 'PRD-002', category: 'Accessories', price: 600, quantity: 120, status: 'active' },
  { id: 3, name: 'Protein Bar', code: 'PRD-003', category: 'Snacks', price: 1200, quantity: 48, status: 'active' },
  { id: 4, name: 'Gym Gloves', code: 'PRD-004', category: 'Accessories', price: 5400, quantity: 15, status: 'active' },
  { id: 5, name: 'Energy Drink', code: 'PRD-005', category: 'Drinks', price: 1050, quantity: 60, status: 'active' },
];

export const packages = [
  { id: 1, name: 'Basic Monthly',   code: 'PKG-BM',  price: 15000,  minPayment: 7500,  duration: '1 Month',   sessions: 'Unlimited', access: 'Gym Floor',              status: 'active' },
  { id: 2, name: 'Standard 6M',     code: 'PKG-S6',  price: 75000,  minPayment: 25000, duration: '6 Months',  sessions: 'Unlimited', access: 'Full Access',             status: 'active' },
  { id: 3, name: 'Premium 12M',     code: 'PKG-P12', price: 130000, minPayment: 50000, duration: '12 Months', sessions: 'Unlimited', access: 'Full Access + Classes',   status: 'active' },
  { id: 4, name: 'Visitor Pass',    code: 'PKG-VP',  price: 5000,   minPayment: 5000,  duration: '1 Day',     sessions: '1',         access: 'Gym Floor',              status: 'active' },
  { id: 5, name: 'Student Monthly', code: 'PKG-SM',  price: 10000,  minPayment: 5000,  duration: '1 Month',   sessions: 'Unlimited', access: 'Gym Floor',              status: 'active' },
];

export const staff = [
  { id: 1, name: 'Marvin Ekokobe', phone: '+237 699 100 001', email: 'jean@gemgym.cm',     role: 'Manager',    department: 'Management', status: 'active', joinDate: '2024-01-15', accessCode: '9721', shiftStart: '08:00' },
  { id: 2, name: 'Michel Roko',    phone: '+237 677 100 002', email: 'michel@gemgym.cm',   role: 'Trainer',    department: 'Fitness',    status: 'active', joinDate: '2024-06-01', accessCode: '3847', shiftStart: '07:30' },
  { id: 3, name: 'Sandrine Kom',   phone: '+237 655 100 003', email: 'sandrine@gemgym.cm', role: 'Front Desk', department: 'Operations', status: 'active', joinDate: '2025-02-15', accessCode: '5163', shiftStart: '08:00' },
  { id: 4, name: 'Claude Nkemeni', phone: '+237 699 100 004', email: 'claude@gemgym.cm',   role: 'Instructor', department: 'Fitness',    status: 'active', joinDate: '2024-09-01', accessCode: '7429', shiftStart: '09:00' },
  { id: 5, name: 'Marie Samba',    phone: '+237 677 100 005', email: 'marie@gemgym.cm',    role: 'Instructor', department: 'Fitness',    status: 'active', joinDate: '2025-01-10', accessCode: '2856', shiftStart: '10:00' },
];

export const expenses = [
  { id: 1, title: 'Electricity Bill', category: 'Utilities', amount: 260000, date: '2026-03-15', paidTo: 'ENEO Cameroun', method: 'Bank Transfer' },
  { id: 2, title: 'Cleaning Supplies', category: 'Maintenance', amount: 37000, date: '2026-03-18', paidTo: 'NettoyCam', method: 'Card' },
  { id: 3, title: 'Equipment Repair', category: 'Maintenance', amount: 105000, date: '2026-03-20', paidTo: 'SportFix Cameroun', method: 'Cash' },
];

// Visitor session bundles — charged per session, cheaper per session as qty grows
export const visitorSessionPackages = [
  { id: 'vs-1',  sessions: 1,  pricePerSession: 3500, totalPrice: 3500,  label: '1 Session',   status: 'active' },
  { id: 'vs-2',  sessions: 3,  pricePerSession: 3000, totalPrice: 9000,  label: '3 Sessions',  status: 'active' },
  { id: 'vs-5',  sessions: 5,  pricePerSession: 2800, totalPrice: 14000, label: '5 Sessions',  status: 'active' },
  { id: 'vs-10', sessions: 10, pricePerSession: 2500, totalPrice: 25000, label: '10 Sessions', status: 'active' },
  { id: 'vs-20', sessions: 20, pricePerSession: 2000, totalPrice: 40000, label: '20 Sessions', status: 'active' },
];

export const equipmentIssues = [
  { id: 1, equipment: 'Treadmill #3', location: 'Cardio Zone', severity: 'High',   status: 'Open',        reportedBy: 'Sandrine Kom',   date: '2026-04-18', description: 'Belt slipping and making loud noise during use.' },
  { id: 2, equipment: 'AC Unit – Studio A', location: 'Studio A', severity: 'High',   status: 'In Progress', reportedBy: 'Claude Nkemeni', date: '2026-04-17', description: 'AC not cooling properly. Room temperature is too high during classes.' },
  { id: 3, equipment: 'Barbell (20kg)', location: 'Weight Room', severity: 'Medium', status: 'Open',        reportedBy: 'Michel Roko',    date: '2026-04-19', description: 'Collar locking mechanism is loose. Needs replacement.' },
  { id: 4, equipment: 'Locker #14', location: 'Changing Room', severity: 'Low',    status: 'Resolved',    reportedBy: 'Sandrine Kom',   date: '2026-04-15', description: 'Lock was jammed. Fixed with lubricant.' },
  { id: 5, equipment: 'Rowing Machine #1', location: 'Cardio Zone', severity: 'Medium', status: 'Open',     reportedBy: 'Sandrine Kom',   date: '2026-04-20', description: 'Display screen not responding. Resistance levels still work.' },
];

const _sessionMembers = [];
export function addSessionMember(member) { _sessionMembers.push(member); }
export const getMemberById = (id) => members.find(m => m.id === id) || _sessionMembers.find(m => m.id === id) || null;

// Computes the real effective status for a member, accounting for reg fee suspension.
// Use this everywhere instead of reading m.status directly for display/filtering.
export function getEffectiveStatus(member, gym) {
  if (!gym || !gym.registrationFeeRequired || gym.registrationFeeFrequency !== 'yearly') return member.status;
  if (!member.regFeeDate) return member.status;
  // Visitors and already-inactive statuses are unaffected
  if (['visitor', 'deactivated', 'expired', 'suspended'].includes(member.status)) return member.status;
  const paid = new Date(member.regFeeDate + 'T00:00:00');
  const due  = new Date(paid); due.setFullYear(due.getFullYear() + 1);
  const suspend = new Date(due); suspend.setDate(suspend.getDate() + (gym.registrationGracePeriodDays || 0));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (today >= suspend) return 'suspended';
  return member.status;
}

// ── Staff Time Cards ──────────────────────────────────────────────────────────
// Generated punch-in / punch-out records for every working day in March 2026.
// Working days: Mon–Sat (gym closed Sundays).
function _buildTimeCards() {
  const days = [
    '2026-03-02','2026-03-03','2026-03-04','2026-03-05','2026-03-06','2026-03-07',
    '2026-03-09','2026-03-10','2026-03-11','2026-03-12','2026-03-13','2026-03-14',
    '2026-03-16','2026-03-17','2026-03-18','2026-03-19','2026-03-20','2026-03-21',
    '2026-03-23','2026-03-24','2026-03-25','2026-03-26','2026-03-27','2026-03-28',
  ];
  const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Mon','Tue','Wed','Thu','Fri','Sat','Mon','Tue','Wed','Thu','Fri','Sat','Mon','Tue','Wed','Thu','Fri','Sat'];
  // minutes offset from shift start (in) and minutes of extra work beyond 8 h (out)
  const inOff  = [2, -3, 5, 0, 8, 3, -2, 6, 1, 4, -5, 7, 3, 0, 10, -4, 2, 5, 8, -1, 3, 6, 0, 4];
  const outOff = [0,  30, 15, 45, 0, 20, 60, 0, 30, 45, 15, 0, 20, 60, 30, 0, 45, 10, 0, 30, 20, 45, 15, 60];
  const profiles = [
    { staffId: 1, name: 'Marvin Ekokobe',  baseIn: '08:00', absent: ['2026-03-07','2026-03-21'] },
    { staffId: 2, name: 'Michel Roko',     baseIn: '07:30', absent: ['2026-03-14','2026-03-28'] },
    { staffId: 3, name: 'Sandrine Kom',    baseIn: '08:00', absent: ['2026-03-19','2026-03-20'] },
    { staffId: 4, name: 'Claude Nkemeni',  baseIn: '09:00', absent: ['2026-03-07'] },
    { staffId: 5, name: 'Marie Samba',     baseIn: '10:00', absent: ['2026-03-14'] },
  ];
  let id = 1;
  const cards = [];
  const fmt2 = n => String(n).padStart(2, '0');
  profiles.forEach(p => {
    const [bh, bm] = p.baseIn.split(':').map(Number);
    days.forEach((date, i) => {
      if (p.absent.includes(date)) return;
      const inMin  = bh * 60 + bm + inOff[i];
      const outMin = inMin + 480 + outOff[i];
      const hours  = Number(((outMin - inMin) / 60).toFixed(2));
      cards.push({
        id: id++,
        staffId: p.staffId,
        staffName: p.name,
        date,
        dayName: dayNames[i],
        punchIn:  `${fmt2(Math.floor(inMin  / 60))}:${fmt2(inMin  % 60)}`,
        punchOut: `${fmt2(Math.floor(outMin / 60))}:${fmt2(outMin % 60)}`,
        hoursWorked: hours,
        regularHours: Math.min(8, hours),
        overtimeHours: Math.max(0, Number((hours - 8).toFixed(2))),
      });
    });
  });
  return cards;
}
export const staffTimeCards = _buildTimeCards();

// Owner-only authorization audit log — persists in memory for this session
export const managerAuthLog = [];
export const getInitials = (firstName, lastName) => `${firstName[0]}${lastName[0]}`;

export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

export const formatMoney = (amount) => {
  return `${Math.round(Number(amount)).toLocaleString('fr-FR')} FCFA`;
};

export const avatarColors = {
  gold: { bg: 'var(--accent-gold-dim)', color: 'var(--accent-gold)' },
  blue: { bg: 'var(--accent-blue-dim)', color: 'var(--accent-blue)' },
  green: { bg: 'var(--accent-green-dim)', color: 'var(--accent-green)' },
  red: { bg: 'var(--accent-red-dim)', color: 'var(--accent-red)' },
  purple: { bg: 'var(--accent-purple-dim)', color: 'var(--accent-purple)' },
};

// All navigable route keys used for permission filtering
export const ALL_PAGES = ['dashboard','members','attendance','calendar','front-desk','tasks','sales','operations','payments','accounting','packages','communication','staff','settings'];

export const ROLE_PROFILES = [
  { id: 'general_manager', name: 'General Manager', color: '#c9a96e', pages: ['dashboard','members','attendance','calendar','front-desk','tasks','sales','operations','payments','accounting','packages','communication','staff','settings'] },
  { id: 'manager',         name: 'Manager',         color: '#60a5fa', pages: ['dashboard','members','attendance','calendar','front-desk','tasks','sales','operations','payments','accounting','packages','communication','staff','settings'] },
  { id: 'accountant',      name: 'Accountant',      color: '#34d399', pages: ['dashboard','payments','accounting'] },
  { id: 'front_desk',      name: 'Front Desk',      color: '#f59e0b', pages: ['dashboard','members','attendance','front-desk','tasks'] },
  { id: 'coach',           name: 'Coach',           color: '#a78bfa', pages: ['dashboard','attendance','calendar','tasks'] },
  { id: 'instructor',      name: 'Instructor',      color: '#818cf8', pages: ['dashboard','calendar','tasks'] },
  { id: 'trainer',         name: 'Trainer',         color: '#fb923c', pages: ['dashboard','members','attendance','calendar','tasks'] },
];

