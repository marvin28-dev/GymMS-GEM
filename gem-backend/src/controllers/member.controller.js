const crypto = require('crypto');
const prisma = require('../utils/prisma');
const { bestEffort } = require('../utils/bestEffort');
const { generatePaymentRef } = require('../utils/paymentRef');
const { sendMemberWelcome, sendPaymentReceipt, sendAccessCode, sendMembershipUpdate } = require('../utils/memberEmail');
const { findEmailConflict, emailConflictMessage } = require('../utils/emailGuard');

const { toPaymentMethod } = require('../utils/paymentMethod');

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

// A 4-digit check-in code no one else in the gym holds. A staff member's own
// code also checks them in to train, so a member never shares one with staff.
async function generateAccessCode(gymId) {
  for (let i = 0; i < 50; i++) {
    const code = String(crypto.randomInt(1000, 10000));
    const [member, staff] = await Promise.all([
      prisma.member.findFirst({ where: { gymId, accessCode: code }, select: { id: true } }),
      prisma.staff.findFirst({ where: { gymId, accessCode: code }, select: { id: true } }),
    ]);
    if (!member && !staff) return code;
  }
  // Fallback to 6-digit if 4-digit space is crowded
  return String(crypto.randomInt(100000, 1000000));
}

// GEM- and the next number across every gym (member codes are unique
// platform-wide). A retry after a clash starts a little further on, so members
// added at the same moment stop drawing the same number.
async function generateMemberCode(attempt = 0) {
  const count = await prisma.member.count();
  let n = count + 1 + (attempt ? crypto.randomInt(0, attempt * 3 + 1) : 0);
  for (let i = 0; i < 20; i++, n++) {
    const code = `GEM-${String(n).padStart(4, '0')}`;
    const taken = await prisma.member.findUnique({ where: { memberCode: code }, select: { id: true } });
    if (!taken) return code;
  }
  return `GEM-${String(n).padStart(4, '0')}`;
}

// Fitness staff work with the members, not with their money, so what a member
// owes and what they have paid are left out of the reply entirely rather than
// hidden on the screen.
const FITNESS_ROLES = ['trainer', 'instructor', 'coach'];
function withoutMoney(member, role) {
  if (!member || !FITNESS_ROLES.includes(role)) return member;
  const rest = { ...member };
  delete rest.balance;
  delete rest.payments;
  // Each visit keeps what the member owed as they came in; that is money too
  if (Array.isArray(rest.attendances)) {
    rest.attendances = rest.attendances.map((visit) => {
      const copy = { ...visit };
      delete copy.balanceAtCheckIn;
      return copy;
    });
  }
  return rest;
}

// What the "needs attention" counts and the Daily Overview read of each member.
// The sidebar asks on every page change, so it is sent these alone rather than
// every member's whole record (F-099).
const ATTENTION_SELECT = {
  id: true, status: true, isVisitor: true, balance: true, startDate: true, endDate: true, createdAt: true,
  package: { select: { price: true } },
};

