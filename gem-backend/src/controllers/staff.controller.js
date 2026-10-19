const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Resend } = require('resend');
const prisma = require('../utils/prisma');
const E = require('../utils/emailLayout');
const { canView, canSeePrivateFields, canManage, refuseFields, canCreateRole, isManagement, rankOf, isOwner } = require('../utils/hierarchy');
const { findEmailConflict, emailConflictMessage } = require('../utils/emailGuard');
const { logActivity, fullName, money } = require('../utils/activityLog');
const { forgetAccount, DEACTIVATED } = require('../middleware/auth.middleware');
const { sendWelcomeEmail } = require('../utils/welcomeEmail');
const { deliver } = require('../utils/sendEmail');

const STAFF_FIELDS = {
  firstName: 'First name', lastName: 'Last name', email: 'Email', phone: 'Phone',
  role: 'Role', department: 'Department', isActive: 'Status', employmentType: 'Employment type',
  salary: 'Salary', payDay: 'Pay day', joinDate: 'Join date', shiftStart: 'Shift start',
  schedule: 'Schedule', scheduleOverrides: 'Schedule changes', staffNotes: 'Notes', photo: 'Photo',
  password: 'Password', emergencyContact: 'Emergency contact', emergencyPhone: 'Emergency phone',
};
// Named in the log, never copied into it
const STAFF_HIDDEN = new Set(['schedule', 'scheduleOverrides', 'staffNotes', 'photo', 'password']);

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  return new Resend(process.env.RESEND_API_KEY);
}

function formatRole(role) {
  return (role || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// A link for an employee to choose a new password, sent when a manager asks.
// It lasts a day, since the person may not see it straight away.
async function sendResetLinkEmail(staff, gymId, sentBy) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.staff.update({ where: { id: staff.id }, data: { resetToken: token, resetTokenExpiry: expiry } });

  const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { name: true, logo: true, phone: true, email: true, website: true, location: true, city: true, country: true } });
  const gymName = gym?.name || 'your gym';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

  await deliver(getResend(), {
    from: E.sender(gym?.name),
    to: staff.email,
    subject: `Reset your password for ${gymName} on GEM`,
    html: E.layout({
      brand: E.gymBrand(gym), gym, preheader: 'A link to choose a new password, valid for 24 hours.', eyebrow: 'Password', title: 'Choose a new password',
      body: [
        E.greeting(staff.firstName),
        E.pHtml(`${sentBy ? `${E.strong(sentBy)} sent you` : 'Here is'} a link to choose a new password for your account at ${E.strong(gymName)}.`),
        E.button(resetUrl, 'Choose a new password'),
        E.note('<strong style="color:#b4232a;">This link expires in 24 hours.</strong> If you did not expect it, ignore this email and your password stays as it is.', 'red'),
      ].join(''),
    }),
  });
}

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
  // Everyone can see who their colleagues are; only management sees the detail
  // that goes with a record, so the pay and access code are stripped for the rest.
  const staff = await prisma.staff.findMany({
    where: { gymId: req.user.gymId },
    select: {
      id: true, firstName: true, lastName: true,
      email: true, phone: true, role: true,
      department: true, schedule: true, avatarColor: true, photo: true, photoId: true, isActive: true, createdAt: true,
      accessCode: true, salary: true, employmentType: true,
      houseNumber: true, street: true, city: true, region: true, postalCode: true, country: true,
    },
    orderBy: { firstName: 'asc' },
  });

  // A colleague's name and role are fine to see. Their access code and pay are
  // only for someone who outranks them, and for themselves.
  res.json(staff.map(s => {
    const self = String(s.id) === String(req.user.id);
    if (self || canManage(req.user, s)) return s;
    const { accessCode, salary, ...rest } = s;
    return rest;
  }));
}

