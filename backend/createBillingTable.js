require('dotenv').config();
const pool = require('./src/utils/db');

async function setup() {
  const sql = `
    CREATE TABLE IF NOT EXISTS BillingProduct (
      id VARCHAR(64) PRIMARY KEY,
      barcode VARCHAR(64) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
      quantity INT NOT NULL DEFAULT 0,
      category VARCHAR(100) DEFAULT '',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;
  await pool.query(sql);
  console.log('✅ BillingProduct table ready');
  process.exit(0);
}

setup().catch(err => {
  console.error('Error creating table:', err);
  process.exit(1);
});
