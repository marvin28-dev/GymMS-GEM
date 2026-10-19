const prisma = require('../utils/prisma');
const { sendMemberWelcome, sendPaymentReceipt, sendAccessCode, sendMembershipUpdate } = require('../utils/memberEmail');
const { findEmailConflict, emailConflictMessage } = require('../utils/emailGuard');

const { toPaymentMethod } = require('../utils/paymentMethod');

function generatePaymentRef() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `TXN-${ts}-${rand}`;
}
const { logActivity, changesBetween, describeChanges, fullName, money } = require('../utils/activityLog');

const MEMBER_FIELDS = {
  firstName: 'First name', lastName: 'Last name', phone: 'Phone', email: 'Email', gender: 'Gender',
  status: 'Status', packageId: 'Package', startDate: 'Start date', endDate: 'End date',
  balance: 'Balance', passesTotal: 'Total passes', passesRemaining: 'Passes left', dayPasses: 'Day passes',
  isVisitor: 'Visitor', freezeStartDate: 'Freeze start', regFeeDate: 'Registration fee date',
  accessCode: 'Check-in code', dob: 'Date of birth', houseNumber: 'House number', street: 'Street',
  city: 'City', region: 'Region', country: 'Country', postalCode: 'Postal code', emergencyContact: 'Emergency contact',
  emergencyPhone: 'Emergency phone', howHeard: 'How they heard of us', notes: 'Notes',
};

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

// Fitness staff work with the members, not with their money, so what a member
// owes and what they have paid are left out of the reply entirely rather than
// hidden on the screen.
const FITNESS_ROLES = ['trainer', 'instructor', 'coach'];
function withoutMoney(member, role) {
  if (!member || !FITNESS_ROLES.includes(role)) return member;
  const { balance, payments, ...rest } = member;
  return rest;
}

