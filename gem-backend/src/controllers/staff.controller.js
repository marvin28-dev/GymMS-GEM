const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');

function generateAccessCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

const ROLE_MAP = {
  Manager: 'manager', Trainer: 'trainer', Instructor: 'instructor',
  'Front Desk': 'front_desk', Receptionist: 'front_desk', Other: 'coach',
};

function normalizeRole(role) {
  return ROLE_MAP[role] || role;
}

async function getAll(req, res) {
  const staff = await prisma.staff.findMany({
    where: { gymId: req.user.gymId },
    select: {
      id: true, firstName: true, lastName: true,
      email: true, phone: true, role: true,
      department: true, schedule: true, avatarColor: true, photo: true, photoId: true, isActive: true, createdAt: true,
      accessCode: true, salary: true,
    },
    orderBy: { firstName: 'asc' },
  });
  res.json(staff);
}

async function getOne(req, res) {
  // Fetch base fields via Prisma (always safe regardless of client version)
  const staff = await prisma.staff.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
    select: {
      id: true, firstName: true, lastName: true,
      email: true, phone: true, role: true,
      department: true, joinDate: true, shiftStart: true,
      accessCode: true, avatarColor: true, photo: true, photoId: true, isActive: true, createdAt: true,
      schedule: true, salary: true,
    },
  });
  if (!staff) return res.status(404).json({ error: 'Staff not found' });

  // Fetch emergency contact via raw SQL so it works even with a stale Prisma client
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT "emergencyContact", "emergencyPhone" FROM "Staff" WHERE "id" = $1`,
      req.params.id,
    );
    if (rows[0]) {
      staff.emergencyContact = rows[0].emergencyContact;
      staff.emergencyPhone = rows[0].emergencyPhone;
    }
  } catch (_) {
    // Column doesn't exist yet — migration not applied, just omit the fields
  }

  res.json(staff);
}

async function create(req, res) {
  const { password, role, emergencyContact, emergencyPhone, salary, ...rest } = req.body;
  const passwordHash = await bcrypt.hash(password || `GEM${Date.now()}`, 10);
  let staff;
  try {
    staff = await prisma.staff.create({
      data: {
        ...rest,
        role: normalizeRole(role),
        gymId: req.user.gymId,
        passwordHash,
        accessCode: generateAccessCode(),
        salary: salary !== undefined && salary !== '' && salary !== null ? parseFloat(salary) : null,
      },
      select: {
        id: true, firstName: true, lastName: true,
        email: true, phone: true, role: true,
        avatarColor: true, photo: true, photoId: true, isActive: true, createdAt: true, salary: true,
      },
    });
  } catch (err) {
    console.error('Staff create failed:', err.message);
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A staff member with this email already exists.' });
    }
    return res.status(500).json({ error: 'Failed to create staff', detail: err.message });
  }

  if (emergencyContact !== undefined || emergencyPhone !== undefined) {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "Staff" SET "emergencyContact" = $1, "emergencyPhone" = $2 WHERE "id" = $3`,
        emergencyContact ?? null,
        emergencyPhone ?? null,
        staff.id,
      );
      staff.emergencyContact = emergencyContact ?? null;
      staff.emergencyPhone = emergencyPhone ?? null;
    } catch (rawErr) {
      console.error('Emergency contact raw insert failed:', rawErr.message);
    }
  }

  res.status(201).json(staff);
}

async function update(req, res) {
  const existing = await prisma.staff.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Staff not found' });

  const {
    password, role, firstName, lastName, email, phone,
    department, joinDate, shiftStart, avatarColor, photo, isActive,
    emergencyContact, emergencyPhone, schedule, salary,
  } = req.body;

  const data = {};
  if (firstName !== undefined) data.firstName = firstName;
  if (lastName !== undefined) data.lastName = lastName;
  if (email !== undefined) data.email = email;
  if (phone !== undefined) data.phone = phone;
  if (department !== undefined) data.department = department;
  if (joinDate !== undefined) data.joinDate = joinDate ? new Date(joinDate) : null;
  if (shiftStart !== undefined) data.shiftStart = shiftStart;
  if (avatarColor !== undefined) data.avatarColor = avatarColor;
  if (photo !== undefined) data.photo = photo;
  if (req.body.photoId !== undefined) data.photoId = req.body.photoId;
  if (isActive !== undefined) data.isActive = isActive;
  if (schedule !== undefined) data.schedule = schedule;
  if (salary !== undefined) data.salary = salary !== '' && salary !== null ? parseFloat(salary) : null;
  if (emergencyContact !== undefined) data.emergencyContact = emergencyContact;
  if (emergencyPhone !== undefined) data.emergencyPhone = emergencyPhone;
  if (role) data.role = normalizeRole(role);
  if (password) data.passwordHash = await bcrypt.hash(password, 10);

  // Remove emergency fields from the Prisma update — handle them via raw SQL
  // so a stale Prisma client can't block or silently drop them
  const prismaData = { ...data };
  delete prismaData.emergencyContact;
  delete prismaData.emergencyPhone;

  let staff;
  try {
    staff = await prisma.staff.update({
      where: { id: req.params.id },
      data: prismaData,
      select: {
        id: true, firstName: true, lastName: true,
        email: true, phone: true, role: true,
        department: true, joinDate: true, shiftStart: true,
        avatarColor: true, photo: true, photoId: true, isActive: true, salary: true,
      },
    });
  } catch (err) {
    console.error('Staff update failed:', err.message);
    return res.status(500).json({ error: 'Failed to update staff' });
  }

  // Save emergency contact via raw SQL — bypasses Prisma client schema validation
  if (emergencyContact !== undefined || emergencyPhone !== undefined) {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "Staff" SET "emergencyContact" = $1, "emergencyPhone" = $2 WHERE "id" = $3`,
        emergencyContact ?? null,
        emergencyPhone ?? null,
        req.params.id,
      );
      staff.emergencyContact = emergencyContact ?? null;
      staff.emergencyPhone = emergencyPhone ?? null;
    } catch (rawErr) {
      console.error('Emergency contact raw update failed:', rawErr.message);
    }
  }

  res.json(staff);
}

async function remove(req, res) {
  const existing = await prisma.staff.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Staff not found' });

  await prisma.staff.update({
    where: { id: req.params.id },
    data: { isActive: false },
  });
  res.json({ message: 'Staff deactivated' });
}

async function getCode(req, res) {
  const managerRoles = ['general_manager', 'manager'];
  if (!managerRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Only managers can view access codes' });
  }

  let staff = await prisma.staff.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
    select: { id: true, accessCode: true },
  });
  if (!staff) return res.status(404).json({ error: 'Staff not found' });

  if (!staff.accessCode) {
    staff = await prisma.staff.update({
      where: { id: req.params.id },
      data: { accessCode: generateAccessCode() },
      select: { id: true, accessCode: true },
    });
  }

  res.json({ accessCode: staff.accessCode });
}

module.exports = { getAll, getOne, create, update, remove, getCode };
