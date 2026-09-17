const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { protect, adminOnly } = require('../middleware/auth');
const { logCreate, logUpdate, logDelete } = require('../utils/auditLogger');

// ─── Auto-generate Customer ID: TC-YYYY-XXXX ─────────────────────────────
async function generateCustomerId() {
  const year = new Date().getFullYear();
  const prefix = `TC-${year}-`;
  const [rows] = await db.query(
    `SELECT customerId FROM Customer WHERE customerId LIKE ? ORDER BY customerId DESC LIMIT 1`,
    [`${prefix}%`]
  );
  const last = rows[0];
  if (!last) return `${prefix}0001`;
  const num = parseInt(last.customerId.split('-')[2], 10) + 1;
  return `${prefix}${String(num).padStart(4, '0')}`;
}

// GET /api/customers/search?q=  — typeahead (must be before /:id)
router.get('/search', protect, async (req, res, next) => {
  try {
    const { q = '' } = req.query;
    let query = `SELECT customerId, name, phone, address, email FROM Customer`;
    let params = [];
    if (q) {
      query += ` WHERE name LIKE ? OR phone LIKE ? OR customerId LIKE ?`;
      const likeQ = `%${q}%`;
      params = [likeQ, likeQ, likeQ];
    }
    query += ` ORDER BY name ASC LIMIT 15`;
    const [customers] = await db.query(query, params);
    res.json(customers);
  } catch (err) { next(err); }
});

// GET /api/customers
router.get('/', protect, async (req, res, next) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    let whereClause = '';
    let params = [];
    if (search) {
      whereClause = `WHERE name LIKE ? OR phone LIKE ? OR customerId LIKE ? OR email LIKE ?`;
      const likeS = `%${search}%`;
      params = [likeS, likeS, likeS, likeS];
    }

    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM Customer ${whereClause}`, params);
    const [customers] = await db.query(
      `SELECT * FROM Customer ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      [...params, take, skip]
    );

    res.json({ customers, total, page: parseInt(page), limit: take });
  } catch (err) { next(err); }
});

// GET /api/customers/:id
router.get('/:id', protect, async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT * FROM Customer WHERE customerId = ?`, [req.params.id]);
    const customer = rows[0];
    if (!customer) return res.status(404).json({ message: 'Customer not found.' });
    res.json(customer);
  } catch (err) { next(err); }
});

// POST /api/customers
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { name, phone, address = '', email = '', notes = '' } = req.body;
    const customerId = await generateCustomerId();
    await db.execute(
      `INSERT INTO Customer (customerId, name, phone, address, email, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [customerId, name, phone, address, email, notes]
    );
    const [rows] = await db.query(`SELECT * FROM Customer WHERE customerId = ?`, [customerId]);
    const customer = rows[0];
    await logCreate('Customer', customer.customerId, req.user, customer);
    res.status(201).json(customer);
  } catch (err) { next(err); }
});

// PUT /api/customers/:id
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT * FROM Customer WHERE customerId = ?`, [req.params.id]);
    const old = rows[0];
    if (!old) return res.status(404).json({ message: 'Customer not found.' });

    const { name, phone, address, email, notes } = req.body;
    await db.execute(
      `UPDATE Customer SET name = ?, phone = ?, address = ?, email = ?, notes = ?, updatedAt = NOW() WHERE customerId = ?`,
      [name, phone, address, email, notes, req.params.id]
    );
    const [newRows] = await db.query(`SELECT * FROM Customer WHERE customerId = ?`, [req.params.id]);
    const updated = newRows[0];
    await logUpdate('Customer', updated.customerId, req.user, old, updated);
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/customers/:id
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT * FROM Customer WHERE customerId = ?`, [req.params.id]);
    const customer = rows[0];
    if (!customer) return res.status(404).json({ message: 'Customer not found.' });

    await logDelete('Customer', customer.customerId, req.user, customer);
    await db.execute(`DELETE FROM Customer WHERE customerId = ?`, [req.params.id]);
    res.json({ message: 'Customer deleted.' });
  } catch (err) { next(err); }
});

// GET /api/customers/:id/audit
router.get('/:id/audit', protect, adminOnly, async (req, res, next) => {
  try {
    const [logs] = await db.query(`
      SELECT a.*, u.name as 'changedBy.name', u.role as 'changedBy.role'
      FROM AuditLog a
      LEFT JOIN User u ON a.changedById = u.id
      WHERE a.recordType = 'Customer' AND a.recordId = ?
      ORDER BY a.timestamp DESC LIMIT 50
    `, [req.params.id]);

    // Format the include to match Prisma's output
    const formattedLogs = logs.map(log => {
      const formatted = { ...log, changedBy: null };
      if (log['changedBy.name']) {
        formatted.changedBy = { name: log['changedBy.name'], role: log['changedBy.role'] };
      }
      delete formatted['changedBy.name'];
      delete formatted['changedBy.role'];
      if(typeof formatted.changes === 'string') formatted.changes = JSON.parse(formatted.changes);
      if(typeof formatted.snapshot === 'string') formatted.snapshot = JSON.parse(formatted.snapshot);
      return formatted;
    });

    res.json(formattedLogs);
  } catch (err) { next(err); }
});

module.exports = router;
