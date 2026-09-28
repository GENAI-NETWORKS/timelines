require('dotenv').config();
const pool = require('./src/utils/db');

async function testDelete() {
  try {
    const [rows] = await pool.query('SELECT id FROM TailoringOrderItem LIMIT 1');
    if (rows.length === 0) {
      console.log('No items found');
      process.exit(1);
    }
    const itemId = rows[0].id;
    console.log(`Found item ID: "${itemId}"`);

    const [result] = await pool.execute(`DELETE FROM TailoringOrderItem WHERE id = ?`, [itemId]);
    console.log('Delete result:', result);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

testDelete();
