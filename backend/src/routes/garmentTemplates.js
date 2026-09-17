const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { protect, adminOnly } = require('../middleware/auth');
const { logCreate, logUpdate, logDelete } = require('../utils/auditLogger');
const { v4: uuidv4 } = require('uuid');

const formatTemplate = (row) => {
  if (!row) return row;
  const formatted = { ...row };
  if (typeof formatted.fields === 'string') {
    try { formatted.fields = JSON.parse(formatted.fields); } catch (e) { formatted.fields = []; }
  }
  formatted.isActive = !!formatted.isActive;
  return formatted;
};

// GET all templates
router.get('/', protect, async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT * FROM GarmentTemplate ORDER BY garmentType ASC`);
    res.json(rows.map(formatTemplate));
  } catch (err) { next(err); }
});

// GET template by garment type name
router.get('/type/:garmentType', protect, async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT * FROM GarmentTemplate WHERE garmentType = ?`, [decodeURIComponent(req.params.garmentType)]);
    const tpl = rows[0];
    if (!tpl) return res.status(404).json({ message: 'Template not found.' });
    res.json(formatTemplate(tpl));
  } catch (err) { next(err); }
});

// GET single template by id
router.get('/:id', protect, async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT * FROM GarmentTemplate WHERE id = ?`, [req.params.id]);
    const tpl = rows[0];
    if (!tpl) return res.status(404).json({ message: 'Template not found.' });
    res.json(formatTemplate(tpl));
  } catch (err) { next(err); }
});

// POST create template
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { garmentType, fields, isActive = true } = req.body;
    const id = uuidv4();
    
    await db.execute(
      `INSERT INTO GarmentTemplate (id, garmentType, fields, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [id, garmentType, JSON.stringify(fields || []), isActive ? 1 : 0]
    );
    
    const [rows] = await db.query(`SELECT * FROM GarmentTemplate WHERE id = ?`, [id]);
    const tpl = formatTemplate(rows[0]);
    await logCreate('GarmentTemplate', tpl.id, req.user, tpl);
    res.status(201).json(tpl);
  } catch (err) { next(err); }
});

// PUT update template
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const [oldRows] = await db.query(`SELECT * FROM GarmentTemplate WHERE id = ?`, [req.params.id]);
    const old = formatTemplate(oldRows[0]);
    if (!old) return res.status(404).json({ message: 'Template not found.' });
    
    const { garmentType, fields, isActive } = req.body;
    await db.execute(
      `UPDATE GarmentTemplate SET garmentType=?, fields=?, isActive=?, updatedAt=NOW() WHERE id=?`,
      [garmentType, JSON.stringify(fields || []), isActive !== undefined ? (isActive ? 1 : 0) : old.isActive, req.params.id]
    );
    
    const [newRows] = await db.query(`SELECT * FROM GarmentTemplate WHERE id = ?`, [req.params.id]);
    const updated = formatTemplate(newRows[0]);
    await logUpdate('GarmentTemplate', updated.id, req.user, old, updated);
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE template
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT * FROM GarmentTemplate WHERE id = ?`, [req.params.id]);
    const tpl = formatTemplate(rows[0]);
    if (!tpl) return res.status(404).json({ message: 'Template not found.' });
    
    await logDelete('GarmentTemplate', tpl.id, req.user, tpl);
    await db.execute(`DELETE FROM GarmentTemplate WHERE id = ?`, [req.params.id]);
    res.json({ message: 'Template deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
