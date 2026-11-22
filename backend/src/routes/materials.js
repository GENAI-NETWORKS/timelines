const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { protect, adminOnly, requirePermission } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Ensure Materials table exists
async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS Materials (
      id          VARCHAR(64)    PRIMARY KEY,
      name        VARCHAR(255)   NOT NULL,
      stockIn     DECIMAL(12,2)  NOT NULL DEFAULT 0,
      stockOut    DECIMAL(12,2)  NOT NULL DEFAULT 0,
      pricing     DECIMAL(12,2)  NOT NULL DEFAULT 0,
      unit        VARCHAR(50)    DEFAULT 'pcs',
      notes       TEXT,
      createdAt   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

ensureTable().catch(err => console.error('Materials table init error:', err));

const fmtIST = (dt) => {
  if (!dt) return null;
  const d = dt instanceof Date ? dt : new Date(dt);
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace(' ', 'T') + '+05:30';
};

// GET /api/materials  — list all with optional search
router.get('/', protect, requirePermission('materials'), async (req, res, next) => {
  try {
    await ensureTable().catch(() => {});
    const { search = '' } = req.query;
    const params = [];
    let where = '';
    if (search) {
      where = 'WHERE name LIKE ?';
      params.push(`%${search}%`);
    }
    const [rows] = await db.query(
      `SELECT * FROM Materials ${where} ORDER BY createdAt DESC`,
      params
    );
    const materials = rows.map(r => ({
      ...r,
      stockAvailable: parseFloat(r.stockIn) - parseFloat(r.stockOut),
      createdAt: fmtIST(r.createdAt),
      updatedAt: fmtIST(r.updatedAt),
    }));
    res.json({ materials, total: materials.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/materials/:id  — single
router.get('/:id', protect, requirePermission('materials'), async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM Materials WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Material not found.' });
    const r = rows[0];
    res.json({ ...r, stockAvailable: parseFloat(r.stockIn) - parseFloat(r.stockOut), createdAt: fmtIST(r.createdAt), updatedAt: fmtIST(r.updatedAt) });
  } catch (err) {
    next(err);
  }
});

// POST /api/materials  — create
router.post('/', protect, requirePermission('materials'), async (req, res, next) => {
  try {
    await ensureTable().catch(() => {});
    const { name, stockIn = 0, stockOut = 0, pricing = 0, unit = 'pcs', notes = '' } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required.' });
    const id = uuidv4();
    await db.execute(
      `INSERT INTO Materials (id, name, stockIn, stockOut, pricing, unit, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, name.trim(), stockIn, stockOut, pricing, unit, notes]
    );
    const [rows] = await db.query('SELECT * FROM Materials WHERE id = ?', [id]);
    const r = rows[0];
    res.status(201).json({ ...r, stockAvailable: parseFloat(r.stockIn) - parseFloat(r.stockOut), createdAt: fmtIST(r.createdAt), updatedAt: fmtIST(r.updatedAt) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/materials/:id  — full update
router.put('/:id', protect, requirePermission('materials'), async (req, res, next) => {
  try {
    const { name, stockIn, stockOut, pricing, unit = 'pcs', notes = '' } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required.' });
    const [existing] = await db.query('SELECT id FROM Materials WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: 'Material not found.' });
    await db.execute(
      `UPDATE Materials SET name=?, stockIn=?, stockOut=?, pricing=?, unit=?, notes=?, updatedAt=NOW() WHERE id=?`,
      [name.trim(), stockIn, stockOut, pricing, unit, notes, req.params.id]
    );
    const [rows] = await db.query('SELECT * FROM Materials WHERE id = ?', [req.params.id]);
    const r = rows[0];
    res.json({ ...r, stockAvailable: parseFloat(r.stockIn) - parseFloat(r.stockOut), createdAt: fmtIST(r.createdAt), updatedAt: fmtIST(r.updatedAt) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/materials/:id
router.delete('/:id', protect, requirePermission('materials'), async (req, res, next) => {
  try {
    const [existing] = await db.query('SELECT id FROM Materials WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: 'Material not found.' });
    await db.execute('DELETE FROM Materials WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

