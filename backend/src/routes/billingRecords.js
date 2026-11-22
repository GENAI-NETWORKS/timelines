const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../utils/db');
const { protect, adminOnly, requirePermission } = require('../middleware/auth');
const { getStorage, cloudinary, isCloudinaryConfigured } = require('../utils/cloudinary');
const { v4: uuidv4 } = require('uuid');

const requireBillingAccess = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated.' });
  if (req.user.role === 'admin' || req.user.permissions?.billing || req.user.permissions?.paymentRecords) return next();
  return res.status(403).json({ message: 'Access denied. Requires billing or paymentRecords permission.' });
};

// Multer for photo uploads (Cloudinary or local disk fallback)
const storage = getStorage('timelines/billing-records');
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// Ensure BillingRecord table exists
async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS BillingRecord (
      id            VARCHAR(64)   PRIMARY KEY,
      billNo        VARCHAR(64)   NOT NULL,
      billDate      DATE          NOT NULL,
      customerName  VARCHAR(255)  NOT NULL DEFAULT 'Walk-in Customer',
      customerPhone VARCHAR(50)   DEFAULT '',
      paymentMode   VARCHAR(50)   NOT NULL DEFAULT 'Cash',
      items         JSON          NOT NULL,
      subtotal      DECIMAL(12,2) NOT NULL DEFAULT 0,
      discountAmount DECIMAL(12,2) NOT NULL DEFAULT 0,
      taxRate       DECIMAL(6,2)  NOT NULL DEFAULT 0,
      grandTotal    DECIMAL(12,2) NOT NULL DEFAULT 0,
      photoUrl      VARCHAR(1000) DEFAULT '',
      photoPublicId VARCHAR(500)  DEFAULT '',
      createdAt     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_billDate   (billDate),
      INDEX idx_paymentMode (paymentMode),
      INDEX idx_grandTotal  (grandTotal)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Add photo columns if upgrading from an older schema
  for (const col of [
    "ALTER TABLE BillingRecord ADD COLUMN photoUrl VARCHAR(1000) DEFAULT '' AFTER grandTotal",
    "ALTER TABLE BillingRecord ADD COLUMN photoPublicId VARCHAR(500) DEFAULT '' AFTER photoUrl",
  ]) {
    try { await db.query(col); } catch (_) { /* column already exists */ }
  }
}

ensureTable().catch(err => console.error('BillingRecord table init error:', err));

// Helper to resolve photo from multer file (memory storage → base64 data URL)
const resolvePhoto = (file) => {
  if (!file) return { photoUrl: '', photoPublicId: '' };
  if (file.buffer) {
    return {
      photoUrl: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
      photoPublicId: '',
    };
  }
  return { photoUrl: '', photoPublicId: '' };
};