async function getOne(req, res) {
  const subject = await prisma.staff.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
    select: { id: true, role: true },
  });
  if (!subject) return res.status(404).json({ error: 'Staff not found' });
  if (!canView(req.user, subject)) {
    return res.status(403).json({ error: 'You do not have access to this staff record.' });
  }
  const seesPrivate = canSeePrivateFields(req.user, subject);

  // Fetch base fields via Prisma (always safe regardless of client version)
  const staff = await prisma.staff.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
    select: {
      id: true, firstName: true, lastName: true,
      email: true, phone: true, role: true,
      department: true, joinDate: true, shiftStart: true,
      avatarColor: true, photo: true, photoId: true, isActive: true, createdAt: true,
      schedule: true, scheduleOverrides: true, salary: true, staffNotes: true, payDay: true, employmentType: true,
      houseNumber: true, street: true, city: true, region: true, postalCode: true, country: true,
    },
  });
  if (!staff) return res.status(404).json({ error: 'Staff not found' });

  // Fetch emergency contact via raw SQL so it works even with a stale Prisma client
  if (seesPrivate) {
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
      // Column doesn't exist yet - migration not applied, just omit the fields
    }
  }

  // A colleague's name, role, schedule and contact details are an open book -
  // the same basic read the staff list already gives everyone. Their pay and
  // private notes are not, unless the viewer outranks them or it's their own.
  if (!seesPrivate) {
    delete staff.salary;
    delete staff.staffNotes;
    delete staff.payDay;
    delete staff.scheduleOverrides;
  }

  res.json(staff);
}

