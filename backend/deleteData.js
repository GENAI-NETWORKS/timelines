const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.payment.deleteMany({});
  await prisma.tailoringOrderItem.deleteMany({});
  await prisma.tailoringOrder.deleteMany({});
  await prisma.orderParticular.deleteMany({});
  await prisma.orderDesignSection.deleteMany({});
  await prisma.designOrder.deleteMany({});
  await prisma.customer.deleteMany({});
  console.log('All customer data deleted successfully.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