// GET /api/billing-records  — list with filters + pagination
router.get('/', protect, requireBillingAccess, async (req, res, next) => {
  try {
    const {
      search = '',
      paymentMode = '',
      dateFrom = '',
      dateTo = '',
      page = 1,
      limit = 50,
    } = req.query;

    const conditions = [];
    const params = [];

    if (search) {
      conditions.push('(billNo LIKE ? OR customerName LIKE ? OR customerPhone LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (paymentMode) {
      conditions.push('LOWER(paymentMode) = LOWER(?)');
      params.push(paymentMode.trim());
    }
    if (dateFrom) {
      conditions.push('billDate >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push('billDate <= ?');
      params.push(dateTo);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const take  = parseInt(limit);

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM BillingRecord ${where}`,
      params
    );

    const [records] = await db.query(
      `SELECT * FROM BillingRecord ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      [...params, take, skip]
    );

    // Parse JSON items field + format timestamps as IST (Asia/Kolkata)
    const fmtIST = (dt) => {
      if (!dt) return null;
      const d = dt instanceof Date ? dt : new Date(dt);
      // Format: "YYYY-MM-DDTHH:mm:ss+05:30" so the browser treats it as IST
      return d.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace(' ', 'T') + '+05:30';
    };
    const parsed = records.map(r => ({
      ...r,
      items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items,
      createdAt: fmtIST(r.createdAt),
      updatedAt: fmtIST(r.updatedAt),
    }));

    // Aggregate stats for the filtered set
    const [[stats]] = await db.query(
      `SELECT
         COALESCE(SUM(grandTotal), 0)      AS totalRevenue,
         COUNT(*)                           AS totalBills,
         COALESCE(SUM(discountAmount), 0)  AS totalDiscount
       FROM BillingRecord ${where}`,
      params
    );

    res.json({ records: parsed, total, page: parseInt(page), limit: take, stats });
  } catch (err) {
    next(err);
  }
});

// POST /api/billing-records  — save a bill (called automatically on print)
router.post('/', protect, requireBillingAccess, async (req, res, next) => {
  try {
    const {
      billNo, billDate, customerName = 'Walk-in Customer', customerPhone = '',
      paymentMode = 'Cash', items = [], subtotal = 0,
      discountAmount = 0, taxRate = 0, grandTotal = 0,
    } = req.body;

    if (!billNo) return res.status(400).json({ message: 'billNo is required.' });

    // Upsert — if same billNo already exists, update it
    const [existing] = await db.query('SELECT id FROM BillingRecord WHERE billNo = ?', [billNo]);

    const id = existing.length > 0 ? existing[0].id : uuidv4();
    const dateStr = billDate ? billDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const itemsJson = JSON.stringify(items);

    if (existing.length > 0) {
      await db.execute(
        `UPDATE BillingRecord SET billDate=?, customerName=?, customerPhone=?, paymentMode=?,
         items=?, subtotal=?, discountAmount=?, taxRate=?, grandTotal=?, updatedAt=NOW()
         WHERE id=?`,
        [dateStr, customerName, customerPhone, paymentMode,
         itemsJson, subtotal, discountAmount, taxRate, grandTotal, id]
      );
    } else {
      await db.execute(
        `INSERT INTO BillingRecord
         (id, billNo, billDate, customerName, customerPhone, paymentMode,
          items, subtotal, discountAmount, taxRate, grandTotal, createdAt, updatedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
        [id, billNo, dateStr, customerName, customerPhone, paymentMode,
         itemsJson, subtotal, discountAmount, taxRate, grandTotal]
      );
    }

    const [rows] = await db.query('SELECT * FROM BillingRecord WHERE id=?', [id]);
    const record = { ...rows[0], items: typeof rows[0].items === 'string' ? JSON.parse(rows[0].items) : rows[0].items };
    res.status(existing.length > 0 ? 200 : 201).json(record);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/billing-records/:id  — update payment method only
router.patch('/:id', protect, requireBillingAccess, async (req, res, next) => {
  try {
    const { paymentMode } = req.body;
    const allowed = ['Cash', 'UPI', 'Scanner', 'phone number'];
    if (!paymentMode || !allowed.map(a => a.toLowerCase()).includes(paymentMode.toLowerCase())) {
      return res.status(400).json({ message: 'Invalid paymentMode.' });
    }
    // Match original casing
    const normalised = allowed.find(a => a.toLowerCase() === paymentMode.toLowerCase());
    await db.execute(
      'UPDATE BillingRecord SET paymentMode=?, updatedAt=NOW() WHERE id=?',
      [normalised, req.params.id]
    );
    res.json({ success: true, paymentMode: normalised });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/billing-records/:id/photo  — upload / replace reference photo
router.patch('/:id/photo', protect, requireBillingAccess, upload.single('photo'), async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM BillingRecord WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Record not found.' });

    const existing = rows[0];

    // Remove old photo if present
    if (existing.photoPublicId) {
      if (isCloudinaryConfigured) {
        try { await cloudinary.uploader.destroy(existing.photoPublicId); } catch {}
      } else {
        try {
          const oldPath = path.join(__dirname, '../../uploads/timelines_billing-records', existing.photoPublicId);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        } catch {}
      }
    }

    const { photoUrl, photoPublicId } = resolvePhoto(req.file);

    await db.execute(
      'UPDATE BillingRecord SET photoUrl=?, photoPublicId=?, updatedAt=NOW() WHERE id=?',
      [photoUrl, photoPublicId, req.params.id]
    );

    res.json({ success: true, photoUrl, photoPublicId });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/billing-records/:id
router.delete('/:id', protect, requireBillingAccess, async (req, res, next) => {
  try {
    await db.execute('DELETE FROM BillingRecord WHERE id = ?', [req.params.id]);
    res.json({ message: 'Record deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

