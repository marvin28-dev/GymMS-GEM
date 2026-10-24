const { Resend } = require('resend');
const prisma = require('./prisma');
const { deliver, deliverEach } = require('./sendEmail');
const E = require('./emailLayout');

const PRIORITY_LOOK = { high: ['High', 'red'], medium: ['Medium', 'amber'], low: ['Low', 'green'] };
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
const priorityBadge = (task) => {
  const [label, tone] = PRIORITY_LOOK[String(task.priority || 'medium').toLowerCase()] || PRIORITY_LOOK.medium;
  return E.badge(label, tone);
};

// Tells the assignee a task is waiting and links them straight to their gym's
// login, so they can sign in and see it without hunting for the address.
async function sendTaskAssignedEmail({ task, assigneeId, gymId, assignedByName }) {
  if (!process.env.RESEND_API_KEY) return false;

  const [assignee, gym] = await Promise.all([
    prisma.staff.findFirst({
      where: { id: assigneeId, gymId, isActive: true },
      select: { firstName: true, email: true },
    }),
    prisma.gym.findUnique({ where: { id: gymId }, select: GYM_SELECT }),
  ]);
  if (!assignee?.email || !gym) return false;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const loginUrl = `${frontendUrl}/${gym.code}/login`;
  const due = E.longDate(task.dueDate);

  const body = [
    E.greeting(assignee.firstName),
    E.pHtml(`${E.strong(assignedByName || 'A manager')} has given you a task${due ? `, due on ${E.strong(due)}` : ''}.`),
    taskCard(task, [['Priority', priorityBadge(task)], ['Due', due], ['From', assignedByName || null]]),
    E.button(loginUrl, 'Sign in and view it'),
    E.small(`Or go to ${loginUrl} and sign in with your usual email and password.`),
  ].join('');

  const resend = new Resend(process.env.RESEND_API_KEY);
  await deliver(resend, {
    from: E.sender(gym.name),
    to: assignee.email,
    subject: `New task at ${gym.name}: ${task.title}`,
    html: E.layout({ brand: E.gymBrand(gym), gym, preheader: `${task.title}${due ? `, due ${due}` : ''}`, eyebrow: 'New task', title: 'You have a new task', body }),
  }, gym);
  return true;
}

// A task raised by the system and owned by a department rather than a person.
// Everyone in the department is emailed, because any one of them can act on it.
async function sendGroupTaskEmail({ task, recipients, gymId }) {
  if (!process.env.RESEND_API_KEY) return false;
  const to = (recipients || []).map(r => r.email).filter(Boolean);
  if (to.length === 0) return false;

  const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: GYM_SELECT });
  if (!gym) return false;

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const loginUrl = `${frontendUrl}/${gym.code}/login`;
  const due = E.longDate(task.dueDate);

  const body = [
    E.p(`The system raised this task for management${due ? `, due on ${due}` : ''}. Anyone in management can deal with it.`),
    taskCard(task, [['Assigned to', E.badge('Management', 'gold')], ['Priority', priorityBadge(task)], ['Due', due], ['Raised by', 'The system']]),
    E.button(loginUrl, 'Sign in and review it'),
    E.small(`Or go to ${loginUrl} and sign in with your usual email and password.`),
  ].join('');

  const resend = new Resend(process.env.RESEND_API_KEY);
  const message = (address) => ({
    from: E.sender(gym.name),
    to: address,
    subject: `Management task at ${gym.name}: ${task.title}`,
    html: E.layout({ brand: E.gymBrand(gym), gym, preheader: task.title, eyebrow: 'Task for management', title: 'A task for management', body }),
  });

  return deliverEach(resend, to, message, gym);
}

module.exports = { sendTaskAssignedEmail, sendGroupTaskEmail };
