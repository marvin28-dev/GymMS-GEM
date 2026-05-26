const prisma = require('../utils/prisma');

async function generateAccessCode(gymId) {
  let attempts = 0;
  while (attempts < 50) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const taken = await prisma.member.findFirst({ where: { gymId, accessCode: code } });
    if (!taken) return code;
    attempts++;
  }
  // Fallback to 6-digit if 4-digit space is crowded
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function generateMemberCode(gymId) {
  // Count globally to avoid collisions across gyms (memberCode is globally unique)
  const count = await prisma.member.count();
  let code = `GEM-${String(count + 1).padStart(4, '0')}`;
  // Retry if code is taken (race condition / collision safety)
  let attempts = 0;
  while (attempts < 20) {
    const taken = await prisma.member.findUnique({ where: { memberCode: code } });
    if (!taken) break;
    attempts++;
    code = `GEM-${String(count + 1 + attempts).padStart(4, '0')}`;
  }
  return code;
}

async function getAll(req, res) {
  const { status } = req.query;
  const where = { gymId: req.user.gymId };
  if (status) where.status = status;

  const members = await prisma.member.findMany({
    where,
    include: { package: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // active/expiring → pending when startDate is still in the future (catches members created before this logic existed)
  const toPending = members.filter(
    m => ['active', 'expiring'].includes(m.status) && !m.isVisitor && m.startDate && new Date(m.startDate) > now,
  );

  // pending → active when startDate has passed
  const toActivate = members.filter(
    m => m.status === 'pending' && m.startDate && new Date(m.startDate) <= now,
  );

  // active/expiring members whose endDate has passed → expired
  const toExpire = members.filter(
    m => ['active', 'expiring'].includes(m.status) && !m.isVisitor && m.endDate && new Date(m.endDate) < now
      && !(m.startDate && new Date(m.startDate) > now), // don't expire pending-to-be members
  );

  // active members with endDate within 7 days → expiring
  const toExpiringSoon = members.filter(
    m => m.status === 'active' && !m.isVisitor && m.endDate && new Date(m.endDate) >= now && new Date(m.endDate) <= in7Days
      && !(m.startDate && new Date(m.startDate) > now),
  );

  // expiring members whose endDate is now more than 7 days away → back to active
  const toBackActive = members.filter(
    m => m.status === 'expiring' && !m.isVisitor && m.endDate && new Date(m.endDate) > in7Days
      && !(m.startDate && new Date(m.startDate) > now),
  );

  const updates = [
    toPending.length      && prisma.member.updateMany({ where: { id: { in: toPending.map(m => m.id) } },       data: { status: 'pending' } }),
    toActivate.length     && prisma.member.updateMany({ where: { id: { in: toActivate.map(m => m.id) } },      data: { status: 'active' } }),
    toExpire.length       && prisma.member.updateMany({ where: { id: { in: toExpire.map(m => m.id) } },        data: { status: 'expired' } }),
    toExpiringSoon.length && prisma.member.updateMany({ where: { id: { in: toExpiringSoon.map(m => m.id) } },  data: { status: 'expiring' } }),
    toBackActive.length   && prisma.member.updateMany({ where: { id: { in: toBackActive.map(m => m.id) } },    data: { status: 'active' } }),
  ].filter(Boolean);

  if (updates.length > 0) await Promise.all(updates);

  toPending.forEach(m => { m.status = 'pending'; });
  toActivate.forEach(m => { m.status = 'active'; });
  toExpire.forEach(m => { m.status = 'expired'; });
  toExpiringSoon.forEach(m => { m.status = 'expiring'; });
  toBackActive.forEach(m => { m.status = 'active'; });

  res.json(members);
}

async function getOne(req, res) {
  const member = await prisma.member.findFirst({
    where: {
      gymId: req.user.gymId,
      OR: [{ id: req.params.id }, { memberCode: req.params.id }],
    },
    include: {
      package: true,
      payments:    { orderBy: { createdAt: 'desc' }, take: 20, include: { staff: { select: { id: true, firstName: true, lastName: true } } } },
      attendances: { orderBy: { checkIn:  'desc' }, take: 20, include: { staff: { select: { id: true, firstName: true, lastName: true } } } },
    },
  });
  if (!member) return res.status(404).json({ error: 'Member not found' });

  // Correct status based on dates
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  let correctedStatus = member.status;
  if (['active', 'expiring'].includes(member.status) && !member.isVisitor && member.startDate && new Date(member.startDate) > now) {
    correctedStatus = 'pending';
  } else if (member.status === 'pending' && member.startDate && new Date(member.startDate) <= now) {
    correctedStatus = 'active';
  } else if (['active', 'expiring'].includes(member.status) && !member.isVisitor && member.endDate && new Date(member.endDate) < now) {
    correctedStatus = 'expired';
  } else if (member.status === 'active' && !member.isVisitor && member.endDate && new Date(member.endDate) >= now && new Date(member.endDate) <= in7Days) {
    correctedStatus = 'expiring';
  } else if (member.status === 'expiring' && !member.isVisitor && member.endDate && new Date(member.endDate) > in7Days) {
    correctedStatus = 'active';
  }
  if (correctedStatus !== member.status) {
    await prisma.member.update({ where: { id: member.id }, data: { status: correctedStatus } });
    member.status = correctedStatus;
  }

  res.json(member);
}

async function create(req, res) {
  const {
    firstName, lastName, phone, email, gender, avatarColor, photo,
    accessCode, packageId, status, startDate, endDate, balance,
    regFeeDate, freezeStartDate, preFreezEndDate, passesTotal,
    passesRemaining, isVisitor,
    dob, houseNumber, street, city, postalCode,
    emergencyContact, emergencyPhone,
    howHeard, notes,
  } = req.body;

  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'firstName and lastName are required' });
  }

  // Validate packageId exists if provided
  if (packageId) {
    const pkg = await prisma.package.findFirst({ where: { id: packageId, gymId: req.user.gymId } });
    if (!pkg) return res.status(400).json({ error: 'Package not found' });
  }

  // Check email uniqueness within gym
  if (email && email.trim()) {
    const emailTaken = await prisma.member.findFirst({ where: { gymId: req.user.gymId, email: email.trim() } });
    if (emailTaken) return res.status(409).json({ error: 'A member with this email already exists' });
  }

  const memberCode = await generateMemberCode(req.user.gymId);
  const finalAccessCode = accessCode?.trim() || await generateAccessCode(req.user.gymId);

  const member = await prisma.member.create({
    data: {
      gymId: req.user.gymId,
      memberCode,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone?.trim() || undefined,
      email: email?.trim() || undefined,
      gender: gender || undefined,
      avatarColor: avatarColor || undefined,
      photo: photo || undefined,
      accessCode: finalAccessCode,
      packageId: packageId || undefined,
      status: status || (startDate && new Date(startDate) > new Date() ? 'pending' : 'active'),
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      balance: Number(balance) || 0,
      regFeeDate: regFeeDate ? new Date(regFeeDate) : undefined,
      freezeStartDate: freezeStartDate ? new Date(freezeStartDate) : undefined,
      preFreezEndDate: preFreezEndDate ? new Date(preFreezEndDate) : undefined,
      passesTotal: passesTotal != null ? Number(passesTotal) : undefined,
      passesRemaining: passesRemaining != null ? Number(passesRemaining) : undefined,
      isVisitor: isVisitor ?? false,
      dob: dob ? String(dob).slice(0, 10) : undefined,
      houseNumber: houseNumber?.trim() || undefined,
      street: street?.trim() || undefined,
      city: city?.trim() || undefined,
      postalCode: postalCode?.trim() || undefined,
      emergencyContact: emergencyContact?.trim() || undefined,
      emergencyPhone: emergencyPhone?.trim() || undefined,
      howHeard: howHeard?.trim() || undefined,
      notes: notes?.trim() || undefined,
    },
    include: { package: { select: { id: true, name: true } } },
  });
  res.status(201).json(member);
}

