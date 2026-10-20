const prisma = require('../utils/prisma');
const { REQUIRED_SECTIONS, setupStatus } = require('../utils/gymSetup');
const { logActivity, changesBetween, describeChanges, money } = require('../utils/activityLog');
const { currencyForCountry, SYMBOLS } = require('../utils/money');

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
  if (!gym) return res.status(404).json({ error: 'Gym not found' });
  // An old shared code nothing uses any more; in the demo gym it equals the
  // owner's own, so it is never sent to anyone
  delete gym.managerCode;
  res.json(gym);
}

const FREQUENCIES = ['yearly', 'one-time'];

// A short list of names kept on the gym (package access types, product
// categories): trimmed, no blanks or repeats, 40 characters and 50 names at
// most. null when what was sent is not a list.
function cleanList(value) {
  if (!Array.isArray(value)) return null;
  const out = [];
  for (const v of value) {
    const name = String(v ?? '').trim().slice(0, 40);
    if (name && !out.includes(name)) out.push(name);
  }
  return out.slice(0, 50);
}
// A number within bounds, or null
const numberIn = (v, { min = 0, max = Infinity, whole = false } = {}) => {
  const n = Number(v);
  return v !== '' && v !== null && typeof v !== 'boolean' && Number.isFinite(n) && n >= min && n <= max && (!whole || Number.isInteger(n)) ? n : null;
};

async function updateMyGym(req, res) {
  const {
    name, location, phone, email, currency, logo, payDay,
    altPhone, city, province, country, postal, website,
    facebook, instagram, twitter, schedule,
    registrationFee, registrationFeeRequired, registrationFeeFrequency,
    registrationGracePeriodDays, minUpfrontPercent, paymentDeadlineDays,
    managerCode, settings,
  } = req.body;

  const refuse = (error, field) => res.status(400).json({ error, field });
  const data = {};
  if (name !== undefined) {
    data.name = String(name ?? '').trim();
    if (!data.name) return refuse('The gym needs a name.', 'name');
  }
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
  // Only a currency GEM can show: an unknown one was stored, then ignored by the
  // screens and printed as a bare code on receipts
  if (currency !== undefined) {
    const code = String(currency ?? '').trim().toUpperCase();
    if (!SYMBOLS[code]) return refuse('Choose one of the currencies GEM supports.', 'currency');
    data.currency = code;
  }
  if (registrationFee !== undefined) {
    const n = numberIn(registrationFee);
    if (n === null) return refuse('Enter the registration fee as a number.', 'registrationFee');
    data.registrationFee = Math.round(n);
  }
  if (registrationFeeRequired !== undefined) data.registrationFeeRequired = registrationFeeRequired === true || registrationFeeRequired === 'true';
  if (registrationFeeFrequency !== undefined) {
    if (!FREQUENCIES.includes(registrationFeeFrequency)) return refuse('Choose how often the registration fee is paid.', 'registrationFeeFrequency');
    data.registrationFeeFrequency = registrationFeeFrequency;
  }
  for (const [field, value, max] of [['registrationGracePeriodDays', registrationGracePeriodDays, 3650], ['minUpfrontPercent', minUpfrontPercent, 100], ['paymentDeadlineDays', paymentDeadlineDays, 3650]]) {
    if (value === undefined) continue;
    const n = numberIn(value, { max, whole: true });
    if (n === null) return refuse(`Enter a whole number from 0 to ${max}.`, field);
    data[field] = n;
  }
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
    const next = { ...settings };
    if ('accessTypes' in next) {
      next.accessTypes = cleanList(next.accessTypes);
      if (!next.accessTypes) return res.status(400).json({ error: 'Send the access types as a list.', field: 'accessTypes' });
    }
    data.settings = { ...(previous?.settings || {}), ...next };
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
  delete gym.managerCode;
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

// ── PUT /api/gyms/me/product-categories { categories } ───────────────────────
// The shop's categories belong to the gym, not to one browser. The desk adds
// products, so it may change the list too (the rest of the settings are the
// owner's).
async function setProductCategories(req, res) {
  const list = cleanList(req.body?.categories);
  if (!list) return res.status(400).json({ error: 'Send the categories as a list.', field: 'categories' });
  const gym = await prisma.gym.findUnique({ where: { id: req.user.gymId }, select: { settings: true } });
  await prisma.gym.update({ where: { id: req.user.gymId }, data: { settings: { ...(gym?.settings || {}), productCategories: list } } });
  logActivity(req, { category: 'settings', action: 'gym.product_categories', summary: `Set the shop's product categories: ${list.join(', ') || 'none'}` });
  res.json({ productCategories: list });
}

module.exports = { getGymByCode, getMyGym, updateMyGym, getSetup, confirmSetupSection, setProductCategories };
