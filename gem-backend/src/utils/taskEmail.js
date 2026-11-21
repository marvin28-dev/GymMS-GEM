const { Resend } = require('resend');
const prisma = require('./prisma');
const { deliver, deliverEach } = require('./sendEmail');
const E = require('./emailLayout');
const { TEXT, textFor, languageOf } = require('./staffEmailText');

const PRIORITY_TONE = { high: 'red', medium: 'amber', low: 'green' };
const GYM_SELECT = { name: true, code: true, logo: true, phone: true, email: true, website: true, location: true, city: true, country: true };

// The task itself: its title, what it is about, and its particulars
function taskCard(task, rows) {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:separate;"><tr>
    <td style="border:1px solid #ececef;border-radius:14px;padding:18px 20px;">
      <div style="font-family:'Manrope','Segoe UI',Helvetica,Arial,sans-serif;font-size:17px;font-weight:800;color:#16161d;line-height:1.35;">${E.esc(task.title)}</div>
      ${task.description ? `<div style="font-family:'DM Sans','Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:#45454f;margin-top:6px;">${E.esc(task.description)}</div>` : ''}
      <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
      ${E.details(rows).replace('margin:0 0 20px', 'margin:0')}
    </td>
  </tr></table>`;
}
const priorityBadge = (task, T = TEXT.en) => {
  const key = PRIORITY_TONE[String(task.priority || 'medium').toLowerCase()] ? String(task.priority).toLowerCase() : 'medium';
  return E.badge(T.task.priorities[key], PRIORITY_TONE[key]);
};

// Tells the assignee a task is waiting and links them straight to their gym's
// login, so they can sign in and see it without hunting for the address.
async function sendTaskAssignedEmail({ task, assigneeId, gymId, assignedByName }) {
  if (!process.env.RESEND_API_KEY) return false;

  const [assignee, gym] = await Promise.all([
    prisma.staff.findFirst({
      where: { id: assigneeId, gymId, isActive: true },
      select: { firstName: true, email: true, language: true },
    }),
    prisma.gym.findUnique({ where: { id: gymId }, select: GYM_SELECT }),
  ]);
  if (!assignee?.email || !gym) return false;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const loginUrl = `${frontendUrl}/${gym.code}/login`;
  const lang = languageOf(assignee), T = textFor(assignee), K = T.task;
  const due = E.longDate(task.dueDate, lang);

  const body = [
    E.greeting(assignee.firstName, lang),
    E.pHtml(K.given(E.strong(assignedByName || K.aManager), due ? E.strong(due) : '')),
    taskCard(task, [[K.priority, priorityBadge(task, T)], [K.due, due], [K.from, assignedByName || null]]),
    E.button(loginUrl, K.view),
    E.small(T.orGoTo(loginUrl)),
  ].join('');

  const resend = new Resend(process.env.RESEND_API_KEY);
  await deliver(resend, {
    from: E.sender(gym.name),
    to: assignee.email,
    subject: K.subject(gym.name, task.title),
    html: E.layout({ lang, brand: E.gymBrand(gym), gym, preheader: K.preheader(task.title, due), eyebrow: K.eyebrow, title: K.title, body }),
  }, gym);
  return true;
}

// A task raised by the system and owned by a department rather than a person.
// Everyone in the department is emailed, because any one of them can act on it.
async function sendGroupTaskEmail({ task, recipients, gymId }) {
  if (!process.env.RESEND_API_KEY) return false;
  // Each person is written to in their own language
  const people = new Map((recipients || []).filter(r => r?.email).map(r => [r.email, r]));
  const to = [...people.keys()];
  if (to.length === 0) return false;

  const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: GYM_SELECT });
  if (!gym) return false;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const loginUrl = `${frontendUrl}/${gym.code}/login`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const message = (address) => {
    const person = people.get(address);
    const lang = languageOf(person), T = textFor(person), G = T.task.group;
    const due = E.longDate(task.dueDate, lang);
    const body = [
      E.p(G.line(due)),
      taskCard(task, [[G.assignedTo, E.badge(G.management, 'gold')], [T.task.priority, priorityBadge(task, T)], [T.task.due, due], [G.raisedBy, G.theSystem]]),
      E.button(loginUrl, G.review),
      E.small(T.orGoTo(loginUrl)),
    ].join('');
    return {
      from: E.sender(gym.name),
      to: address,
      subject: G.subject(gym.name, task.title),
      html: E.layout({ lang, brand: E.gymBrand(gym), gym, preheader: task.title, eyebrow: G.eyebrow, title: G.title, body }),
    };
  };

  return deliverEach(resend, to, message, gym);
}

module.exports = { sendTaskAssignedEmail, sendGroupTaskEmail };
