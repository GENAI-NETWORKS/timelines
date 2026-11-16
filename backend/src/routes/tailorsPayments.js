const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const db      = require('../utils/db');
const { protect, adminOnly } = require('../middleware/auth');
const { getStorage, cloudinary } = require('../utils/cloudinary');
const { v4: uuidv4 } = require('uuid');

// ── Multer / Cloudinary ───────────────────────────────────────────────────────
const storage = getStorage('timelines/tailors-payments');
const upload  = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// ── Ensure table ──────────────────────────────────────────────────────────────
async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS TailorsPayment (
      id            VARCHAR(64)    PRIMARY KEY,
      name          VARCHAR(255)   NOT NULL,
      amount        DECIMAL(12,2)  NOT NULL DEFAULT 0,
      customerId    VARCHAR(100)   NOT NULL UNIQUE,
      productName   VARCHAR(255)   DEFAULT '',
      photoUrl      VARCHAR(1000)  DEFAULT '',
      photoPublicId VARCHAR(500)   DEFAULT '',
      notes         TEXT           DEFAULT '',
      createdAt     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_customerId (customerId),
      INDEX idx_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}
ensureTable().catch(err => console.error('TailorsPayment table init error:', err));

const fmtIST = (dt) => {
  if (!dt) return null;
  const d = dt instanceof Date ? dt : new Date(dt);
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace(' ', 'T') + '+05:30';
};

const mapRow = (r) => ({
  ...r,
  createdAt: fmtIST(r.createdAt),
  updatedAt: fmtIST(r.updatedAt),
});

// ── GET /api/tailors-payments ─────────────────────────────────────────────────
router.get('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { search = '' } = req.query;
    const params = [];
    let where = '';
    if (search) {
      where = 'WHERE (name LIKE ? OR customerId LIKE ? OR productName LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    const [rows] = await db.query(
      `SELECT * FROM TailorsPayment ${where} ORDER BY createdAt DESC`,
      params
    );
    res.json({ payments: rows.map(mapRow), total: rows.length });
  } catch (err) { next(err); }
});

// ── GET /api/tailors-payments/:id ─────────────────────────────────────────────
router.get('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM TailorsPayment WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Not found.' });
    res.json(mapRow(rows[0]));
  } catch (err) { next(err); }
});

// ── POST /api/tailors-payments  — create (with optional photo) ────────────────
router.post('/', protect, adminOnly, upload.single('photo'), async (req, res, next) => {
  try {
    const { name, amount = 0, customerId, productName = '', notes = '' } = req.body;
    if (!name?.trim())       return res.status(400).json({ message: 'Name is required.' });
    if (!customerId?.trim()) return res.status(400).json({ message: 'Customer ID is required.' });

    // Check unique customerId
    const [dup] = await db.query('SELECT id FROM TailorsPayment WHERE customerId = ?', [customerId.trim()]);
    if (dup.length) return res.status(409).json({ message: `Customer ID "${customerId}" already exists. Use a unique ID.` });

    const id = uuidv4();
    const photoUrl      = req.file?.path || '';
    const photoPublicId = req.file?.filename || '';

    await db.execute(
      `INSERT INTO TailorsPayment (id, name, amount, customerId, productName, photoUrl, photoPublicId, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, name.trim(), amount, customerId.trim(), productName.trim(), photoUrl, photoPublicId, notes]
    );
    const [rows] = await db.query('SELECT * FROM TailorsPayment WHERE id = ?', [id]);
    res.status(201).json(mapRow(rows[0]));
  } catch (err) { next(err); }
});

// ── PUT /api/tailors-payments/:id  — update (with optional new photo) ─────────
router.put('/:id', protect, adminOnly, upload.single('photo'), async (req, res, next) => {
  try {
    const { name, amount, customerId, productName = '', notes = '' } = req.body;
    if (!name?.trim())       return res.status(400).json({ message: 'Name is required.' });
    if (!customerId?.trim()) return res.status(400).json({ message: 'Customer ID is required.' });

    const [existing] = await db.query('SELECT * FROM TailorsPayment WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: 'Not found.' });

    // Check unique customerId (allow same record)
    const [dup] = await db.query('SELECT id FROM TailorsPayment WHERE customerId = ? AND id != ?', [customerId.trim(), req.params.id]);
    if (dup.length) return res.status(409).json({ message: `Customer ID "${customerId}" is already used by another record.` });

    let photoUrl      = existing[0].photoUrl;
    let photoPublicId = existing[0].photoPublicId;

    // If new photo uploaded, delete old from Cloudinary and use new
    if (req.file) {
      if (photoPublicId) {
        try { await cloudinary.uploader.destroy(photoPublicId); } catch {}
      }
      photoUrl      = req.file.path;
      photoPublicId = req.file.filename;
    }

    await db.execute(
      `UPDATE TailorsPayment SET name=?, amount=?, customerId=?, productName=?, photoUrl=?, photoPublicId=?, notes=?, updatedAt=NOW()
       WHERE id=?`,
      [name.trim(), amount, customerId.trim(), productName.trim(), photoUrl, photoPublicId, notes, req.params.id]
    );
    const [rows] = await db.query('SELECT * FROM TailorsPayment WHERE id = ?', [req.params.id]);
    res.json(mapRow(rows[0]));
  } catch (err) { next(err); }
});

// ── DELETE /api/tailors-payments/:id ─────────────────────────────────────────
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM TailorsPayment WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Not found.' });
    // Delete photo from Cloudinary
    if (rows[0].photoPublicId) {
      try { await cloudinary.uploader.destroy(rows[0].photoPublicId); } catch {}
    }
    await db.execute('DELETE FROM TailorsPayment WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;

