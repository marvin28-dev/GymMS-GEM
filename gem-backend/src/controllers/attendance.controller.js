const prisma = require('../utils/prisma');

async function getAll(req, res) {
  const { date } = req.query;
  const where = { gymId: req.user.gymId };
  if (date) {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    where.checkIn = { gte: start, lt: end };
  }
  const records = await prisma.attendance.findMany({
    where,
    include: {
      member: { select: { id: true, firstName: true, lastName: true, accessCode: true, memberCode: true, status: true, avatarColor: true, photo: true, package: { select: { name: true } } } },
      staff:  { select: { id: true, firstName: true, lastName: true, photo: true } },
    },
    orderBy: { checkIn: 'desc' },
  });
  res.json(records);
}

async function checkIn(req, res) {
  const { memberId, accessCode, note } = req.body;

  const where = { gymId: req.user.gymId };
  if (accessCode) {
    where.accessCode = accessCode;
  } else if (memberId) {
    where.OR = [{ id: memberId }, { memberCode: memberId }];
  } else {
    return res.status(400).json({ error: 'memberId or accessCode is required' });
  }

  const [member, gym] = await Promise.all([
    prisma.member.findFirst({ where }),
    prisma.gym.findUnique({ where: { id: req.user.gymId }, select: { registrationFeeRequired: true, registrationFeeFrequency: true, registrationGracePeriodDays: true } }),
  ]);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  // Correct status on the fly before check-in gate
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (['active', 'expiring'].includes(member.status) && !member.isVisitor && member.startDate && new Date(member.startDate) > now) {
    await prisma.member.update({ where: { id: member.id }, data: { status: 'pending' } });
    member.status = 'pending';
  } else if (['active', 'expiring'].includes(member.status) && !member.isVisitor && member.endDate && new Date(member.endDate) < now) {
    await prisma.member.update({ where: { id: member.id }, data: { status: 'expired' } });
    member.status = 'expired';
  } else if (member.status === 'active' && !member.isVisitor && member.endDate && new Date(member.endDate) >= now && new Date(member.endDate) <= in7Days) {
    await prisma.member.update({ where: { id: member.id }, data: { status: 'expiring' } });
    member.status = 'expiring';
  }

  if (['expired', 'deactivated'].includes(member.status)) {
    return res.status(403).json({ error: `Member is ${member.status}`, member });
  }

  // Block check-in if annual registration fee is overdue
  if (gym?.registrationFeeRequired && gym?.registrationFeeFrequency === 'yearly' && member.regFeeDate) {
    const dueDate = new Date(member.regFeeDate);
    dueDate.setFullYear(dueDate.getFullYear() + 1);
    const graceDays = gym.registrationGracePeriodDays || 0;
    const suspendDate = new Date(dueDate);
    suspendDate.setDate(suspendDate.getDate() + graceDays);
    if (now > suspendDate) {
      return res.status(403).json({ error: 'Annual registration fee has expired. Member must renew before checking in.', member });
    }
  }
  if (member.status === 'pending') {
    const startLabel = member.startDate ? new Date(member.startDate).toLocaleDateString() : 'unknown date';
    return res.status(403).json({ error: `Membership not started yet (starts ${startLabel})`, member });
  }

  if (member.isVisitor) {
    if (!member.passesRemaining || member.passesRemaining <= 0) {
      return res.status(403).json({ error: 'No passes remaining', member });
    }
  }

  const record = await prisma.attendance.create({
    data: { gymId: req.user.gymId, memberId: member.id, staffId: req.user.id || null, note },
    include: {
      member: { select: { id: true, memberCode: true, firstName: true, lastName: true, status: true, avatarColor: true, photo: true } },
      staff:  { select: { id: true, firstName: true, lastName: true, photo: true } },
    },
  });

  const memberUpdate = { lastVisit: new Date() };
  if (member.isVisitor) memberUpdate.passesRemaining = member.passesRemaining - 1;

  const updatedMember = await prisma.member.update({
    where: { id: member.id },
    data: memberUpdate,
    select: { id: true, passesRemaining: true, isVisitor: true },
  });

  res.status(201).json({
    ...record,
    member: { ...record.member, passesRemaining: updatedMember.passesRemaining, isVisitor: updatedMember.isVisitor },
  });
}

async function checkOut(req, res) {
  const record = await prisma.attendance.update({
    where: { id: req.params.id },
    data: { checkOut: new Date() },
  });
  res.json(record);
}

module.exports = { getAll, checkIn, checkOut };
