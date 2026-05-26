const prisma = require('../utils/prisma');

async function getGymByCode(req, res) {
  const gym = await prisma.gym.findUnique({
    where: { code: req.params.code },
    select: { id: true, code: true, name: true, location: true, phone: true, email: true },
  });
  if (!gym) return res.status(404).json({ error: 'Gym not found' });
  res.json(gym);
}

async function getMyGym(req, res) {
  const gym = await prisma.gym.findUnique({
    where: { id: req.user.gymId },
  });
  res.json(gym);
}

async function updateMyGym(req, res) {
  const {
    name, location, phone, email, currency,
    registrationFee, registrationFeeRequired, registrationFeeFrequency,
    registrationGracePeriodDays, minUpfrontPercent, paymentDeadlineDays,
    managerCode,
  } = req.body;

  const data = {};
  if (name !== undefined) data.name = name;
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

  const gym = await prisma.gym.update({ where: { id: req.user.gymId }, data });
  res.json(gym);
}

module.exports = { getGymByCode, getMyGym, updateMyGym };