async function create(req, res) {
  const { password, role, emergencyContact, emergencyPhone, salary, joinDate, employmentType, address: _oldAddress, ...rest } = req.body;
  if (!String(rest.city || '').trim()) return res.status(400).json({ error: 'Enter the city.', field: 'city' });
  if (!String(rest.region || '').trim()) return res.status(400).json({ error: 'Enter the region.', field: 'region' });
  // People live in the gym's own country; the forms show it but never change it
  const homeGym = await prisma.gym.findUnique({ where: { id: req.user.gymId }, select: { country: true } });
  if (homeGym?.country) rest.country = homeGym.country;

  // Taking somebody on is the owner's decision. A manager runs the people who
  // are already here; he does not decide who joins them.
  if (!isOwner(req.user.role)) {
    return res.status(403).json({ error: 'Only the general manager can add staff.' });
  }
  if (!canCreateRole(req.user, normalizeRole(role))) {
    return res.status(403).json({ error: 'You cannot create an account at or above your own level.' });
  }

  // An email must identify one person per gym, staff and members alike
  const clash = await findEmailConflict(req.user.gymId, rest.email, { scope: 'staff' });
  if (clash) return res.status(409).json({ error: emailConflictMessage(clash), field: 'email' });

  const passwordHash = await bcrypt.hash(password || `GEM${Date.now()}`, 10);
  let staff;
  try {
    staff = await prisma.staff.create({
      data: {
        ...rest,
        role: normalizeRole(role),
        gymId: req.user.gymId,
        passwordHash,
        mustSetPassword: !password,
        accessCode: generateAccessCode(),
        // Only the owner sets pay; anyone else hiring leaves it for him to fill in
        salary: isOwner(req.user.role) && salary !== undefined && salary !== '' && salary !== null ? parseFloat(salary) : null,
        joinDate: joinDate && joinDate !== '' ? new Date(joinDate) : null,
        employmentType: employmentType === 'Part Time' ? 'Part Time' : 'Full Time',
      },
      select: {
        id: true, firstName: true, lastName: true,
        email: true, phone: true, role: true,
        department: true, joinDate: true, shiftStart: true, payDay: true, schedule: true, staffNotes: true,
        avatarColor: true, photo: true, photoId: true, isActive: true, createdAt: true, salary: true, employmentType: true,
        houseNumber: true, street: true, city: true, region: true, postalCode: true, country: true,
      },
    });
  } catch (err) {
    console.error('Staff create failed:', err.message);
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A staff member with this email already exists.', field: 'email' });
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

  prisma.notification.create({
    data: {
      gymId: req.user.gymId,
      title: 'New Staff Member Added',
      body: `${staff.firstName} ${staff.lastName} has been added as ${staff.role}.`,
      type: 'system',
      audience: 'managers',
      aboutStaffId: staff.id,
    },
  }).catch(() => {});

  // They are written to with the gym code and how to sign in. Their 4-digit
  // code is not in it: a manager reads that to them, and it is what proves the
  // account is being claimed by the person it was made for.
  prisma.gym.findUnique({ where: { id: req.user.gymId }, select: { name: true, code: true, settings: true, logo: true, phone: true, email: true, website: true, location: true, city: true, country: true } })
    .then(gym => {
      // Settings can switch this off for gyms that hand accounts over in person
      if (!gym || gym.settings?.notifications?.welcomeEmail === false) return null;
      return sendWelcomeEmail({ staff, gym });
    })
    .catch(err => console.error('Welcome email failed:', err.message));

  logActivity(req, {
    category: 'staff', action: 'staff.created',
    summary: `Added ${fullName(staff)} as ${formatRole(staff.role)}`,
    target: { type: 'staff', id: staff.id },
    details: {
      email: staff.email || null,
      department: staff.department || null,
      employmentType: staff.employmentType || null,
      ...(staff.salary ? { salary: money(staff.salary) } : {}),
    },
  });

  res.status(201).json({ ...staff, setPasswordOnSignIn: true });
}

// Whether a submitted value would actually change what is stored.
function differs(field, incoming, current) {
  if (field === 'password') return !!incoming;
  if (field === 'role') return normalizeRole(incoming) !== current;
  if (field === 'isActive') return Boolean(incoming) !== Boolean(current);
  if (field === 'salary' || field === 'payDay') {
    const a = incoming === '' || incoming === null ? null : Number(incoming);
    const b = current === null || current === undefined ? null : Number(current);
    return a !== b;
  }
  if (field === 'joinDate') {
    const day = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');
    return day(incoming) !== day(current);
  }
  if (field === 'schedule' || field === 'scheduleOverrides' || field === 'staffNotes') {
    return JSON.stringify(incoming ?? null) !== JSON.stringify(current ?? null);
  }
  const norm = (v) => (v === null || v === undefined ? '' : String(v));
  return norm(incoming) !== norm(current);
}

async function update(req, res) {
  const existing = await prisma.staff.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Staff not found' });

  if (req.body.email !== undefined) {
    const clash = await findEmailConflict(req.user.gymId, req.body.email, { scope: 'staff', excludeStaffId: existing.id });
    if (clash) return res.status(409).json({ error: emailConflictMessage(clash), field: 'email' });
  }

  // Every field in this request is checked against the ladder before anything
  // is written, so a single refused field stops the whole update. Only fields
  // that actually change count: the edit forms send the whole record back, and
  // re-sending your own unchanged role is not an attempt to change it.
  const requested = Object.keys(req.body).filter(k => req.body[k] !== undefined && differs(k, req.body[k], existing[k]));
  const refusal = refuseFields(req.user, existing, requested);
  if (refusal) return res.status(403).json({ error: refusal });

  // Pay is the owner's decision. A manager may run the rota and the records of
  // the people below him, but setting what anyone earns is not his to do.
  const payFields = requested.filter(f => f === 'salary' || f === 'payDay' || f === 'employmentType');
  if (payFields.length && !isOwner(req.user.role)) {
    return res.status(403).json({ error: 'Only the gym owner can change pay, pay day or employment type.' });
  }

  // Switching a staff member active/inactive is the general manager's alone.
  if (requested.includes('isActive') && Boolean(req.body.isActive) !== Boolean(existing.isActive) && !isOwner(req.user.role)) {
    return res.status(403).json({ error: 'Only the general manager can activate or deactivate a staff member.' });
  }

  // The gym always has exactly one owner. Demoting him would leave it with none,
  // the same reason the owner account can never be deactivated.
  if (existing.role === 'general_manager' && requested.includes('role')) {
    return res.status(400).json({ error: 'The role of the gym owner cannot be changed.' });
  }

  // Promoting somebody to your own level or above is not yours to do
  if (requested.includes('role') && !canCreateRole(req.user, normalizeRole(req.body.role))) {
    return res.status(403).json({ error: 'You cannot give someone a role at or above your own level.' });
  }

  const {
    password, role, firstName, lastName, email, phone,
    department, joinDate, shiftStart, avatarColor, photo, isActive,
    emergencyContact, emergencyPhone, schedule, salary, staffNotes, payDay, employmentType,
  } = req.body;

  const data = {};
  if (firstName !== undefined) data.firstName = firstName;
  if (lastName !== undefined) data.lastName = lastName;
  if (email !== undefined) data.email = email;
  if (phone !== undefined) data.phone = phone;
  if (department !== undefined) data.department = department;
  // The salary field means different things either side of this switch: a monthly
  // figure for full time, an hourly rate for part time. Carrying the old number
  // across would price an 8-hour shift at a month's pay, so it has to be restated.
  if (employmentType !== undefined) {
    const next = employmentType === 'Part Time' ? 'Part Time' : 'Full Time';
    const current = existing.employmentType || 'Full Time';
    if (next !== current) {
      const given = salary !== undefined && salary !== '' && salary !== null ? parseFloat(salary) : null;
      if (!(given > 0)) {
        return res.status(400).json({
          error: next === 'Part Time'
            ? 'Moving someone to part time needs their hourly rate, since the salary field becomes a rate per hour.'
            : 'Moving someone to full time needs their monthly salary, since the salary field stops being a rate per hour.',
        });
      }
    }
    data.employmentType = next;
  }
  if (joinDate !== undefined) data.joinDate = joinDate ? new Date(joinDate) : null;
  if (shiftStart !== undefined) data.shiftStart = shiftStart;
  if (avatarColor !== undefined) data.avatarColor = avatarColor;
  if (photo !== undefined) data.photo = photo;
  if (req.body.photoId !== undefined) data.photoId = req.body.photoId;
  for (const f of ['houseNumber', 'street', 'city', 'region', 'postalCode', 'country']) {
    if (req.body[f] !== undefined) data[f] = String(req.body[f] || '').trim() || null;
  }
  if (data.country !== undefined) {
    const homeGym = await prisma.gym.findUnique({ where: { id: req.user.gymId }, select: { country: true } });
    if (homeGym?.country) data.country = homeGym.country;
  }
  if (isActive !== undefined) data.isActive = isActive;
  if (isActive === false && existing.isActive !== false) {
    data.accessCode = null;
    data.resetToken = null;
    data.resetTokenExpiry = null;
  }
  if (schedule !== undefined || req.body.scheduleOverrides !== undefined) {
    if (schedule !== undefined) data.schedule = schedule;
    // Per-week exceptions, keyed by the Monday of the week they apply to
    if (req.body.scheduleOverrides !== undefined) data.scheduleOverrides = req.body.scheduleOverrides;
  }
  if (staffNotes !== undefined) data.staffNotes = staffNotes;
  if (salary !== undefined) data.salary = salary !== '' && salary !== null ? parseFloat(salary) : null;
  // null clears the override so the staff member falls back to the gym pay day
  if (payDay !== undefined) {
    const d = Number(payDay);
    data.payDay = payDay === null || payDay === '' || !Number.isFinite(d) ? null : Math.min(28, Math.max(1, Math.trunc(d)));
  }
  if (emergencyContact !== undefined) data.emergencyContact = emergencyContact;
  if (emergencyPhone !== undefined) data.emergencyPhone = emergencyPhone;
  if (role) data.role = normalizeRole(role);
  if (password) { data.passwordHash = await bcrypt.hash(password, 10); data.mustSetPassword = false; }

  // Deactivation clears the access code, so reactivating has to issue a fresh one
  if (isActive === true && existing.isActive === false && !existing.accessCode) {
    data.accessCode = generateAccessCode();
  }

  // Remove emergency fields from the Prisma update - handle them via raw SQL
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
        avatarColor: true, photo: true, photoId: true, isActive: true, salary: true, staffNotes: true, payDay: true, employmentType: true,
        houseNumber: true, street: true, city: true, region: true, postalCode: true, country: true,
      },
    });
  } catch (err) {
    console.error('Staff update failed:', err.message);
    if (err.code === 'P2002') return res.status(409).json({ error: 'A staff member with this email already exists.', field: 'email' });
    return res.status(500).json({ error: 'Failed to update staff' });
  }

  // Save emergency contact via raw SQL - bypasses Prisma client schema validation
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

  if (isActive !== undefined && isActive !== existing.isActive) {
    prisma.notification.create({
      data: {
        gymId: req.user.gymId,
        title: isActive ? 'Staff Reactivated' : 'Staff Deactivated',
        body: `${staff.firstName} ${staff.lastName}'s account has been ${isActive ? 'reactivated' : 'deactivated'}.`,
        type: 'system',
        audience: 'managers',
        aboutStaffId: staff.id,
      },
    }).catch(() => {});
  }

  forgetAccount(existing.id);

  const show = (f, v) => {
    if (v === null || v === undefined || v === '') return 'empty';
    if (f === 'isActive') return v ? 'Active' : 'Inactive';
    if (f === 'role') return formatRole(v);
    if (f === 'salary') return money(v);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v);
  };
  const changes = requested.filter(f => STAFF_FIELDS[f]).map(f => (STAFF_HIDDEN.has(f)
    ? { field: STAFF_FIELDS[f] }
    : { field: STAFF_FIELDS[f], from: show(f, existing[f]), to: show(f, data[f]) }));
  if (data.accessCode) changes.push({ field: 'Access code', to: 'new code issued' });
  if (changes.length) {
    const name = fullName(staff);
    const toggled = requested.includes('isActive') && data.isActive !== existing.isActive;
    const others = changes.filter(c => c.field !== 'Status' && c.field !== 'Access code');
    const list = others.map(c => c.field.toLowerCase()).join(', ');
    const self = String(req.user.id) === String(existing.id);
    const summary = toggled
      ? `${data.isActive ? 'Reactivated' : 'Deactivated'} ${name}'s account${others.length ? ` and changed ${list}` : ''}`
      : self ? `Updated their own profile: ${list}` : `Updated ${name}'s profile: ${list}`;
    const payChanged = requested.some(f => f === 'salary' || f === 'payDay' || f === 'employmentType');
    logActivity(req, {
      category: payChanged ? 'payroll' : 'staff', action: 'staff.updated', summary,
      target: { type: 'staff', id: existing.id }, details: { changes },
    });
  }

  res.json(staff);
}

