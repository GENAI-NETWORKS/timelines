const mysql = require('mysql2/promise');

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("❌ DATABASE_URL is not set in the environment!");
  process.exit(1);
}

// Ensure the URL is properly formatted for mysql2
// mysql2 can accept a URI string directly.
const pool = mysql.createPool({
  uri: dbUrl,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

pool.getConnection()
  .then(conn => {
    console.log('✅ MySQL connected via raw mysql2 pool');
    conn.release();
  })
  .catch(err => {
    console.error('⚠️ Initial DB connect failed (will retry):', err.message);
  });

module.exports = pool;
