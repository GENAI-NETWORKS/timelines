const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { protect } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Ensure OrderItemPreset table exists
let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS OrderItemPreset (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      icon VARCHAR(50) DEFAULT 'Scissors',
      config JSON NOT NULL,
      defaultPrice DECIMAL(10,2) DEFAULT 0,
      defaultMeter VARCHAR(50) DEFAULT '',
      description VARCHAR(255) DEFAULT '',
      sortOrder INT DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  tableReady = true;
}

// ── GET /api/order-item-presets  — list all presets
router.get('/', protect, async (req, res, next) => {
  try {
    await ensureTable();
    const [rows] = await db.query('SELECT * FROM OrderItemPreset ORDER BY sortOrder ASC, createdAt ASC');
    const presets = rows.map(r => ({
      ...r,
      config: typeof r.config === 'string' ? JSON.parse(r.config) : (r.config || {}),
    }));
    res.json(presets);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/order-item-presets  — create a new preset
router.post('/', protect, async (req, res, next) => {
  try {
    await ensureTable();
    const { name, icon = 'Scissors', config = {}, defaultPrice = 0, defaultMeter = '', description = '', sortOrder = 0 } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Preset name is required.' });
    }

    const id = uuidv4();
    const configJson = JSON.stringify(config || {});

    await db.execute(
      `INSERT INTO OrderItemPreset (id, name, icon, config, defaultPrice, defaultMeter, description, sortOrder, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, name.trim(), icon, configJson, Number(defaultPrice) || 0, String(defaultMeter || ''), String(description || ''), Number(sortOrder) || 0]
    );

    const [rows] = await db.query('SELECT * FROM OrderItemPreset WHERE id = ?', [id]);
    const created = {
      ...rows[0],
      config: typeof rows[0].config === 'string' ? JSON.parse(rows[0].config) : (rows[0].config || {}),
    };
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/order-item-presets/:id  — update an existing preset
router.put('/:id', protect, async (req, res, next) => {
  try {
    await ensureTable();
    const { name, icon = 'Scissors', config = {}, defaultPrice = 0, defaultMeter = '', description = '', sortOrder = 0 } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Preset name is required.' });
    }

    const [existing] = await db.query('SELECT * FROM OrderItemPreset WHERE id = ?', [req.params.id]);
    if (!existing.length) {
      return res.status(404).json({ message: 'Preset not found.' });
    }

    const configJson = JSON.stringify(config || {});

    await db.execute(
      `UPDATE OrderItemPreset
       SET name = ?, icon = ?, config = ?, defaultPrice = ?, defaultMeter = ?, description = ?, sortOrder = ?, updatedAt = NOW()
       WHERE id = ?`,
      [name.trim(), icon, configJson, Number(defaultPrice) || 0, String(defaultMeter || ''), String(description || ''), Number(sortOrder) || 0, req.params.id]
    );

    const [rows] = await db.query('SELECT * FROM OrderItemPreset WHERE id = ?', [req.params.id]);
    const updated = {
      ...rows[0],
      config: typeof rows[0].config === 'string' ? JSON.parse(rows[0].config) : (rows[0].config || {}),
    };
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/order-item-presets/:id  — delete a preset
router.delete('/:id', protect, async (req, res, next) => {
  try {
    await ensureTable();
    const [existing] = await db.query('SELECT * FROM OrderItemPreset WHERE id = ?', [req.params.id]);
    if (!existing.length) {
      return res.status(404).json({ message: 'Preset not found.' });
    }

    await db.execute('DELETE FROM OrderItemPreset WHERE id = ?', [req.params.id]);
    res.json({ message: 'Preset deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
