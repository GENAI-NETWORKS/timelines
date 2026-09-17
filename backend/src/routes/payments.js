const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { protect, adminOnly } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const formatPayment = (row) => {
  const formatted = { ...row, customer: null, order: null };
  if (row['customer.customerId']) {
    formatted.customer = { customerId: row['customer.customerId'], name: row['customer.name'] };
  }
  if (row['order.orderId']) {
    formatted.order = { orderId: row['order.orderId'], garmentType: row['order.garmentType'] };
  }
  delete formatted['customer.customerId'];
  delete formatted['customer.name'];
  delete formatted['order.orderId'];
  delete formatted['order.garmentType'];
  return formatted;
};

// GET /api/payments
router.get('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { customerId } = req.query;
    let query = `
      SELECT p.*, 
             c.customerId as 'customer.customerId', c.name as 'customer.name',
             o.orderId as 'order.orderId', o.garmentType as 'order.garmentType'
      FROM Payment p
      LEFT JOIN Customer c ON p.customerId = c.customerId
      LEFT JOIN TailoringOrder o ON p.orderId = o.orderId
    `;
    let params = [];
    if (customerId) {
      query += ` WHERE p.customerId = ?`;
      params.push(customerId);
    }
    query += ` ORDER BY p.paymentDate DESC`;
    
    const [rows] = await db.query(query, params);
    res.json(rows.map(formatPayment));
  } catch (err) { next(err); }
});

// POST /api/payments
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { customerId, orderId, amount, paymentDate, paymentMethod, status, notes } = req.body;
    const id = uuidv4();
    const pDate = paymentDate ? new Date(paymentDate) : new Date();
    
    await db.execute(
      `INSERT INTO Payment (id, customerId, orderId, amount, paymentDate, paymentMethod, status, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, customerId, orderId || null, parseFloat(amount), pDate, paymentMethod || 'Cash', status || 'Completed', notes || '']
    );
    
    const [rows] = await db.query(`
      SELECT p.*, 
             c.customerId as 'customer.customerId', c.name as 'customer.name',
             o.orderId as 'order.orderId', o.garmentType as 'order.garmentType'
      FROM Payment p
      LEFT JOIN Customer c ON p.customerId = c.customerId
      LEFT JOIN TailoringOrder o ON p.orderId = o.orderId
      WHERE p.id = ?
    `, [id]);
    
    res.status(201).json(formatPayment(rows[0]));
  } catch (err) { next(err); }
});

// PUT /api/payments/:id
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const { customerId, orderId, amount, paymentDate, paymentMethod, status, notes } = req.body;
    const [oldRows] = await db.query(`SELECT id FROM Payment WHERE id = ?`, [req.params.id]);
    if (oldRows.length === 0) return res.status(404).json({ message: 'Payment not found' });
    
    let query = `UPDATE Payment SET customerId=?, orderId=?, amount=?, paymentMethod=?, status=?, notes=?, updatedAt=NOW()`;
    let params = [customerId, orderId || null, parseFloat(amount), paymentMethod, status, notes];
    
    if (paymentDate) {
      query += `, paymentDate=?`;
      params.push(new Date(paymentDate));
    }
    query += ` WHERE id=?`;
    params.push(req.params.id);
    
    await db.execute(query, params);
    
    const [newRows] = await db.query(`
      SELECT p.*, 
             c.customerId as 'customer.customerId', c.name as 'customer.name',
             o.orderId as 'order.orderId', o.garmentType as 'order.garmentType'
      FROM Payment p
      LEFT JOIN Customer c ON p.customerId = c.customerId
      LEFT JOIN TailoringOrder o ON p.orderId = o.orderId
      WHERE p.id = ?
    `, [req.params.id]);
    
    res.json(formatPayment(newRows[0]));
  } catch (err) { next(err); }
});

// DELETE /api/payments/:id
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const [oldRows] = await db.query(`SELECT id FROM Payment WHERE id = ?`, [req.params.id]);
    if (oldRows.length === 0) return res.status(404).json({ message: 'Payment not found' });
    
    await db.execute(`DELETE FROM Payment WHERE id = ?`, [req.params.id]);
    res.json({ message: 'Payment deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
