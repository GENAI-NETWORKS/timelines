const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { protect, adminOnly } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

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
      createdAt     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_billDate   (billDate),
      INDEX idx_paymentMode (paymentMode),
      INDEX idx_grandTotal  (grandTotal)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

ensureTable().catch(err => console.error('BillingRecord table init error:', err));

// GET /api/billing-records  — list with filters + pagination
router.get('/', protect, adminOnly, async (req, res, next) => {
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
router.post('/', protect, adminOnly, async (req, res, next) => {
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

// DELETE /api/billing-records/:id
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    await db.execute('DELETE FROM BillingRecord WHERE id = ?', [req.params.id]);
    res.json({ message: 'Record deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

