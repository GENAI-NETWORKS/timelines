const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { protect, adminOnly } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Generate unique barcode: E.g., TL-XXXXXX or numeric timestamp-based
async function generateUniqueBarcode() {
  while (true) {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const code = `TL${randomSuffix}`;
    const [rows] = await db.query('SELECT id FROM BillingProduct WHERE barcode = ?', [code]);
    if (rows.length === 0) return code;
  }
}

// GET /api/billing-products — list all products
router.get('/', protect, async (req, res, next) => {
  try {
    const { search = '', page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    let whereClause = '';
    let params = [];
    if (search) {
      whereClause = 'WHERE name LIKE ? OR barcode LIKE ?';
      const likeS = `%${search}%`;
      params = [likeS, likeS];
    }

    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM BillingProduct ${whereClause}`, params);
    const [products] = await db.query(
      `SELECT * FROM BillingProduct ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      [...params, take, skip]
    );

    res.json({ products, total, page: parseInt(page), limit: take });
  } catch (err) {
    next(err);
  }
});

// GET /api/billing-products/barcode/:barcode — scan lookup
router.get('/barcode/:barcode', protect, async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM BillingProduct WHERE barcode = ?', [req.params.barcode]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Product not found with this barcode.' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/billing-products — create new product
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { name, price, quantity, category = '', barcode: customBarcode } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Product name is required.' });
    }

    const id = uuidv4();
    const barcode = customBarcode && customBarcode.trim() !== ''
      ? customBarcode.trim()
      : await generateUniqueBarcode();

    const numPrice = parseFloat(price) || 0;
    const numQty = parseInt(quantity, 10) || 0;

    await db.execute(
      `INSERT INTO BillingProduct (id, barcode, name, price, quantity, category, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, barcode, name.trim(), numPrice, numQty, category]
    );

    const [rows] = await db.query('SELECT * FROM BillingProduct WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Barcode already exists. Please use a unique barcode.' });
    }
    next(err);
  }
});

// PUT /api/billing-products/:id — update product
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const { name, price, quantity, category = '', barcode } = req.body;
    const numPrice = parseFloat(price) || 0;
    const numQty = parseInt(quantity, 10) || 0;

    await db.execute(
      `UPDATE BillingProduct SET name = ?, price = ?, quantity = ?, category = ?, barcode = ?, updatedAt = NOW() WHERE id = ?`,
      [name, numPrice, numQty, category, barcode, req.params.id]
    );

    const [rows] = await db.query('SELECT * FROM BillingProduct WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Product not found.' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/billing-products/:id — delete product
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    await db.execute('DELETE FROM BillingProduct WHERE id = ?', [req.params.id]);
    res.json({ message: 'Product deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
