const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { protect, adminOnly } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// ── Ensure all 3 tables exist ─────────────────────────────────────────────────
async function ensureTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS TailorStaff (
      id            VARCHAR(64)   PRIMARY KEY,
      employeeId    VARCHAR(50)   NOT NULL UNIQUE,
      name          VARCHAR(255)  NOT NULL,
      role          VARCHAR(100)  DEFAULT 'Tailoring',
      payType       VARCHAR(20)   DEFAULT 'Piece',
      ratePerPiece  DECIMAL(10,2) DEFAULT 0,
      createdAt     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS TailorWorkEntry (
      id         VARCHAR(64)   PRIMARY KEY,
      staffId    VARCHAR(64)   NOT NULL,
      entryDate  DATE          NOT NULL,
      customer   VARCHAR(255)  DEFAULT '',
      orderNo    VARCHAR(100)  DEFAULT '',
      item       VARCHAR(255)  DEFAULT '',
      subitem    VARCHAR(255)  DEFAULT '',
      quantity   INT           DEFAULT 1,
      rate       DECIMAL(10,2) DEFAULT 0,
      amount     DECIMAL(10,2) DEFAULT 0,
      createdAt  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_staffId   (staffId),
      INDEX idx_entryDate (entryDate)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS TailorPaymentHistory (
      id          VARCHAR(64)   PRIMARY KEY,
      staffId     VARCHAR(64)   NOT NULL,
      monthYear   VARCHAR(7)    NOT NULL,
      totalAmount DECIMAL(12,2) DEFAULT 0,
      notes       TEXT,
      savedAt     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_staffId   (staffId),
      INDEX idx_monthYear (monthYear)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}
ensureTables().catch(err => console.error('TailorStaff tables init error:', err));

// ── Auto-generate numeric Employee ID ────────────────────────────────────────
async function nextStaffId() {
  const [[row]] = await db.query(
    `SELECT MAX(CAST(NULLIF(REGEXP_REPLACE(employeeId, '[^0-9]', ''), '') AS UNSIGNED)) AS mx FROM TailorStaff`
  );
  return String((row.mx || 0) + 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAFF CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/tailor-staff
router.get('/', protect, adminOnly, async (req, res, next) => {
  try {
    await ensureTables().catch(() => {});
    const { search = '' } = req.query;
    let where = '';
    const params = [];
    if (search) {
      where = 'WHERE (name LIKE ? OR employeeId LIKE ? OR role LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    const [staff] = await db.query(
      `SELECT * FROM TailorStaff ${where} ORDER BY CAST(NULLIF(REGEXP_REPLACE(employeeId,'[^0-9]',''),'') AS UNSIGNED) ASC, createdAt ASC`,
      params
    );
    res.json({ staff, total: staff.length });
  } catch (err) { next(err); }
});

// GET /api/tailor-staff/:id
router.get('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    await ensureTables().catch(() => {});
    const [rows] = await db.query(`SELECT * FROM TailorStaff WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Staff not found.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/tailor-staff
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    await ensureTables().catch(() => {});
    const { employeeId: customId, name, role = 'Tailoring', payType = 'Piece', ratePerPiece = 0 } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required.' });

    let employeeId = customId?.trim();
    if (employeeId) {
      const [dup] = await db.query('SELECT id FROM TailorStaff WHERE employeeId = ?', [employeeId]);
      if (dup.length) return res.status(409).json({ message: `Employee ID "${employeeId}" already exists.` });
    } else {
      employeeId = await nextStaffId();
    }

    const id = uuidv4();
    await db.execute(
      `INSERT INTO TailorStaff (id, employeeId, name, role, payType, ratePerPiece, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,NOW(),NOW())`,
      [id, employeeId, name.trim(), role.trim(), payType, parseFloat(ratePerPiece) || 0]
    );
    const [rows] = await db.query('SELECT * FROM TailorStaff WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/tailor-staff/:id
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM TailorStaff WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Staff not found.' });

    const { name, role = 'Tailoring', payType = 'Piece', ratePerPiece = 0 } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required.' });

    await db.execute(
      `UPDATE TailorStaff SET name=?, role=?, payType=?, ratePerPiece=?, updatedAt=NOW() WHERE id=?`,
      [name.trim(), role.trim(), payType, parseFloat(ratePerPiece) || 0, req.params.id]
    );
    const [updated] = await db.query('SELECT * FROM TailorStaff WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) { next(err); }
});

// DELETE /api/tailor-staff/:id  (cascade deletes entries + history)
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT id FROM TailorStaff WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Staff not found.' });
    await db.execute('DELETE FROM TailorWorkEntry       WHERE staffId = ?', [req.params.id]);
    await db.execute('DELETE FROM TailorPaymentHistory WHERE staffId = ?', [req.params.id]);
    await db.execute('DELETE FROM TailorStaff           WHERE id      = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// WORK ENTRIES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/tailor-staff/:id/entries?month=YYYY-MM
router.get('/:id/entries', protect, adminOnly, async (req, res, next) => {
  try {
    await ensureTables().catch(() => {});
    const { month } = req.query;
    let where = 'WHERE staffId = ?';
    const params = [req.params.id];
    if (month) {
      where += ' AND DATE_FORMAT(entryDate, "%Y-%m") = ?';
      params.push(month);
    }
    const [entries] = await db.query(
      `SELECT * FROM TailorWorkEntry ${where} ORDER BY entryDate ASC, createdAt ASC`,
      params
    );
    const [[{ totalEarned }]] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS totalEarned FROM TailorWorkEntry ${where}`,
      params
    );
    res.json({ entries, totalEarned: parseFloat(totalEarned) });
  } catch (err) { next(err); }
});

// POST /api/tailor-staff/:id/entries
router.post('/:id/entries', protect, adminOnly, async (req, res, next) => {
  try {
    await ensureTables().catch(() => {});
    const [staff] = await db.query('SELECT id FROM TailorStaff WHERE id = ?', [req.params.id]);
    if (!staff.length) return res.status(404).json({ message: 'Staff not found.' });

    const { entryDate, customer = '', orderNo = '', item = '', subitem = '', quantity = 1, rate = 0, amount } = req.body;
    if (!entryDate) return res.status(400).json({ message: 'Entry date is required.' });

    const qty = parseInt(quantity) || 1;
    const rt  = parseFloat(rate) || 0;
    const amt = amount !== undefined ? parseFloat(amount) : (qty * rt);
    const id = uuidv4();

    await db.execute(
      `INSERT INTO TailorWorkEntry (id, staffId, entryDate, customer, orderNo, item, subitem, quantity, rate, amount, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
      [id, req.params.id, entryDate, customer.trim(), orderNo.trim(), item.trim(), subitem.trim(), qty, rt, amt]
    );
    const [rows] = await db.query('SELECT * FROM TailorWorkEntry WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/tailor-staff/:id/entries/:entryId
router.put('/:id/entries/:entryId', protect, adminOnly, async (req, res, next) => {
  try {
    const { entryDate, customer = '', orderNo = '', item = '', subitem = '', quantity = 1, rate = 0, amount } = req.body;
    const qty = parseInt(quantity) || 1;
    const rt  = parseFloat(rate) || 0;
    const amt = amount !== undefined ? parseFloat(amount) : (qty * rt);

    await db.execute(
      `UPDATE TailorWorkEntry SET entryDate=?, customer=?, orderNo=?, item=?, subitem=?, quantity=?, rate=?, amount=?, updatedAt=NOW()
       WHERE id=? AND staffId=?`,
      [entryDate, customer.trim(), orderNo.trim(), item.trim(), subitem.trim(), qty, rt, amt, req.params.entryId, req.params.id]
    );
    const [rows] = await db.query('SELECT * FROM TailorWorkEntry WHERE id = ?', [req.params.entryId]);
    if (!rows.length) return res.status(404).json({ message: 'Entry not found.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/tailor-staff/:id/entries/:entryId
router.delete('/:id/entries/:entryId', protect, adminOnly, async (req, res, next) => {
  try {
    await db.execute('DELETE FROM TailorWorkEntry WHERE id = ? AND staffId = ?', [req.params.entryId, req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT HISTORY
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/tailor-staff/:id/payment-history
router.get('/:id/payment-history', protect, adminOnly, async (req, res, next) => {
  try {
    await ensureTables().catch(() => {});
    const [history] = await db.query(
      `SELECT * FROM TailorPaymentHistory WHERE staffId = ? ORDER BY savedAt DESC LIMIT 24`,
      [req.params.id]
    );
    res.json({ history });
  } catch (err) { next(err); }
});

// POST /api/tailor-staff/:id/payment-history
router.post('/:id/payment-history', protect, adminOnly, async (req, res, next) => {
  try {
    await ensureTables().catch(() => {});
    const { monthYear, totalAmount, notes = '' } = req.body;
    if (!monthYear) return res.status(400).json({ message: 'monthYear (YYYY-MM) is required.' });

    const id = uuidv4();
    await db.execute(
      `INSERT INTO TailorPaymentHistory (id, staffId, monthYear, totalAmount, notes, savedAt) VALUES (?,?,?,?,?,NOW())`,
      [id, req.params.id, monthYear, parseFloat(totalAmount) || 0, notes.trim()]
    );
    const [rows] = await db.query('SELECT * FROM TailorPaymentHistory WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
