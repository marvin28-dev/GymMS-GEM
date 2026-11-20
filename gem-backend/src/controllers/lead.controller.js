// Gyms that might use GEM: the landing page's "Book a demo" form (public), and
// the admin's list of them, added to by hand and followed up
const prisma = require('../utils/prisma');
const { attemptCounter, refuseTooMany } = require('../utils/attempts');
const { sendLeadAlert } = require('../utils/gemEmail');
const { bestEffort } = require('../utils/bestEffort');

const STATUSES = ['new', 'contacted', 'demo', 'won', 'lost'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Five a hour from one address is plenty for a person, and stops a script
const fromAddress = attemptCounter({ max: 5, windowMs: 60 * 60 * 1000 });

// The lead's details from a form, checked; { error, field } when one is wrong
function readLead(b, { partial = false } = {}) {
  const out = {};
  const text = (key, label, max, required) => {
    if (partial && !(key in b)) return null;
    const v = String(b[key] ?? '').trim();
    if (required && !v) return { error: `${label} is needed.`, field: key };
    if (v.length > max) return { error: `Keep ${label.toLowerCase()} under ${max} characters.`, field: key };
    out[key] = v || null;
    return null;
  };
  const problem = text('name', 'Your name', 80, true) || text('gymName', 'The gym\'s name', 120, true)
    || text('email', 'The email', 160, false) || text('phone', 'The phone number', 40, false)
    || text('city', 'The city', 80, false) || text('country', 'The country', 80, false)
    || text('message', 'The message', 2000, false);
  if (problem) return problem;
  if (out.email && !EMAIL_RE.test(out.email)) return { error: 'Enter a valid email address.', field: 'email' };
  if (out.phone && out.phone.replace(/\D/g, '').length < 6) return { error: 'Enter a phone number we can reach.', field: 'phone' };
  if (!partial && !out.email && !out.phone) return { error: 'Give an email or a phone number so we can reach you.', field: 'email' };
  if (!partial || 'members' in b) {
    if (b.members === undefined || b.members === null || b.members === '') out.members = null;
    else {
      const n = Number(b.members);
      if (!Number.isInteger(n) || n < 0 || n > 100000) return { error: 'Give the number of members as a whole number.', field: 'members' };
      out.members = n;
    }
  }
  return { data: out };
}

// ── POST /api/leads (public) ─────────────────────────────────────────────────
async function create(req, res) {
  const wait = fromAddress.lockedFor(req.ip);
  if (wait) return refuseTooMany(res, wait);
  // A box people never see: only a script fills it in. It is told it worked.
  if (String(req.body?.website ?? '').trim()) return res.status(201).json({ received: true });
  const read = readLead(req.body || {});
  if (read.error) return res.status(400).json(read);
  fromAddress.count(req.ip);
  const lead = await prisma.lead.create({ data: { ...read.data, source: 'website' } });
  bestEffort(sendLeadAlert(lead), 'New lead email');
  res.status(201).json({ received: true });
}

// ── GET /api/admin/leads ─────────────────────────────────────────────────────
async function list(req, res) {
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: 'desc' }, take: 1000 });
  const gymIds = [...new Set(leads.map(l => l.gymId).filter(Boolean))];
  const gyms = gymIds.length ? await prisma.gym.findMany({ where: { id: { in: gymIds } }, select: { id: true, name: true, code: true } }) : [];
  const gymBy = new Map(gyms.map(g => [g.id, g]));
  res.json(leads.map(l => ({ ...l, gym: l.gymId ? gymBy.get(l.gymId) || null : null })));
}

function readFollowUp(b) {
  if (!('nextFollowUp' in b)) return {};
  if (b.nextFollowUp === null || b.nextFollowUp === '') return { data: null };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(b.nextFollowUp));
  const at = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 9) : new Date(NaN);
  return Number.isNaN(at.getTime()) ? { error: 'Choose a day to follow up.', field: 'nextFollowUp' } : { data: at };
}

// ── POST /api/admin/leads ────────────────────────────────────────────────────
async function adminCreate(req, res) {
  const b = req.body || {};
  const read = readLead(b);
  if (read.error) return res.status(400).json(read);
  const status = STATUSES.includes(b.status) ? b.status : 'new';
  const follow = readFollowUp(b);
  if (follow.error) return res.status(400).json(follow);
  const notes = String(b.notes ?? '').trim().slice(0, 4000) || null;
  const lead = await prisma.lead.create({ data: { ...read.data, source: 'manual', status, notes, ...(follow.data !== undefined ? { nextFollowUp: follow.data } : {}) } });
  res.status(201).json({ ...lead, gym: null });
}

// ── PATCH /api/admin/leads/:id ───────────────────────────────────────────────
async function update(req, res) {
  const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const b = req.body || {};
  const read = readLead(b, { partial: true });
  if (read.error) return res.status(400).json(read);
  const data = { ...read.data };
  if ('status' in b) {
    if (!STATUSES.includes(b.status)) return res.status(400).json({ error: 'Choose a stage.', field: 'status' });
    data.status = b.status;
  }
  if ('notes' in b) {
    const notes = String(b.notes ?? '').trim();
    if (notes.length > 4000) return res.status(400).json({ error: 'Keep the notes under 4,000 characters.', field: 'notes' });
    data.notes = notes || null;
  }
  const follow = readFollowUp(b);
  if (follow.error) return res.status(400).json(follow);
  if (follow.data !== undefined) data.nextFollowUp = follow.data;
  // The finished stages need no more follow-up
  if (['won', 'lost'].includes(data.status)) data.nextFollowUp = null;
  const saved = await prisma.lead.update({ where: { id: lead.id }, data });
  const gym = saved.gymId ? await prisma.gym.findUnique({ where: { id: saved.gymId }, select: { id: true, name: true, code: true } }) : null;
  res.json({ ...saved, gym });
}

module.exports = { create, list, adminCreate, update };