async function getAll(req, res) {
  const { status } = req.query;
  const where = { gymId: req.user.gymId };
  if (status) where.status = status;

  const members = await prisma.member.findMany({
    where,
    ...(req.query.view === 'attention'
      ? { select: ATTENTION_SELECT }
      : { include: { package: { select: { id: true, name: true, price: true } }, coach: { select: { id: true, firstName: true, lastName: true } } } }),
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
  }).then(rows => rows, err => { console.error('Reading waiting approvals failed:', err.message); return []; });
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
  const gymId = req.user.gymId;

  if (!String(firstName || '').trim() || !String(lastName || '').trim()) {
    return res.status(400).json({ error: 'firstName and lastName are required' });
  }
  if (!String(city || '').trim()) return res.status(400).json({ error: 'Enter the city.', field: 'city' });
  if (!String(region || '').trim()) return res.status(400).json({ error: 'Enter the region.', field: 'region' });
  // What a member owes; the gym never owes a member, so it is never below zero
  const owes = balance === undefined || balance === null || balance === '' ? 0 : Number(balance);
  if (!Number.isFinite(owes) || owes < 0) return res.status(400).json({ error: 'The balance must be a number of 0 or more.', field: 'balance' });
  const givenCode = accessCode === undefined || accessCode === null ? '' : String(accessCode).trim();
  if (givenCode && !/^\d{4,6}$/.test(givenCode)) return res.status(400).json({ error: 'A check-in code is 4 to 6 digits.', field: 'accessCode' });

  // Members live in the gym's own country; the forms show it but never change it
  const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { country: true, registrationFee: true, registrationFeeRequired: true } });

  // Validate packageId exists if provided
  if (packageId) {
    const pkg = await prisma.package.findFirst({ where: { id: String(packageId), gymId } });
    if (!pkg) return res.status(400).json({ error: 'Package not found' });
  }

  // An email must identify one person per gym, staff and members alike
  const clash = await findEmailConflict(gymId, email, { scope: 'member' });
  if (clash) return res.status(409).json({ error: emailConflictMessage(clash), field: 'email' });
  if (givenCode && await prisma.member.findFirst({ where: { gymId, accessCode: givenCode }, select: { id: true } })) {
    return res.status(409).json({ error: 'That check-in code is already used by another member.', field: 'accessCode' });
  }

  // Nobody is added without the money for it being collected first: a member's
  // registration fee (when the gym charges one), a visitor's bundle or day pass.
  const firstPayment = req.body.initialPayment;
  const firstAmount = Number(firstPayment?.amount);
  const fee = Number(gym?.registrationFee) || 0;
  const chargesFee = !isVisitor && !!gym?.registrationFeeRequired && fee > 0;
  if (isVisitor && !(Number.isFinite(firstAmount) && firstAmount > 0)) {
    return res.status(400).json({ error: 'Collect the payment for the visitor bundle or day pass before adding the visitor.' });
  }
  if (chargesFee && !req.body.regFeeMethod) {
    return res.status(400).json({ error: 'Collect the registration fee before adding the member.' });
  }

  const data = {
    gymId,
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    phone: phone?.trim() || undefined,
    email: email?.trim() || undefined,
    gender: gender || undefined,
    avatarColor: avatarColor || undefined,
    photo: photo || undefined,
    packageId: packageId || undefined,
    status: status || (startDate && new Date(startDate) > new Date() ? 'pending' : 'active'),
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
    balance: owes,
    // A fee collected now is paid as of now
    regFeeDate: chargesFee ? new Date() : (regFeeDate ? new Date(regFeeDate) : undefined),
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
    country: gym?.country || country?.trim() || undefined,
    emergencyContact: emergencyContact?.trim() || undefined,
    emergencyPhone: emergencyPhone?.trim() || undefined,
    howHeard: howHeard?.trim() || undefined,
    notes: notes?.trim() || undefined,
  };

  // The member and the money taken for them are written together, so neither
  // exists without the other. Member codes are numbered across every gym, so
  // two members added at the same moment can draw the same one: the database
  // refuses the second, which simply draws again.
  let created;
  for (let attempt = 0; ; attempt += 1) {
    const memberCode = await generateMemberCode(attempt);
    const code = givenCode || await generateAccessCode(gymId);
    try {
      created = await prisma.$transaction(async (tx) => {
        const member = await tx.member.create({
          data: { ...data, memberCode, accessCode: code },
          include: { package: { select: { id: true, name: true } } },
        });
        let payment = null;
        if (chargesFee) {
          payment = await tx.payment.create({
            data: {
              memberId: member.id, gymId, staffId: req.user.id,
              amount: fee, method: toPaymentMethod(req.body.regFeeMethod), type: 'registration', note: 'Registration fee',
              // Every payment carries a reference. A registration fee leaves the
              // membership balance untouched, so "balance after" is what they owe
              // on the membership (0 when nothing is due, never blank).
              reference: generatePaymentRef(),
              balanceAfter: owes,
            },
          });
        } else if (isVisitor) {
          // A visitor's first payment is a pass purchase, so it leaves the
          // balance as created (the unpaid part of the bundle)
          payment = await tx.payment.create({
            data: {
              memberId: member.id, gymId, staffId: req.user.id,
              amount: firstAmount, method: toPaymentMethod(firstPayment.method),
              type: 'product', note: firstPayment.description || 'Visitor bundle',
              reference: generatePaymentRef(), balanceAfter: owes,
            },
          });
        }
        return { member, payment };
      });
      break;
    } catch (err) {
      if (err.code === 'P2002' && attempt < 8) continue;
      throw err;
    }
  }
  const { member, payment } = created;

  if (payment) {
    logActivity(req, {
      category: 'money', action: 'payment.recorded',
      summary: chargesFee
        ? `Collected the registration fee of ${money(fee)} from ${fullName(member)}`
        : `Collected ${money(payment.amount)} from new visitor ${fullName(member)}`,
      target: { type: 'member', id: member.id }, details: { type: payment.type },
    });
    sendPaymentReceipt(payment, member, gymId).catch(err => console.error('First payment receipt email failed:', err.message));
  }

  bestEffort(prisma.notification.create({
    data: {
      gymId,
      title: member.isVisitor ? 'New Visitor Registered' : 'New Member Joined',
      body: `${member.firstName} ${member.lastName} has ${member.isVisitor ? 'been registered as a visitor' : 'joined the gym'}.`,
      type: 'signup',
    },
  }), 'New member notification');

  // Welcome email with their member ID and check-in code - fire and forget
  sendMemberWelcome(member, gymId)
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
    bestEffort(sendMembershipUpdate(member, 'renew_membership', req.user.gymId), 'Renewal email');
  }

  let packageNames = {};
  if ('packageId' in safeData && (safeData.packageId || null) !== (existing.packageId || null)) {
    const ids = [existing.packageId, safeData.packageId].filter(Boolean);
    const pkgs = await prisma.package.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }).then(rows => rows, err => { console.error('Reading package names failed:', err.message); return []; });
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
