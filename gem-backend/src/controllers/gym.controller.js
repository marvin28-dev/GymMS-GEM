const prisma = require('../utils/prisma');
const { REQUIRED_SECTIONS, setupStatus } = require('../utils/gymSetup');
const { logActivity, changesBetween, describeChanges, money } = require('../utils/activityLog');
const { currencyForCountry } = require('../utils/money');

const GYM_FIELDS = {
  name: 'Gym name', location: 'Address', phone: 'Phone', email: 'Email', currency: 'Currency', logo: 'Logo',
  payDay: 'Default pay day', altPhone: 'Second phone', city: 'City', province: 'Region', country: 'Country',
  postal: 'Postal code', website: 'Website', facebook: 'Facebook', instagram: 'Instagram', twitter: 'Twitter',
  schedule: 'Opening hours', registrationFee: 'Registration fee', registrationFeeRequired: 'Registration fee required',
  registrationFeeFrequency: 'Registration fee frequency', registrationGracePeriodDays: 'Registration grace period',
  minUpfrontPercent: 'Minimum upfront payment', paymentDeadlineDays: 'Payment deadline', managerCode: 'Manager code',
  settings: 'Payment and notification settings',
};

async function getGymByCode(req, res) {
  // Gym codes get retyped by hand, so tolerate casing and stray spacing
  const code = String(req.params.code || '').trim().toLowerCase().replace(/\s+/g, '-');
  if (!code) return res.status(404).json({ error: 'Gym not found' });

  try {
    const gym = await prisma.gym.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } },
      select: { id: true, code: true, name: true, location: true, city: true, phone: true, email: true, logo: true },
    });
    if (!gym) return res.status(404).json({ error: 'Gym not found' });
    res.json(gym);
  } catch (err) {
    console.error('getGymByCode failed:', err.message);
    res.status(500).json({ error: 'Could not look up that gym code.' });
  }
}

async function getMyGym(req, res) {
  const gym = await prisma.gym.findUnique({
    where: { id: req.user.gymId },
  });
  res.json(gym);
}

async function updateMyGym(req, res) {
  const {
    name, location, phone, email, currency, logo, payDay,
    altPhone, city, province, country, postal, website,
    facebook, instagram, twitter, schedule,
    registrationFee, registrationFeeRequired, registrationFeeFrequency,
    registrationGracePeriodDays, minUpfrontPercent, paymentDeadlineDays,
    managerCode, settings,
  } = req.body;

  const data = {};
  if (name !== undefined) data.name = name;
  // Gym profile details - stored on the record so they follow the gym across
  // devices and can't leak between accounts via browser storage.
  for (const [key, value] of Object.entries({
    altPhone, city, province, country, postal, website, facebook, instagram, twitter,
  })) {
    if (value !== undefined) data[key] = value === '' ? null : value;
  }
  if (schedule !== undefined) data.schedule = schedule;
  if (logo !== undefined) data.logo = logo;
  if (payDay !== undefined) {
    const d = Number(payDay);
    data.payDay = payDay === null || payDay === '' || !Number.isFinite(d) ? null : Math.min(28, Math.max(1, Math.trunc(d)));
  }
  if (location !== undefined) data.location = location;
  if (phone !== undefined) data.phone = phone;
  if (email !== undefined) data.email = email;
  if (currency !== undefined) data.currency = currency;
  if (registrationFee !== undefined) data.registrationFee = registrationFee;
  if (registrationFeeRequired !== undefined) data.registrationFeeRequired = registrationFeeRequired;
  if (registrationFeeFrequency !== undefined) data.registrationFeeFrequency = registrationFeeFrequency;
  if (registrationGracePeriodDays !== undefined) data.registrationGracePeriodDays = registrationGracePeriodDays;
  if (minUpfrontPercent !== undefined) data.minUpfrontPercent = minUpfrontPercent;
  if (paymentDeadlineDays !== undefined) data.paymentDeadlineDays = paymentDeadlineDays;
  if (managerCode !== undefined) data.managerCode = managerCode;

  const previous = await prisma.gym.findUnique({ where: { id: req.user.gymId } });

  // Moving the gym to another country moves its money too, unless this same
  // request names a currency. Without this the prices keep their old symbol.
  if (data.country !== undefined && currency === undefined && data.country !== previous?.country) {
    const implied = currencyForCountry(data.country);
    if (implied) data.currency = implied;
  }
  // Settings are merged, so saving one section cannot wipe another
  if (settings !== undefined && settings !== null && typeof settings === 'object') {
    data.settings = { ...(previous?.settings || {}), ...settings };
  }

  const gym = await prisma.gym.update({ where: { id: req.user.gymId }, data });

  const json = (v) => JSON.stringify(v ?? null);
  const changes = changesBetween(previous, data, GYM_FIELDS, {
    hidden: ['logo', 'schedule', 'managerCode', 'settings'],
    format: { registrationFee: (v) => money(v), schedule: json, logo: json, managerCode: json, settings: json, registrationFeeRequired: (v) => (v ? 'Yes' : 'No') },
  });
  if (changes.length) {
    logActivity(req, {
      category: 'settings', action: 'gym.updated',
      summary: `Changed gym settings: ${describeChanges(changes)}`, details: { changes },
    });
  }
  res.json(gym);
}

// How far the gym is through being set up. Only the owner sets a gym up.
async function getSetup(req, res) {
  const status = await setupStatus(req.user.gymId);
  if (!status) return res.status(404).json({ error: 'Gym not found' });
  res.json(status);
}

// The owner has been through one of the Settings sections and confirmed it.
async function confirmSetupSection(req, res) {
  const section = String(req.body?.section || '').trim();
  if (!REQUIRED_SECTIONS.includes(section)) {
    return res.status(400).json({ error: 'That is not one of the setup sections.' });
  }
  const gym = await prisma.gym.findUnique({ where: { id: req.user.gymId }, select: { setupConfirmed: true } });
  if (!gym) return res.status(404).json({ error: 'Gym not found' });
  if (!(gym.setupConfirmed || []).includes(section)) {
    await prisma.gym.update({
      where: { id: req.user.gymId },
      data: { setupConfirmed: { push: section } },
    });
  }
  res.json(await setupStatus(req.user.gymId));
}

module.exports = { getGymByCode, getMyGym, updateMyGym, getSetup, confirmSetupSection };
