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
  if (
    req.user.role === 'admin' ||
    req.user.permissions?.billing ||
    req.user.permissions?.paymentRecords ||
    req.user.permissions?.billHistory
  ) return next();
  return res.status(403).json({ message: 'Access denied. Requires billing, paymentRecords, or billHistory permission.' });
};

// Multer for photo uploads (memory storage fallback)
const storage = getStorage('timelines/billing-records');
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// Helper to log bill lifecycle changes
async function logBillHistory({
  billNo, billingRecordId = '', action, performedBy, performedById = '',
  customerName = '', grandTotal = 0, advanceAmount = 0, balanceAmount = 0,
  summary = '', previousData = null, newData = null
}) {
  try {
    const id = uuidv4();
    await db.execute(
      `INSERT INTO BillHistory
       (id, billNo, billingRecordId, action, performedBy, performedById, customerName,
        grandTotal, advanceAmount, balanceAmount, summary, previousData, newData, createdAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
      [
        id,
        billNo || '',
        billingRecordId || '',
        action,
        performedBy || 'Admin',
        performedById || '',
        customerName || '',
        grandTotal || 0,
        advanceAmount || 0,
        balanceAmount || 0,
        summary || '',
        previousData ? (typeof previousData === 'string' ? previousData : JSON.stringify(previousData)) : null,
        newData ? (typeof newData === 'string' ? newData : JSON.stringify(newData)) : null,
      ]
    );
  } catch (err) {
    console.error('Failed to log bill history:', err);
  }
}

// Ensure BillingRecord and BillHistory tables exist
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
      advanceAmount DECIMAL(12,2) NOT NULL DEFAULT 0,
      advanceProofUrl LONGTEXT,
      balanceAmount DECIMAL(12,2) NOT NULL DEFAULT 0,
      cashier       VARCHAR(255)  DEFAULT '',
      createdBy     VARCHAR(255)  DEFAULT '',
      lastEditedBy  VARCHAR(255)  DEFAULT '',
      editCount     INT           DEFAULT 0,
      photoUrl      LONGTEXT,
      photoPublicId VARCHAR(500)  DEFAULT '',
      createdAt     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_billDate   (billDate),
      INDEX idx_paymentMode (paymentMode),
      INDEX idx_grandTotal  (grandTotal)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS BillHistory (
      id VARCHAR(64) PRIMARY KEY,
      billNo VARCHAR(64) NOT NULL,
      billingRecordId VARCHAR(64) DEFAULT '',
      action VARCHAR(50) NOT NULL,
      performedBy VARCHAR(255) NOT NULL,
      performedById VARCHAR(64) DEFAULT '',
      customerName VARCHAR(255) DEFAULT '',
      grandTotal DECIMAL(12,2) DEFAULT 0,
      advanceAmount DECIMAL(12,2) DEFAULT 0,
      balanceAmount DECIMAL(12,2) DEFAULT 0,
      summary TEXT,
      previousData LONGTEXT,
      newData LONGTEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_billNo (billNo),
      INDEX idx_action (action),
      INDEX idx_createdAt (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Add columns if upgrading
  const recordAlters = [
    "ALTER TABLE BillingRecord ADD COLUMN advanceAmount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER grandTotal",
    "ALTER TABLE BillingRecord ADD COLUMN advanceProofUrl LONGTEXT AFTER advanceAmount",
    "ALTER TABLE BillingRecord ADD COLUMN balanceAmount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER advanceProofUrl",
    "ALTER TABLE BillingRecord ADD COLUMN cashier VARCHAR(255) DEFAULT '' AFTER balanceAmount",
    "ALTER TABLE BillingRecord ADD COLUMN createdBy VARCHAR(255) DEFAULT '' AFTER cashier",
    "ALTER TABLE BillingRecord ADD COLUMN lastEditedBy VARCHAR(255) DEFAULT '' AFTER createdBy",
    "ALTER TABLE BillingRecord ADD COLUMN editCount INT DEFAULT 0 AFTER lastEditedBy",
    "ALTER TABLE BillingRecord MODIFY COLUMN photoUrl LONGTEXT",
  ];
  for (const col of recordAlters) {
    try { await db.query(col); } catch (_) {}
  }
}

ensureTable().catch(err => console.error('BillingRecord table init error:', err));

// Format timestamps as IST (Asia/Kolkata)
const fmtIST = (dt) => {
  if (!dt) return null;
  const d = dt instanceof Date ? dt : new Date(dt);
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace(' ', 'T') + '+05:30';
};

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

// ── GET /api/billing-records/history  — Bill creation & edit history audit log
router.get('/history', protect, requireBillingAccess, async (req, res, next) => {
  try {
    const {
      search = '',
      action = '',
      dateFrom = '',
      dateTo = '',
      page = 1,
      limit = 30,
    } = req.query;

    const conditions = [];
    const params = [];

    if (search) {
      conditions.push('(billNo LIKE ? OR customerName LIKE ? OR performedBy LIKE ? OR summary LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (action) {
      conditions.push('action = ?');
      params.push(action);
    }
    if (dateFrom) {
      conditions.push('createdAt >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push('createdAt <= ?');
      params.push(dateTo + ' 23:59:59');
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const take  = parseInt(limit);

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM BillHistory ${where}`,
      params
    );

    const [rows] = await db.query(
      `SELECT * FROM BillHistory ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      [...params, take, skip]
    );

    const [[stats]] = await db.query(`
      SELECT
        COUNT(*) AS totalLogs,
        SUM(CASE WHEN action = 'CREATED' THEN 1 ELSE 0 END) AS totalCreated,
        SUM(CASE WHEN action = 'EDITED'  THEN 1 ELSE 0 END) AS totalEdited,
        SUM(CASE WHEN action = 'DELETED' THEN 1 ELSE 0 END) AS totalDeleted
      FROM BillHistory ${where}
    `, params);

    const logs = rows.map(r => ({
      ...r,
      previousData: typeof r.previousData === 'string' ? JSON.parse(r.previousData) : r.previousData,
      newData: typeof r.newData === 'string' ? JSON.parse(r.newData) : r.newData,
      createdAt: fmtIST(r.createdAt),
    }));

    res.json({ logs, total, page: parseInt(page), limit: take, stats });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/billing-records/by-no/:billNo  — lookup single bill by bill number
router.get('/by-no/:billNo', async (req, res, next) => {
  try {
    const cleanNo = decodeURIComponent(req.params.billNo || '').trim();
    const [rows] = await db.query('SELECT * FROM BillingRecord WHERE billNo = ?', [cleanNo]);
    if (!rows.length) return res.status(404).json({ message: 'Bill not found' });
    const r = rows[0];
    res.json({
      ...r,
      items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items,
      createdAt: fmtIST(r.createdAt),
      updatedAt: fmtIST(r.updatedAt),
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/billing-records/:id  — get single bill record
router.get('/:id', protect, requireBillingAccess, async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM BillingRecord WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Record not found' });
    const r = rows[0];
    res.json({
      ...r,
      items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items,
      createdAt: fmtIST(r.createdAt),
      updatedAt: fmtIST(r.updatedAt),
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/billing-records  — list with filters + pagination
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

    const parsed = records.map(r => ({
      ...r,
      items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items,
      createdAt: fmtIST(r.createdAt),
      updatedAt: fmtIST(r.updatedAt),
    }));

    const [[stats]] = await db.query(
      `SELECT
         COALESCE(SUM(grandTotal), 0)      AS totalRevenue,
         COALESCE(SUM(advanceAmount), 0)   AS totalAdvance,
         COALESCE(SUM(balanceAmount), 0)   AS totalBalance,
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

// ── POST /api/billing-records  — create a bill
router.post('/', protect, requireBillingAccess, async (req, res, next) => {
  try {
    const {
      billNo, billDate, customerName = 'Walk-in Customer', customerPhone = '',
      paymentMode = 'Cash', items = [], subtotal = 0,
      discountAmount = 0, taxRate = 0, grandTotal = 0,
      advanceAmount = 0, advanceProofUrl = '', balanceAmount = 0,
      cashier = '', createdBy = '', lastEditedBy = '',
    } = req.body;

    if (!billNo) return res.status(400).json({ message: 'billNo is required.' });

    // Check if bill already exists
    const [existing] = await db.query('SELECT * FROM BillingRecord WHERE billNo = ?', [billNo]);

    const id = existing.length > 0 ? existing[0].id : uuidv4();
    const dateStr = billDate ? billDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const itemsJson = JSON.stringify(items);
    const actorId = req.user?.id || '';

    // Calculate balanceAmount if not provided
    const parsedGrandTotal = Number(grandTotal) || 0;
    const parsedAdvance = Number(advanceAmount) || 0;
    const finalBalance = balanceAmount !== undefined ? Number(balanceAmount) : Math.max(0, parsedGrandTotal - parsedAdvance);

    if (existing.length > 0) {
      // Existing bill being updated via POST upsert
      const prev = existing[0];
      const actorName = (lastEditedBy || cashier || '').trim();
      if (!actorName) {
        return res.status(400).json({ message: 'Selecting who is editing this bill is mandatory.' });
      }

      const newEditCount = (prev.editCount || 0) + 1;

      await db.execute(
        `UPDATE BillingRecord SET
           billDate=?, customerName=?, customerPhone=?, paymentMode=?,
           items=?, subtotal=?, discountAmount=?, taxRate=?, grandTotal=?,
           advanceAmount=?, advanceProofUrl=?, balanceAmount=?, cashier=?,
           lastEditedBy=?, editCount=?, updatedAt=NOW()
         WHERE id=?`,
        [
          dateStr, customerName, customerPhone, paymentMode,
          itemsJson, subtotal, discountAmount, taxRate, parsedGrandTotal,
          parsedAdvance, advanceProofUrl || prev.advanceProofUrl || '', finalBalance,
          actorName,
          actorName, newEditCount, id
        ]
      );

      // Log to history
      await logBillHistory({
        billNo,
        billingRecordId: id,
        action: 'EDITED',
        performedBy: actorName,
        performedById: actorId,
        customerName,
        grandTotal: parsedGrandTotal,
        advanceAmount: parsedAdvance,
        balanceAmount: finalBalance,
        summary: `Bill updated by ${actorName}. Items: ${items.length}, Total: ₹${parsedGrandTotal}, Advance: ₹${parsedAdvance}, Balance: ₹${finalBalance}`,
        previousData: {
          items: typeof prev.items === 'string' ? JSON.parse(prev.items) : prev.items,
          grandTotal: prev.grandTotal,
          advanceAmount: prev.advanceAmount,
          balanceAmount: prev.balanceAmount,
          customerName: prev.customerName,
        },
        newData: { items, grandTotal: parsedGrandTotal, advanceAmount: parsedAdvance, balanceAmount: finalBalance, customerName }
      });
    } else {
      // New Bill creation
      const actorName = (createdBy || cashier || '').trim();
      if (!actorName) {
        return res.status(400).json({ message: 'Selecting who created this bill is mandatory.' });
      }

      await db.execute(
        `INSERT INTO BillingRecord
         (id, billNo, billDate, customerName, customerPhone, paymentMode,
          items, subtotal, discountAmount, taxRate, grandTotal,
          advanceAmount, advanceProofUrl, balanceAmount, cashier,
          createdBy, lastEditedBy, editCount, createdAt, updatedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,NOW(),NOW())`,
        [
          id, billNo, dateStr, customerName, customerPhone, paymentMode,
          itemsJson, subtotal, discountAmount, taxRate, parsedGrandTotal,
          parsedAdvance, advanceProofUrl || '', finalBalance,
          actorName, actorName, actorName
        ]
      );

      // Log to history
      await logBillHistory({
        billNo,
        billingRecordId: id,
        action: 'CREATED',
        performedBy: actorName,
        performedById: actorId,
        customerName,
        grandTotal: parsedGrandTotal,
        advanceAmount: parsedAdvance,
        balanceAmount: finalBalance,
        summary: `Bill created by ${actorName} with ${items.length} items. Total: ₹${parsedGrandTotal}${parsedAdvance > 0 ? `, Advance: ₹${parsedAdvance}, Balance: ₹${finalBalance}` : ''}`,
        previousData: null,
        newData: { items, grandTotal: parsedGrandTotal, advanceAmount: parsedAdvance, balanceAmount: finalBalance, customerName }
      });
    }

    const [rows] = await db.query('SELECT * FROM BillingRecord WHERE id=?', [id]);
    const record = {
      ...rows[0],
      items: typeof rows[0].items === 'string' ? JSON.parse(rows[0].items) : rows[0].items,
      createdAt: fmtIST(rows[0].createdAt),
      updatedAt: fmtIST(rows[0].updatedAt),
    };
    res.status(existing.length > 0 ? 200 : 201).json(record);
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/billing-records/:id  — full bill edit
router.put('/:id', protect, requireBillingAccess, async (req, res, next) => {
  try {
    const [existing] = await db.query('SELECT * FROM BillingRecord WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ message: 'Bill record not found.' });

    const prev = existing[0];
    const {
      billNo = prev.billNo,
      billDate = prev.billDate,
      customerName = prev.customerName,
      customerPhone = prev.customerPhone,
      paymentMode = prev.paymentMode,
      items = [],
      subtotal = prev.subtotal,
      discountAmount = prev.discountAmount,
      taxRate = prev.taxRate,
      grandTotal = prev.grandTotal,
      advanceAmount = prev.advanceAmount,
      advanceProofUrl,
      balanceAmount,
      cashier = prev.cashier,
    } = req.body;

    const dateStr = billDate ? String(billDate).slice(0, 10) : new Date().toISOString().slice(0, 10);
    const itemsJson = JSON.stringify(items);
    const actorName = (req.body.lastEditedBy || req.body.cashier || '').trim();
    if (!actorName) {
      return res.status(400).json({ message: 'Selecting who is editing this bill is mandatory.' });
    }
    const actorId = req.user?.id || '';

    const parsedGrandTotal = Number(grandTotal) || 0;
    const parsedAdvance = Number(advanceAmount) || 0;
    const finalBalance = balanceAmount !== undefined ? Number(balanceAmount) : Math.max(0, parsedGrandTotal - parsedAdvance);
    const finalProofUrl = advanceProofUrl !== undefined ? advanceProofUrl : prev.advanceProofUrl;
    const newEditCount = (prev.editCount || 0) + 1;

    await db.execute(
      `UPDATE BillingRecord SET
         billNo=?, billDate=?, customerName=?, customerPhone=?, paymentMode=?,
         items=?, subtotal=?, discountAmount=?, taxRate=?, grandTotal=?,
         advanceAmount=?, advanceProofUrl=?, balanceAmount=?, cashier=?,
         lastEditedBy=?, editCount=?, updatedAt=NOW()
       WHERE id=?`,
      [
        billNo, dateStr, customerName, customerPhone, paymentMode,
        itemsJson, subtotal, discountAmount, taxRate, parsedGrandTotal,
        parsedAdvance, finalProofUrl, finalBalance, actorName,
        actorName, newEditCount, req.params.id
      ]
    );

    // Build human-friendly summary of edits
    const changes = [];
    if (prev.grandTotal !== parsedGrandTotal) changes.push(`Total: ₹${prev.grandTotal} → ₹${parsedGrandTotal}`);
    if (prev.advanceAmount !== parsedAdvance) changes.push(`Advance: ₹${prev.advanceAmount} → ₹${parsedAdvance}`);
    if (prev.customerName !== customerName) changes.push(`Customer: "${prev.customerName}" → "${customerName}"`);
    if (prev.paymentMode !== paymentMode) changes.push(`Payment: ${prev.paymentMode} → ${paymentMode}`);
    const summary = changes.length
      ? `Bill edited by ${actorName}: ${changes.join(', ')}`
      : `Bill details edited by ${actorName} (${items.length} items)`;

    await logBillHistory({
      billNo,
      billingRecordId: req.params.id,
      action: 'EDITED',
      performedBy: actorName,
      performedById: actorId,
      customerName,
      grandTotal: parsedGrandTotal,
      advanceAmount: parsedAdvance,
      balanceAmount: finalBalance,
      summary,
      previousData: {
        items: typeof prev.items === 'string' ? JSON.parse(prev.items) : prev.items,
        grandTotal: prev.grandTotal,
        advanceAmount: prev.advanceAmount,
        balanceAmount: prev.balanceAmount,
        customerName: prev.customerName,
        customerPhone: prev.customerPhone,
        paymentMode: prev.paymentMode,
      },
      newData: { items, grandTotal: parsedGrandTotal, advanceAmount: parsedAdvance, balanceAmount: finalBalance, customerName, customerPhone, paymentMode }
    });

    const [rows] = await db.query('SELECT * FROM BillingRecord WHERE id = ?', [req.params.id]);
    const updated = {
      ...rows[0],
      items: typeof rows[0].items === 'string' ? JSON.parse(rows[0].items) : rows[0].items,
      createdAt: fmtIST(rows[0].createdAt),
      updatedAt: fmtIST(rows[0].updatedAt),
    };
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/billing-records/:id  — update payment method only
router.patch('/:id', protect, requireBillingAccess, async (req, res, next) => {
  try {
    const { paymentMode } = req.body;
    const allowed = ['Cash', 'UPI', 'Scanner', 'phone number'];
    if (!paymentMode || !allowed.map(a => a.toLowerCase()).includes(paymentMode.toLowerCase())) {
      return res.status(400).json({ message: 'Invalid paymentMode.' });
    }
    const normalised = allowed.find(a => a.toLowerCase() === paymentMode.toLowerCase());
    await db.execute(
      'UPDATE BillingRecord SET paymentMode=?, updatedAt=NOW() WHERE id=?',
      [normalised, req.params.id]
    );

    const actorName = req.user?.name || 'Admin';
    const [rows] = await db.query('SELECT * FROM BillingRecord WHERE id=?', [req.params.id]);
    if (rows.length) {
      await logBillHistory({
        billNo: rows[0].billNo,
        billingRecordId: req.params.id,
        action: 'EDITED',
        performedBy: actorName,
        performedById: req.user?.id || '',
        customerName: rows[0].customerName,
        grandTotal: rows[0].grandTotal,
        advanceAmount: rows[0].advanceAmount,
        balanceAmount: rows[0].balanceAmount,
        summary: `Payment method changed to ${normalised} by ${actorName}`,
      });
    }

    res.json({ success: true, paymentMode: normalised });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/billing-records/:id/photo  — upload / replace reference photo
router.patch('/:id/photo', protect, requireBillingAccess, upload.single('photo'), async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM BillingRecord WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Record not found.' });

    const existing = rows[0];
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

// ── DELETE /api/billing-records/:id
router.delete('/:id', protect, requireBillingAccess, async (req, res, next) => {
  try {
    const actorName = (req.body?.deletedBy || req.query?.deletedBy || '').trim();
    if (!actorName) {
      return res.status(400).json({ message: 'Selecting who is deleting this bill is mandatory.' });
    }

    const [existing] = await db.query('SELECT * FROM BillingRecord WHERE id = ?', [req.params.id]);
    if (existing.length) {
      const rec = existing[0];
      await logBillHistory({
        billNo: rec.billNo,
        billingRecordId: rec.id,
        action: 'DELETED',
        performedBy: actorName,
        performedById: req.user?.id || '',
        customerName: rec.customerName,
        grandTotal: rec.grandTotal,
        advanceAmount: rec.advanceAmount,
        balanceAmount: rec.balanceAmount,
        summary: `Bill ${rec.billNo} deleted by ${actorName} (Total: ₹${rec.grandTotal})`,
        previousData: rec,
      });
    }

    await db.execute('DELETE FROM BillingRecord WHERE id = ?', [req.params.id]);
    res.json({ message: 'Record deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