async function update(req, res) {
  const existing = await prisma.member.findFirst({
    where: {
      gymId: req.user.gymId,
      OR: [{ id: req.params.id }, { memberCode: req.params.id }],
    },
  });
  if (!existing) return res.status(404).json({ error: 'Member not found' });

  // Only pass fields that exist in the Prisma Member schema
  const ALLOWED_FIELDS = new Set([
    'firstName', 'lastName', 'phone', 'email', 'gender', 'avatarColor', 'photo',
    'accessCode', 'status', 'balance', 'packageId', 'isVisitor',
    'startDate', 'endDate', 'lastVisit', 'regFeeDate',
    'freezeStartDate', 'preFreezEndDate', 'passesTotal', 'passesRemaining',
    'dob', 'houseNumber', 'street', 'city', 'postalCode',
    'emergencyContact', 'emergencyPhone',
    'howHeard', 'notes',
  ]);

  const safeData = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => ALLOWED_FIELDS.has(k))
  );

  // Convert bare date strings (YYYY-MM-DD) to full ISO-8601 that Prisma requires
  const DATE_FIELDS = ['startDate', 'endDate', 'lastVisit', 'regFeeDate', 'freezeStartDate', 'preFreezEndDate'];
  for (const field of DATE_FIELDS) {
    if (safeData[field] && typeof safeData[field] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(safeData[field])) {
      safeData[field] = new Date(safeData[field] + 'T00:00:00.000Z');
    } else if (safeData[field] === '' || safeData[field] === null) {
      safeData[field] = null;
    }
  }

  const member = await prisma.member.update({
    where: { id: existing.id },
    data: safeData,
  });
  res.json(member);
}

async function remove(req, res) {
  const existing = await prisma.member.findFirst({
    where: {
      gymId: req.user.gymId,
      OR: [{ id: req.params.id }, { memberCode: req.params.id }],
    },
  });
  if (!existing) return res.status(404).json({ error: 'Member not found' });

  await prisma.member.update({
    where: { id: existing.id },
    data: { status: 'deactivated' },
  });
  res.json({ message: 'Member deactivated' });
}

module.exports = { getAll, getOne, create, update, remove };