async function getAll(req, res) {
  const { status } = req.query;
  const where = { gymId: req.user.gymId };
  if (status) where.status = status;

  const members = await prisma.member.findMany({
    where,
    include: { package: { select: { id: true, name: true, price: true } }, coach: { select: { id: true, firstName: true, lastName: true } } },
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

  // A request waiting for a manager puts the member under Needs attention. A coach
  // has no part in membership requests, so their list never carries them.
  const waiting = FITNESS_ROLES.includes(req.user.role) ? [] : await prisma.approvalRequest.findMany({
    where: { gymId: req.user.gymId, status: 'pending' },
    select: { memberId: true, summary: true },
  }).catch(() => []);
  const waitingFor = new Map(waiting.map(w => [w.memberId, w.summary]));

  res.json(members.map(m => ({ ...withoutMoney(m, req.user.role), pendingApproval: waitingFor.get(m.id) || null })));
}

async function getOne(req, res) {
  const member = await prisma.member.findFirst({
    where: {
      gymId: req.user.gymId,
      OR: [{ id: req.params.id }, { memberCode: req.params.id }],
    },
    include: {
      package: true,
      coach: { select: { id: true, firstName: true, lastName: true } },
      payments:    { orderBy: { createdAt: 'desc' }, include: { staff: { select: { id: true, firstName: true, lastName: true } } } },
      attendances: { orderBy: { checkIn:  'desc' }, include: { staff: { select: { id: true, firstName: true, lastName: true } } } },
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

  res.json(withoutMoney(member, req.user.role));
}

async function create(req, res) {
  const {
    firstName, lastName, phone, email, gender, avatarColor, photo,
    accessCode, packageId, status, startDate, endDate, balance,
    regFeeDate, freezeStartDate, preFreezEndDate, passesTotal,
    passesRemaining, isVisitor, dayPasses,
    dob, houseNumber, street, city, region, postalCode, country,
    emergencyContact, emergencyPhone,
    howHeard, notes,
  } = req.body;

  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'firstName and lastName are required' });
  }
  if (!String(city || '').trim()) return res.status(400).json({ error: 'Enter the city.', field: 'city' });
  if (!String(region || '').trim()) return res.status(400).json({ error: 'Enter the region.', field: 'region' });
  // Members live in the gym's own country; the forms show it but never change it
  const homeGym = await prisma.gym.findUnique({ where: { id: req.user.gymId }, select: { country: true } });

  // Validate packageId exists if provided
  if (packageId) {
    const pkg = await prisma.package.findFirst({ where: { id: packageId, gymId: req.user.gymId } });
    if (!pkg) return res.status(400).json({ error: 'Package not found' });
  }

  // An email must identify one person per gym, staff and members alike
  const clash = await findEmailConflict(req.user.gymId, email, { scope: 'member' });
  if (clash) return res.status(409).json({ error: emailConflictMessage(clash), field: 'email' });

  // Nobody is added without the money for it being collected first: a member's
  // registration fee (when the gym charges one), a visitor's bundle or day pass.
  const firstPayment = req.body.initialPayment;
  if (isVisitor) {
    if (!(Number(firstPayment?.amount) > 0)) {
      return res.status(400).json({ error: 'Collect the payment for the visitor bundle or day pass before adding the visitor.' });
    }
  } else {
    const feeGym = await prisma.gym.findUnique({ where: { id: req.user.gymId }, select: { registrationFee: true, registrationFeeRequired: true } });
    if (feeGym?.registrationFeeRequired && Number(feeGym.registrationFee) > 0 && !req.body.regFeeMethod) {
      return res.status(400).json({ error: 'Collect the registration fee before adding the member.' });
    }
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
      dayPasses: Math.max(0, Number(dayPasses) || 0),
      isVisitor: isVisitor ?? false,
      dob: dob ? String(dob).slice(0, 10) : undefined,
      houseNumber: houseNumber?.trim() || undefined,
      street: street?.trim() || undefined,
      city: city?.trim() || undefined,
      region: region?.trim() || undefined,
      postalCode: postalCode?.trim() || undefined,
      country: homeGym?.country || country?.trim() || undefined,
      emergencyContact: emergencyContact?.trim() || undefined,
      emergencyPhone: emergencyPhone?.trim() || undefined,
      howHeard: howHeard?.trim() || undefined,
      notes: notes?.trim() || undefined,
    },
    include: { package: { select: { id: true, name: true } } },
  });

  // A new member pays the gym's registration fee at signup (if it charges one),
  // recorded as a payment so it shows in Payments and emails them a receipt.
  // Visitors are not members and do not pay it.
  if (!member.isVisitor) {
    try {
      const gym = await prisma.gym.findUnique({
        where: { id: req.user.gymId },
        select: { registrationFee: true, registrationFeeRequired: true },
      });
      const fee = Number(gym?.registrationFee) || 0;
      if (gym?.registrationFeeRequired && fee > 0) {
        const regFeeMethod = toPaymentMethod(req.body.regFeeMethod);
        const payment = await prisma.payment.create({
          data: {
            memberId: member.id, gymId: req.user.gymId, staffId: req.user.id,
            amount: fee, method: regFeeMethod, type: 'registration', note: 'Registration fee',
            // Every payment carries a reference. A registration fee leaves the
            // membership balance untouched, so "balance after" is what they owe
            // on the membership (0 when nothing is due, never blank).
            reference: generatePaymentRef(),
            balanceAfter: Number(member.balance) || 0,
          },
        });
        await prisma.member.update({ where: { id: member.id }, data: { regFeeDate: new Date() } }).catch(() => {});
        logActivity(req, {
          category: 'money', action: 'payment.recorded',
          summary: `Collected the registration fee of ${money(fee)} from ${fullName(member)}`,
          target: { type: 'member', id: member.id }, details: { type: 'registration' },
        });
        sendPaymentReceipt(payment, member, req.user.gymId).catch(err => console.error('Reg fee receipt email failed:', err.message));
      }
    } catch (err) {
      console.error('Registration fee payment failed:', err.message);
    }
  }

  // A visitor's first payment is saved with them, so one never exists without
  // the other. It is a pass purchase, so it leaves the balance as created (the
  // unpaid part of the bundle), which is what it records as the balance after.
  if (member.isVisitor) {
    try {
      const payment = await prisma.payment.create({
        data: {
          memberId: member.id, gymId: req.user.gymId, staffId: req.user.id,
          amount: Number(firstPayment.amount), method: toPaymentMethod(firstPayment.method),
          type: 'product', note: firstPayment.description || 'Visitor bundle',
          reference: generatePaymentRef(), balanceAfter: Number(member.balance) || 0,
        },
      });
      logActivity(req, {
        category: 'money', action: 'payment.recorded',
        summary: `Collected ${money(payment.amount)} from new visitor ${fullName(member)}`,
        target: { type: 'member', id: member.id }, details: { type: 'product' },
      });
      sendPaymentReceipt(payment, member, req.user.gymId).catch(err => console.error('Visitor receipt email failed:', err.message));
    } catch (err) {
      console.error('Visitor first payment failed:', err.message);
    }
  }

  prisma.notification.create({
    data: {
      gymId: req.user.gymId,
      title: member.isVisitor ? 'New Visitor Registered' : 'New Member Joined',
      body: `${member.firstName} ${member.lastName} has ${member.isVisitor ? 'been registered as a visitor' : 'joined the gym'}.`,
      type: 'signup',
    },
  }).catch(() => {});

  // Welcome email with their member ID and check-in code - fire and forget
  sendMemberWelcome(member, req.user.gymId)
    .catch(err => console.error('Member welcome email failed:', err.message));

  logActivity(req, {
    category: 'members', action: member.isVisitor ? 'visitor.created' : 'member.created',
    summary: member.isVisitor
      ? `Registered visitor ${fullName(member)} (${member.memberCode})`
      : `Added member ${fullName(member)} (${member.memberCode})${member.package?.name ? ` on ${member.package.name}` : ''}`,
    target: { type: 'member', id: member.id },
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

  if (req.body.email !== undefined) {
    const clash = await findEmailConflict(req.user.gymId, req.body.email, { scope: 'member', excludeMemberId: existing.id });
    if (clash) return res.status(409).json({ error: emailConflictMessage(clash), field: 'email' });
  }

  // Only pass fields that exist in the Prisma Member schema
  const ALLOWED_FIELDS = new Set([
    'firstName', 'lastName', 'phone', 'email', 'gender', 'avatarColor', 'photo',
    'accessCode', 'status', 'balance', 'packageId', 'isVisitor',
    'startDate', 'endDate', 'lastVisit', 'regFeeDate',
    'freezeStartDate', 'preFreezEndDate', 'passesTotal', 'passesRemaining', 'dayPasses',
    'dob', 'houseNumber', 'street', 'city', 'region', 'postalCode', 'country',
    'emergencyContact', 'emergencyPhone',
    'howHeard', 'notes',
  ]);

  const safeData = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => ALLOWED_FIELDS.has(k))
  );

  if ('dayPasses' in safeData) safeData.dayPasses = Math.max(0, Number(safeData.dayPasses) || 0);
  if ('country' in safeData) {
    const homeGym = await prisma.gym.findUnique({ where: { id: req.user.gymId }, select: { country: true } });
    if (homeGym?.country) safeData.country = homeGym.country;
  }

  const owed = Number(existing.balance) || 0;
  const addsPasses = ('dayPasses' in safeData && safeData.dayPasses > (existing.dayPasses || 0))
    || ('passesTotal' in safeData && Number(safeData.passesTotal) > (existing.passesTotal || 0));
  if (existing.isVisitor && owed > 0 && addsPasses) {
    return res.status(400).json({ error: `This visitor still owes ${money(owed)}. Settle the balance before buying new passes.`, owes: owed });
  }

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

  // The renew flow asks us to tell the member their membership was renewed.
  // Best-effort, never blocks the save.
  if (req.body._notify === 'renew_membership') {
    sendMembershipUpdate(member, 'renew_membership', req.user.gymId).catch(() => {});
  }

  let packageNames = {};
  if ('packageId' in safeData && (safeData.packageId || null) !== (existing.packageId || null)) {
    const ids = [existing.packageId, safeData.packageId].filter(Boolean);
    const pkgs = await prisma.package.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }).catch(() => []);
    packageNames = Object.fromEntries(pkgs.map(p => [p.id, p.name]));
  }
  const changes = changesBetween(existing, safeData, MEMBER_FIELDS, {
    hidden: ['accessCode', 'notes'],
    format: {
      balance: (v) => money(v),
      packageId: (v) => (v ? packageNames[v] || 'unchanged' : 'none'),
    },
  });
  if (changes.length) {
    const name = fullName(member);
    const status = changes.find(c => c.field === 'Status');
    logActivity(req, {
      category: 'members', action: 'member.updated',
      summary: status && changes.length === 1
        ? `Changed ${name}'s status from ${status.from} to ${status.to}`
        : `Updated member ${name}: ${describeChanges(changes)}`,
      target: { type: 'member', id: member.id }, details: { changes },
    });
  }
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
  logActivity(req, {
    category: 'members', action: 'member.deactivated',
    summary: `Deactivated member ${fullName(existing)} (${existing.memberCode})`,
    target: { type: 'member', id: existing.id },
  });
  res.json({ message: 'Member deactivated' });
}

// Re-send a member their own check-in code by email, on request from the desk.
async function sendCode(req, res) {
  const member = await prisma.member.findFirst({
    where: {
      gymId: req.user.gymId,
      OR: [{ id: req.params.id }, { memberCode: req.params.id }],
    },
    select: { id: true, firstName: true, email: true, accessCode: true },
  });
  if (!member) return res.status(404).json({ error: 'Member not found' });
  if (!member.email) return res.status(400).json({ error: 'This member has no email on file.' });
  if (!member.accessCode) return res.status(400).json({ error: 'This member has no check-in code.' });

  let sent = false;
  try {
    sent = await sendAccessCode(member, req.user.gymId);
  } catch (err) {
    console.error(`Send access code to ${member.email} failed:`, err.message);
    return res.status(502).json({ error: 'Could not send the email right now. Please try again.' });
  }
  if (!sent) return res.status(502).json({ error: 'Email is not set up on this gym yet.' });
  res.json({ message: 'Check-in code sent', to: member.email });
}

module.exports = { getAll, getOne, create, update, remove, sendCode };