async function remove(req, res) {
  const existing = await prisma.staff.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
  });
  if (!existing) return res.status(404).json({ error: 'Staff not found' });
  if (existing.role === 'general_manager') {
    return res.status(400).json({ error: 'The gym owner account cannot be deactivated.' });
  }
  if (String(existing.id) === String(req.user.id)) {
    return res.status(403).json({ error: 'You cannot deactivate your own account. A more senior manager has to do it.' });
  }
  if (!canManage(req.user, existing)) {
    return res.status(403).json({ error: 'You can only deactivate someone below your own level.' });
  }

  // Deactivating has to revoke every way back in, not just the password login:
  // the 4-digit access code doubles as a front-desk credential and a manager
  // authorisation PIN, and a pending reset token would let them set a new password.
  await prisma.staff.update({
    where: { id: req.params.id },
    data: { isActive: false, accessCode: null, resetToken: null, resetTokenExpiry: null },
  });
  forgetAccount(existing.id);

  prisma.notification.create({
    data: {
      gymId: req.user.gymId,
      title: 'Staff Deactivated',
      body: `${existing.firstName} ${existing.lastName}'s account has been deactivated and their access code revoked.`,
      type: 'system',
      audience: 'managers',
      aboutStaffId: existing.id,
    },
  }).catch(() => {});

  logActivity(req, {
    category: 'staff', action: 'staff.deactivated',
    summary: `Deactivated ${fullName(existing)}'s account and revoked their access code`,
    target: { type: 'staff', id: existing.id },
  });

  res.json({ message: 'Staff deactivated' });
}

