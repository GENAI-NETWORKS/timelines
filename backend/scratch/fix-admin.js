const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function fixDb() {
  try {
    console.log('Connecting to Hostinger DB from local machine...');
    const conn = await mysql.createConnection({
      host: 'srv1128.hstgr.io',
      user: 'u416856653_timelines',
      password: 'Timelines@2026',
      database: 'u416856653_timelines',
      connectTimeout: 10000
    });
    console.log('✅ Connected!');

    // Hash the password Admin@2026
    const hash = await bcrypt.hash('Admin@2026', 12);

    console.log('Updating admin@timelines.in password...');
    const [result] = await conn.execute(
      `UPDATE User SET password = ?, isActive = 1 WHERE email = 'admin@timelines.in'`,
      [hash]
    );

    if (result.affectedRows === 0) {
      console.log('Admin user not found. Inserting new admin...');
      const cuid = require('crypto').randomBytes(12).toString('hex');
      await conn.execute(
        `INSERT INTO User (id, name, email, password, role, isActive) VALUES (?, 'Admin User', 'admin@timelines.in', ?, 'admin', 1)`,
        [cuid, hash]
      );
    }
    
    console.log('✅ Admin password updated to Admin@2026 successfully!');
    await conn.end();
  } catch (err) {
    console.error('❌ Failed:', err.message);
  }
}
fixDb();
