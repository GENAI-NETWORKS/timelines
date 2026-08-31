const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function run() {
  console.log("Starting staff user generation...");
  const employees = await prisma.employee.findMany();
  const defaultPassword = await bcrypt.hash('timelines123', 10);
  
  const created = [];
  
  for (const emp of employees) {
    let emailPrefix = emp.name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    let email = `${emailPrefix}@timelines.in`;
    
    // Check if user with this employeeRef already exists
    let existingUser = await prisma.user.findFirst({ where: { employeeRef: emp.employeeId } });
    
    if (existingUser) {
      console.log(`User already exists for ${emp.name}: ${existingUser.email}`);
      created.push({ name: emp.name, email: existingUser.email, password: '(existing password)' });
      continue;
    }
    
    // Check if email is taken
    let emailTaken = await prisma.user.findUnique({ where: { email } });
    let counter = 1;
    while (emailTaken) {
      email = `${emailPrefix}${counter}@timelines.in`;
      emailTaken = await prisma.user.findUnique({ where: { email } });
      counter++;
    }
    
    await prisma.user.create({
      data: {
        name: emp.name,
        email: email,
        password: defaultPassword,
        role: 'staff',
        employeeRef: emp.employeeId,
      }
    });
    console.log(`Created user for ${emp.name}: ${email}`);
    created.push({ name: emp.name, email: email, password: 'timelines123' });
  }
  
  console.log("\n=== SUMMARY OF STAFF ACCOUNTS ===");
  console.table(created);
}

run().catch(console.error).finally(() => prisma.$disconnect());