// Access codes never travel to the browser. Front-desk sign-in used to compare
// the typed PIN against every staff member's real code sitting in the page, the
// owner's and managers' included. Since a manager's code also approves things,
// anyone opening the developer tools at the desk could take the owner's.
//
// Wrong guesses are counted per person, so four digits cannot simply be tried
// one after another until one works.
const MAX_MISSES = 5;
const LOCKOUT_MS = 5 * 60 * 1000;
const misses = new Map();

function lockedOut(key) {
  const entry = misses.get(key);
  if (!entry) return 0;
  if (entry.until && entry.until > Date.now()) return entry.until - Date.now();
  if (entry.until && entry.until <= Date.now()) misses.delete(key);
  return 0;
}

function recordMiss(key) {
  const entry = misses.get(key) || { count: 0, until: 0 };
  entry.count += 1;
  if (entry.count >= MAX_MISSES) { entry.until = Date.now() + LOCKOUT_MS; entry.count = 0; }
  misses.set(key, entry);
}

// Is this the right PIN for this person? Used for front-desk sign-in and exit.
async function verifyCode(req, res) {
  const code = String(req.body?.code ?? '').trim();
  if (!/^\d{4}$/.test(code)) return res.status(400).json({ valid: false, error: 'Enter the 4-digit code.' });

  const key = `${req.user.gymId}:${req.params.id}`;
  const wait = lockedOut(key);
  if (wait) {
    return res.status(429).json({ valid: false, error: `Too many wrong attempts. Try again in ${Math.ceil(wait / 60000)} minutes.` });
  }

  const staff = await prisma.staff.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
    select: { id: true, accessCode: true, firstName: true, lastName: true, isActive: true },
  });
  if (!staff) return res.status(404).json({ valid: false, error: 'Staff not found' });
  if (!staff.isActive) return res.status(403).json({ valid: false, ...DEACTIVATED });
  if (!staff.accessCode) return res.status(404).json({ valid: false, error: 'Staff not found' });

  const valid = staff.accessCode === code;
  if (valid) misses.delete(key); else recordMiss(key);

  const name = fullName(staff);
  const closing = req.body?.purpose === 'frontdesk.exit';
  const locked = !valid && lockedOut(key) > 0;
  logActivity(req, {
    category: 'security',
    action: valid ? (closing ? 'frontdesk.closed' : 'frontdesk.opened') : locked ? 'frontdesk.code_locked' : 'frontdesk.code_refused',
    summary: valid
      ? (closing ? `Closed the front desk with ${name}'s code` : `Opened the front desk as ${name}`)
      : locked
        ? `Locked ${name}'s code for 5 minutes after 5 wrong tries at the front desk`
        : `Wrong code entered for ${name} at the front desk`,
    target: { type: 'staff', id: staff.id },
  });
  res.json({ valid });
}

