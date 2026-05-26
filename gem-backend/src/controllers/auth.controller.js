const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

function generateAccessCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function register(req, res) {
  const { gymCode, gymName, location, phone, email: gymEmail, firstName, lastName, email, password } = req.body;
  if (!gymCode || !gymName || !firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'gymCode, gymName, firstName, lastName, email, and password are required' });
  }

  const existing = await prisma.gym.findUnique({ where: { code: gymCode.toLowerCase() } });
  if (existing) return res.status(409).json({ error: 'Gym code already taken' });

  const passwordHash = await bcrypt.hash(password, 10);

  const gym = await prisma.gym.create({
    data: {
      code: gymCode.toLowerCase(),
      name: gymName,
      location,
      phone,
      email: gymEmail,
      staff: {
        create: {
          firstName,
          lastName,
          email,
          passwordHash,
          role: 'general_manager',
          avatarColor: '#c9a96e',
          accessCode: generateAccessCode(),
        },
      },
    },
    include: { staff: true },
  });

  const owner = gym.staff[0];
  const token = jwt.sign(
    { id: owner.id, gymId: gym.id, role: owner.role, email: owner.email },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.status(201).json({
    token,
    user: {
      id: owner.id,
      firstName: owner.firstName,
      lastName: owner.lastName,
      email: owner.email,
      role: owner.role,
      gymId: gym.id,
      gymCode: gym.code,
      gymName: gym.name,
    },
  });
}

async function login(req, res) {
  const { gymCode, email, password } = req.body;
  if (!gymCode || !email || !password) {
    return res.status(400).json({ error: 'gymCode, email and password are required' });
  }

  const gym = await prisma.gym.findUnique({ where: { code: gymCode } });
  if (!gym) return res.status(404).json({ error: 'Gym not found' });

  const staff = await prisma.staff.findFirst({
    where: { gymId: gym.id, email, isActive: true },
  });
  if (!staff) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, staff.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { id: staff.id, gymId: gym.id, role: staff.role, email: staff.email },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    user: {
      id: staff.id,
      firstName: staff.firstName,
      lastName: staff.lastName,
      email: staff.email,
      role: staff.role,
      gymId: gym.id,
      gymCode: gym.code,
      gymName: gym.name,
    },
  });
}

async function me(req, res) {
  const staff = await prisma.staff.findUnique({
    where: { id: req.user.id },
    select: {
      id: true, firstName: true, lastName: true,
      email: true, role: true, gymId: true, avatarColor: true,
      gym: { select: { code: true, name: true } },
    },
  });
  if (!staff) return res.status(404).json({ error: 'User not found' });
  res.json(staff);
}

async function verifyManager(req, res) {
  const { password } = req.body;
  if (!password) return res.status(400).json({ authorized: false, error: 'Password required' });

  const managerRoles = ['manager', 'general_manager'];
  if (!managerRoles.includes(req.user.role)) {
    return res.status(403).json({ authorized: false, error: 'Only managers can authorize this action' });
  }

  const staff = await prisma.staff.findUnique({
    where: { id: req.user.id },
    select: { passwordHash: true },
  });
  if (!staff) return res.status(404).json({ authorized: false });

  const valid = await bcrypt.compare(password, staff.passwordHash);
  res.json({ authorized: valid });
}

module.exports = { register, login, me, verifyManager };
