
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clean() {
  const users = await prisma.user.findMany();
  for (const user of users) {
    if (user.employeeRef) {
      const emp = await prisma.employee.findUnique({ where: { employeeId: user.employeeRef } });
      if (emp && emp.role !== 'Tailor' && emp.role !== 'Designer') {
        console.log('Deleting user for:', emp.name, emp.role);
        await prisma.user.delete({ where: { id: user.id } });
      }
    }
  }
  console.log('Clean up done.');
}
clean().finally(() => prisma.$disconnect());