// Who does this code belong to? Used when the desk types a code to clock
// somebody in. Only part-time staff are ever clocked, so only their codes can
// be resolved here - a manager's or the owner's code, which approves things,
// can never be discovered by guessing at the desk.
async function findByCode(req, res) {
  const code = String(req.params.code ?? '').trim();
  if (!/^\d{4}$/.test(code)) return res.status(400).json({ error: 'Enter the 4-digit code.' });

  const key = `${req.user.gymId}:lookup:${req.user.id}`;
  const wait = lockedOut(key);
  if (wait) {
    return res.status(429).json({ error: `Too many unknown codes. Try again in ${Math.ceil(wait / 60000)} minutes.` });
  }

  const staff = await prisma.staff.findFirst({
    where: {
      gymId: req.user.gymId,
      accessCode: code,
      isActive: true,
      employmentType: 'Part Time',
      role: { notIn: ['general_manager', 'manager'] },
    },
    select: {
      id: true, firstName: true, lastName: true, phone: true,
      role: true, avatarColor: true, employmentType: true, shiftStart: true,
    },
  });
  if (!staff) { recordMiss(key); return res.status(404).json({ error: 'No part-time staff member has that code.' }); }
  misses.delete(key);
  res.json(staff);
}

async function getCode(req, res) {
  let staff = await prisma.staff.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
    select: { id: true, accessCode: true, role: true, firstName: true, lastName: true },
  });
  if (!staff) return res.status(404).json({ error: 'Staff not found' });

  // Your own code is yours to see. Anyone else's needs you to outrank them, so
  // a manager can never read the owner's.
  const isSelf = String(req.user.id) === String(req.params.id);
  if (!isSelf && !canManage(req.user, staff)) {
    return res.status(403).json({ error: 'You do not have access to this access code.' });
  }
  logActivity(req, {
    category: 'security', action: 'staff.code_viewed',
    summary: isSelf ? 'Viewed their own access code' : `Viewed ${fullName(staff)}'s access code`,
    target: { type: 'staff', id: staff.id },
  });

  if (!staff.accessCode) {
    staff = await prisma.staff.update({
      where: { id: req.params.id },
      data: { accessCode: generateAccessCode() },
      select: { id: true, accessCode: true },
    });
  }

  res.json({ accessCode: staff.accessCode });
}

