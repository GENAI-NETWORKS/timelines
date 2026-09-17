const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { protect, adminOnly } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// GET /api/services
router.get('/', protect, adminOnly, async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT * FROM Service ORDER BY name ASC`);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/services
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { name, description, basePrice, isActive } = req.body;
    const id = uuidv4();
    
    await db.execute(
      `INSERT INTO Service (id, name, description, basePrice, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, name, description || '', parseFloat(basePrice) || 0, isActive !== undefined ? (isActive ? 1 : 0) : 1]
    );
    
    const [rows] = await db.query(`SELECT * FROM Service WHERE id = ?`, [id]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/services/:id
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const { name, description, basePrice, isActive } = req.body;
    const [oldRows] = await db.query(`SELECT * FROM Service WHERE id = ?`, [req.params.id]);
    if (oldRows.length === 0) return res.status(404).json({ message: 'Service not found' });
    
    await db.execute(
      `UPDATE Service SET name=?, description=?, basePrice=?, isActive=?, updatedAt=NOW() WHERE id=?`,
      [name, description, parseFloat(basePrice) || 0, isActive ? 1 : 0, req.params.id]
    );
    
    const [newRows] = await db.query(`SELECT * FROM Service WHERE id = ?`, [req.params.id]);
    res.json(newRows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/services/:id
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const [oldRows] = await db.query(`SELECT * FROM Service WHERE id = ?`, [req.params.id]);
    if (oldRows.length === 0) return res.status(404).json({ message: 'Service not found' });
    
    await db.execute(`DELETE FROM Service WHERE id = ?`, [req.params.id]);
    res.json({ message: 'Service deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
