require('dotenv').config();
const prisma = require('./src/utils/prisma');

async function main() {
  await prisma.payRecord.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.communication.deleteMany({});
  await prisma.calendarEvent.deleteMany({});
  await prisma.timeCard.deleteMany({});
  await prisma.saleItem.deleteMany({});
  await prisma.sale.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.equipmentIssue.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.member.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.package.deleteMany({});
  await prisma.staff.deleteMany({});
  await prisma.gym.deleteMany({});
  console.log('All records deleted.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