// A 4-digit code nobody else in the gym holds, staff or member. A code opens
// the front desk and checks its holder in, so two people sharing one would
// let one of them in as the other.
async function uniqueStaffCode(gymId, current) {
  for (let i = 0; i < 60; i++) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    if (code === String(current || '')) continue;
    const [staff, member] = await Promise.all([
      prisma.staff.findFirst({ where: { gymId, accessCode: code }, select: { id: true } }),
      prisma.member.findFirst({ where: { gymId, accessCode: code }, select: { id: true } }),
    ]);
    if (!staff && !member) return code;
  }
  throw new Error('No free access code could be found');
}

// A fresh code for somebody, the owner included. Only the owner issues codes:
// a code opens the desk and approves sensitive actions, so who holds which is
// his decision. The old code stops working at once.
async function regenerateCode(req, res) {
  const staff = await prisma.staff.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
    select: { id: true, firstName: true, lastName: true, accessCode: true },
  });
  if (!staff) return res.status(404).json({ error: 'Staff not found' });

  let code;
  try {
    code = await uniqueStaffCode(req.user.gymId, staff.accessCode);
  } catch (err) {
    console.error('Access code regeneration failed:', err.message);
    return res.status(500).json({ error: 'Could not find a free code. Try again.' });
  }
  await prisma.staff.update({ where: { id: staff.id }, data: { accessCode: code } });

  const isSelf = String(staff.id) === String(req.user.id);
  logActivity(req, {
    category: 'security', action: 'staff.code_regenerated',
    summary: isSelf ? 'Issued themselves a new access code' : `Issued ${fullName(staff)} a new access code`,
    target: { type: 'staff', id: staff.id },
  });
  // They are told it changed, never what it is
  if (!isSelf) {
    prisma.notification.create({
      data: {
        gymId: req.user.gymId,
        staffId: staff.id,
        title: 'Your Access Code Has Changed',
        body: 'The general manager issued you a new 4-digit access code. Your old one no longer works. You can view the new one on your profile.',
        type: 'system',
        link: '/my-profile',
      },
    }).catch(() => {});
  }
  res.json({ accessCode: code });
}

// Whether someone signed in at the front desk with their code may carry on.
// Answers yes or no and nothing else.
async function checkActive(req, res) {
  const staff = await prisma.staff.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
    select: { isActive: true },
  });
  res.json({ active: !!staff?.isActive });
}

// Sends the employee a link to choose a new password
async function resendInvite(req, res) {
  const staff = await prisma.staff.findFirst({
    where: { id: req.params.id, gymId: req.user.gymId },
    select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true },
  });
  if (!staff) return res.status(404).json({ error: 'Staff not found' });
  if (!canManage(req.user, staff)) {
    return res.status(403).json({ error: 'You can only send a reset link to someone below your own level.' });
  }
  if (!staff.isActive) {
    return res.status(400).json({ error: `${fullName(staff)}'s account is deactivated. Reactivate it before sending a password reset link.` });
  }
  if (!staff.email) return res.status(400).json({ error: 'This staff member has no email address on file.' });

  try {
    const me = await prisma.staff.findUnique({ where: { id: req.user.id }, select: { firstName: true, lastName: true } });
    await sendResetLinkEmail(staff, req.user.gymId, fullName(me));
    logActivity(req, {
      category: 'security', action: 'staff.reset_link_sent',
      summary: `Sent a password reset link to ${fullName(staff)}`, target: { type: 'staff', id: staff.id },
    });
    res.json({ sent: true });
  } catch (err) {
    console.error('Password reset link error:', err.message);
    // The link only exists to be emailed, so an undelivered one is taken back
    await prisma.staff.update({ where: { id: staff.id }, data: { resetToken: null, resetTokenExpiry: null } }).catch(() => {});
    res.status(502).json({ error: 'The reset link could not be emailed. Check the email address and the email settings, then try again.' });
  }
}

module.exports = { getAll, getOne, create, update, remove, getCode, resendInvite, verifyCode, findByCode, checkActive, regenerateCode };
