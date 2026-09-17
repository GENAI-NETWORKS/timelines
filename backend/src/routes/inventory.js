const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { protect, adminOnly } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// GET /api/inventory
router.get('/', protect, adminOnly, async (req, res, next) => {
  try {
    const [items] = await db.query(`SELECT * FROM InventoryItem ORDER BY name ASC`);
    res.json(items);
  } catch (err) { next(err); }
});

// POST /api/inventory
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { name, category, quantity, unit, minStockLevel } = req.body;
    const id = uuidv4();
    await db.execute(
      `INSERT INTO InventoryItem (id, name, category, quantity, unit, minStockLevel, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, name, category || 'Raw Material', quantity || 0, unit || 'pcs', minStockLevel || 0]
    );
    const [rows] = await db.query(`SELECT * FROM InventoryItem WHERE id = ?`, [id]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/inventory/:id
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const { name, category, quantity, unit, minStockLevel } = req.body;
    const [oldRows] = await db.query(`SELECT * FROM InventoryItem WHERE id = ?`, [req.params.id]);
    if (oldRows.length === 0) return res.status(404).json({ message: 'Item not found' });
    
    await db.execute(
      `UPDATE InventoryItem SET name=?, category=?, quantity=?, unit=?, minStockLevel=?, updatedAt=NOW() WHERE id=?`,
      [name, category, quantity, unit, minStockLevel, req.params.id]
    );
    
    const [newRows] = await db.query(`SELECT * FROM InventoryItem WHERE id = ?`, [req.params.id]);
    res.json(newRows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/inventory/:id
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const [oldRows] = await db.query(`SELECT * FROM InventoryItem WHERE id = ?`, [req.params.id]);
    if (oldRows.length === 0) return res.status(404).json({ message: 'Item not found' });
    
    await db.execute(`DELETE FROM InventoryItem WHERE id = ?`, [req.params.id]);
    res.json({ message: 'Item deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
