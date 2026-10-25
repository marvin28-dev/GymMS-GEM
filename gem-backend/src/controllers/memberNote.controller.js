const prisma = require('../utils/prisma');
const { logActivity } = require('../utils/activityLog');
const { actorName } = require('./expense.controller');

// A member's notes are the desk's and management's, read and written by them
// alone (D-32). They were kept in the browser that wrote them.
const CATEGORIES = ['General', 'Health', 'Financial', 'Other'];
const MAX_TEXT = 2000;
const SELECT = { id: true, category: true, text: true, authorName: true, authorId: true, createdAt: true };

const memberOf = (req) => prisma.member.findFirst({
  where: { gymId: req.user.gymId, OR: [{ id: req.params.id }, { memberCode: req.params.id }] },
  select: { id: true, firstName: true, lastName: true },
});

const listOf = (gymId, memberId) => prisma.memberNote.findMany({
  where: { gymId, memberId },
  orderBy: { createdAt: 'desc' },
  select: SELECT,
});

async function list(req, res) {
  const member = await memberOf(req);
  if (!member) return res.status(404).json({ error: 'Member not found' });
  res.json(await listOf(req.user.gymId, member.id));
}

async function add(req, res) {
  const text = String(req.body?.text ?? '').trim();
  if (!text) return res.status(400).json({ error: 'Write the note.', field: 'text' });
  if (text.length > MAX_TEXT) return res.status(400).json({ error: `A note is at most ${MAX_TEXT} characters.`, field: 'text' });
  const category = CATEGORIES.includes(req.body?.category) ? req.body.category : 'General';
  const member = await memberOf(req);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  const note = await prisma.memberNote.create({
    data: { gymId: req.user.gymId, memberId: member.id, authorId: req.user.id, authorName: (await actorName(req)) || 'Staff', category, text },
    select: SELECT,
  });
  logActivity(req, {
    category: 'members', action: 'member.note_added',
    summary: `Added a ${category.toLowerCase()} note to ${member.firstName} ${member.lastName}'s profile`,
    target: { type: 'member', id: member.id },
  });
  res.status(201).json(note);
}

// The notes a browser kept before D-32, handed over once by that browser. They
// keep the name and the day they were written with, as far as it can be read.
async function importNotes(req, res) {
  const notes = req.body?.notes;
  if (!Array.isArray(notes) || notes.length > 200) return res.status(400).json({ error: 'Send the notes as a list.' });
  const member = await memberOf(req);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  const now = new Date();
  const rows = notes.map((n) => {
    const text = String(n?.content ?? '').trim().slice(0, MAX_TEXT);
    const written = new Date(String(n?.date ?? ''));
    return text && {
      gymId: req.user.gymId,
      memberId: member.id,
      authorName: String(n?.author ?? '').trim().slice(0, 80) || 'Staff',
      category: CATEGORIES.includes(n?.category) ? n.category : 'Other',
      text,
      createdAt: Number.isNaN(written.getTime()) || written > now ? now : written,
    };
  }).filter(Boolean);
  if (rows.length) {
    await prisma.memberNote.createMany({ data: rows });
    logActivity(req, {
      category: 'members', action: 'member.notes_imported',
      summary: `Moved ${rows.length} note${rows.length === 1 ? '' : 's'} about ${member.firstName} ${member.lastName} from this browser to the gym's records`,
      target: { type: 'member', id: member.id },
    });
  }
  res.status(201).json(await listOf(req.user.gymId, member.id));
}

module.exports = { list, add, importNotes };
