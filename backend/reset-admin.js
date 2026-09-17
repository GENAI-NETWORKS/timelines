/**
 * reset-admin.js
 * Run this once on the Hostinger server to ensure the admin user exists
 * with the correct credentials.
 *
 * Usage: node reset-admin.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('./src/utils/prisma');

const ADMIN_EMAIL    = 'admin@timelines.in';
const ADMIN_PASSWORD = 'Admin@2026';   // ← new password (change if you want)
const ADMIN_NAME     = 'Admin User';

async function main() {
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const user = await prisma.user.upsert({
    where:  { email: ADMIN_EMAIL },
    update: { password: hash, isActive: true, role: 'admin' },
    create: {
      name:     ADMIN_NAME,
      email:    ADMIN_EMAIL,
      password: hash,
      role:     'admin',
      isActive: true,
    },
  });

  console.log('✅ Admin user ready:');
  console.log('   Email   :', ADMIN_EMAIL);
  console.log('   Password:', ADMIN_PASSWORD);
  console.log('   User ID :', user.id);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
