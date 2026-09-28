require('dotenv').config({ path: './backend/.env' });
const pool = require('./backend/src/utils/db');
const { v4: uuidv4 } = require('uuid');

async function testAddItem() {
  try {
    const [orders] = await pool.query('SELECT id FROM TailoringOrder LIMIT 1');
    if (orders.length === 0) {
      console.log('No tailoring orders found.');
      process.exit(1);
    }
    const orderId2 = orders[0].id;
    console.log(`Using orderId: ${orderId2}`);

    const id = uuidv4();
    const itemType = 'Design Blouse';
    const quantity = 1;
    const count = 0;
    const details = {};
    const subItemsData = [];
    
    console.log('Attempting insert...');
    await pool.execute(
      `INSERT INTO TailoringOrderItem (id, orderId, itemType, quantity, sortOrder, details, subItems, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, orderId2, itemType, quantity, count, JSON.stringify(details), JSON.stringify(subItemsData)]
    );
    console.log('Success!');
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

testAddItem();
