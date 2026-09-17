const mysql = require('mysql2/promise');

async function test() {
  try {
    console.log('Connecting to srv1128.hstgr.io...');
    const conn = await mysql.createConnection({
      host: 'srv1128.hstgr.io',
      user: 'u416856653_timelines',
      password: 'Timelines@2026',
      database: 'u416856653_timelines',
      connectTimeout: 10000
    });
    console.log('✅ Connection successful!');
    await conn.end();
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
  }
}
test();
