const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { protect, adminOnly } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const formatPurchase = (row) => {
  const formatted = { ...row, item: null };
  if (row['item.id']) {
    formatted.item = {
      id: row['item.id'],
      name: row['item.name'],
      category: row['item.category'],
      quantity: row['item.quantity'],
      unit: row['item.unit'],
      minStockLevel: row['item.minStockLevel']
    };
  }
  delete formatted['item.id'];
  delete formatted['item.name'];
  delete formatted['item.category'];
  delete formatted['item.quantity'];
  delete formatted['item.unit'];
  delete formatted['item.minStockLevel'];
  return formatted;
};

// GET /api/purchases
router.get('/', protect, adminOnly, async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT p.*,
             i.id as 'item.id', i.name as 'item.name', i.category as 'item.category', 
             i.quantity as 'item.quantity', i.unit as 'item.unit', i.minStockLevel as 'item.minStockLevel'
      FROM Purchase p
      LEFT JOIN InventoryItem i ON p.itemId = i.id
      ORDER BY p.purchaseDate DESC
    `);
    res.json(rows.map(formatPurchase));
  } catch (err) { next(err); }
});

// POST /api/purchases
router.post('/', protect, adminOnly, async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { itemId, quantity, totalCost, supplier, purchaseDate } = req.body;
    const id = uuidv4();
    const pDate = purchaseDate ? new Date(purchaseDate) : new Date();

    await conn.execute(
      `INSERT INTO Purchase (id, itemId, quantity, totalCost, supplier, purchaseDate, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, itemId, parseFloat(quantity), parseFloat(totalCost), supplier || '', pDate]
    );

    await conn.execute(
      `UPDATE InventoryItem SET quantity = quantity + ? WHERE id = ?`,
      [parseFloat(quantity), itemId]
    );

    await conn.commit();

    const [rows] = await db.query(`
      SELECT p.*,
             i.id as 'item.id', i.name as 'item.name', i.category as 'item.category', 
             i.quantity as 'item.quantity', i.unit as 'item.unit', i.minStockLevel as 'item.minStockLevel'
      FROM Purchase p
      LEFT JOIN InventoryItem i ON p.itemId = i.id
      WHERE p.id = ?
    `, [id]);
    
    res.status(201).json(formatPurchase(rows[0]));
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// PUT /api/purchases/:id
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { itemId, quantity, totalCost, supplier, purchaseDate } = req.body;
    
    const [oldRows] = await conn.query(`SELECT * FROM Purchase WHERE id = ?`, [req.params.id]);
    const old = oldRows[0];
    if (!old) {
      await conn.rollback();
      return res.status(404).json({ message: 'Purchase not found' });
    }

    // Revert old quantity
    await conn.execute(
      `UPDATE InventoryItem SET quantity = quantity - ? WHERE id = ?`,
      [old.quantity, old.itemId]
    );

    // Update purchase
    let query = `UPDATE Purchase SET itemId=?, quantity=?, totalCost=?, supplier=?, updatedAt=NOW()`;
    let params = [itemId, parseFloat(quantity), parseFloat(totalCost), supplier || ''];
    if (purchaseDate) {
      query += `, purchaseDate=?`;
      params.push(new Date(purchaseDate));
    }
    query += ` WHERE id=?`;
    params.push(req.params.id);
    
    await conn.execute(query, params);

    // Apply new quantity
    await conn.execute(
      `UPDATE InventoryItem SET quantity = quantity + ? WHERE id = ?`,
      [parseFloat(quantity), itemId]
    );

    await conn.commit();

    const [newRows] = await db.query(`
      SELECT p.*,
             i.id as 'item.id', i.name as 'item.name', i.category as 'item.category', 
             i.quantity as 'item.quantity', i.unit as 'item.unit', i.minStockLevel as 'item.minStockLevel'
      FROM Purchase p
      LEFT JOIN InventoryItem i ON p.itemId = i.id
      WHERE p.id = ?
    `, [req.params.id]);
    
    res.json(formatPurchase(newRows[0]));
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// DELETE /api/purchases/:id
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [oldRows] = await conn.query(`SELECT * FROM Purchase WHERE id = ?`, [req.params.id]);
    const old = oldRows[0];
    if (!old) {
      await conn.rollback();
      return res.status(404).json({ message: 'Purchase not found' });
    }
    
    await conn.execute(`DELETE FROM Purchase WHERE id = ?`, [req.params.id]);
    
    await conn.execute(
      `UPDATE InventoryItem SET quantity = quantity - ? WHERE id = ?`,
      [old.quantity, old.itemId]
    );

    await conn.commit();
    res.json({ message: 'Purchase deleted' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

module.exports = router;
