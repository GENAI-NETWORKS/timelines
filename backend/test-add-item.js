require('dotenv').config();
const pool = require('./src/utils/db');
const { v4: uuidv4 } = require('uuid');

async function testAddItem() {
  try {
    const [rows] = await pool.query('SELECT * FROM TailoringOrderItem LIMIT 1');
    if (rows.length === 0) {
      console.log('No tailoring orders found.');
      process.exit(1);
    }
    const item = rows[0];
    console.log('details type:', typeof item.details, item.details);
    console.log('subItems type:', typeof item.subItems, item.subItems);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

testAddItem();
