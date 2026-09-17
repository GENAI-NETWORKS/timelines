const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { protect, adminOnly } = require('../middleware/auth');
const { logCreate, logUpdate, logDelete } = require('../utils/auditLogger');
const { v4: uuidv4 } = require('uuid');

// ─── Helper: calculate net ────────────────────────────────────────────────
function calcNet(data) {
  return (
    Number(data.baseSalary || 0) +
    Number(data.bonus || 0) -
    Number(data.advances || 0) -
    Number(data.deductions || 0)
  );
}

const formatSalary = (row) => {
  const formatted = { ...row, employee: null };
  if (row['employee.employeeId']) {
    formatted.employee = {
      employeeId: row['employee.employeeId'],
      name: row['employee.name'],
      role: row['employee.role']
    };
  }
  delete formatted['employee.employeeId'];
  delete formatted['employee.name'];
  delete formatted['employee.role'];
  if(typeof formatted.paymentHistory === 'string') formatted.paymentHistory = JSON.parse(formatted.paymentHistory);
  return formatted;
};

const salaryQuerySelect = `
  SELECT s.*,
         e.employeeId as 'employee.employeeId', e.name as 'employee.name', e.role as 'employee.role'
  FROM Salary s
  LEFT JOIN Employee e ON s.employeeId = e.employeeId
`;

// GET all salaries
router.get('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { employeeId, month, year, paidStatus, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    
    let whereClauses = [];
    let params = [];
    if (employeeId) { whereClauses.push('s.employeeId = ?'); params.push(employeeId); }
    if (month) { whereClauses.push('s.month = ?'); params.push(parseInt(month)); }
    if (year) { whereClauses.push('s.year = ?'); params.push(parseInt(year)); }
    if (paidStatus) { whereClauses.push('s.paidStatus = ?'); params.push(paidStatus); }
    
    let whereClause = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';
    
    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM Salary s ${whereClause}`, params);
    
    const [rows] = await db.query(`
      ${salaryQuerySelect}
      ${whereClause}
      ORDER BY s.year DESC, s.month DESC
      LIMIT ? OFFSET ?
    `, [...params, take, skip]);
    
    res.json({ records: rows.map(formatSalary), total, page: parseInt(page), limit: take });
  } catch (err) { next(err); }
});

// GET salaries by employee
router.get('/employee/:employeeId', protect, async (req, res, next) => {
  try {
    const { year } = req.query;
    let whereClause = 'WHERE s.employeeId = ?';
    let params = [req.params.employeeId];
    if (year) {
      whereClause += ' AND s.year = ?';
      params.push(parseInt(year));
    }
    const [rows] = await db.query(`
      ${salaryQuerySelect}
      ${whereClause}
      ORDER BY s.year DESC, s.month DESC
    `, params);
    res.json(rows.map(formatSalary));
  } catch (err) { next(err); }
});

// GET single salary record
router.get('/:id', protect, async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      ${salaryQuerySelect}
      WHERE s.id = ?
    `, [req.params.id]);
    const record = rows[0];
    if (!record) return res.status(404).json({ message: 'Record not found.' });
    res.json(formatSalary(record));
  } catch (err) { next(err); }
});

// POST create salary record
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { employeeId, month, year, baseSalary = 0, advances = 0, deductions = 0, bonus = 0, paidStatus = 'unpaid', notes = '' } = req.body;
    const netPaid = calcNet({ baseSalary, advances, deductions, bonus });
    const id = uuidv4();
    
    // Check unique constraint
    const [existing] = await db.query(`SELECT id FROM Salary WHERE employeeId = ? AND month = ? AND year = ?`, [employeeId, parseInt(month), parseInt(year)]);
    if (existing.length > 0) return res.status(400).json({ message: 'Salary record already exists for this employee and month/year.' });
    
    await db.execute(
      `INSERT INTO Salary (id, employeeId, month, year, baseSalary, advances, deductions, bonus, netPaid, paidStatus, notes, paymentHistory, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, employeeId, parseInt(month), parseInt(year), Number(baseSalary), Number(advances), Number(deductions), Number(bonus), netPaid, paidStatus, notes, JSON.stringify([])]
    );
    
    const [rows] = await db.query(`${salaryQuerySelect} WHERE s.id = ?`, [id]);
    const record = formatSalary(rows[0]);
    await logCreate('Salary', record.id, req.user, record);
    res.status(201).json(record);
  } catch (err) { next(err); }
});

// PUT update salary record
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const [oldRows] = await db.query(`SELECT * FROM Salary WHERE id = ?`, [req.params.id]);
    const old = oldRows[0];
    if (!old) return res.status(404).json({ message: 'Record not found.' });
    
    const { baseSalary, advances, deductions, bonus, paidStatus, notes } = req.body;
    const netPaid = calcNet({ baseSalary, advances, deductions, bonus });
    
    await db.execute(
      `UPDATE Salary SET baseSalary=?, advances=?, deductions=?, bonus=?, netPaid=?, paidStatus=?, notes=?, updatedAt=NOW() WHERE id=?`,
      [Number(baseSalary), Number(advances), Number(deductions), Number(bonus), netPaid, paidStatus, notes, req.params.id]
    );
    
    const [newRows] = await db.query(`${salaryQuerySelect} WHERE s.id = ?`, [req.params.id]);
    const updated = formatSalary(newRows[0]);
    await logUpdate('Salary', updated.id, req.user, old, updated);
    res.json(updated);
  } catch (err) { next(err); }
});

// PATCH mark as paid
router.patch('/:id/mark-paid', protect, adminOnly, async (req, res, next) => {
  try {
    const { amount = 0, note = 'Marked paid' } = req.body;
    const [rows] = await db.query(`SELECT * FROM Salary WHERE id = ?`, [req.params.id]);
    const record = rows[0];
    if (!record) return res.status(404).json({ message: 'Record not found.' });
    
    let history = [];
    if (record.paymentHistory) {
      history = typeof record.paymentHistory === 'string' ? JSON.parse(record.paymentHistory) : record.paymentHistory;
    }
    history.push({ amount: Number(amount), note, paidAt: new Date().toISOString() });
    
    await db.execute(
      `UPDATE Salary SET paidStatus=?, paymentHistory=?, updatedAt=NOW() WHERE id=?`,
      ['paid', JSON.stringify(history), req.params.id]
    );
    
    const [newRows] = await db.query(`${salaryQuerySelect} WHERE s.id = ?`, [req.params.id]);
    res.json(formatSalary(newRows[0]));
  } catch (err) { next(err); }
});

// DELETE salary record
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT * FROM Salary WHERE id = ?`, [req.params.id]);
    const record = rows[0];
    if (!record) return res.status(404).json({ message: 'Record not found.' });
    
    await logDelete('Salary', record.id, req.user, record);
    await db.execute(`DELETE FROM Salary WHERE id = ?`, [req.params.id]);
    res.json({ message: 'Deleted.' });
  } catch (err) { next(err); }
});

// GET audit log for salary record
router.get('/:id/audit', protect, adminOnly, async (req, res, next) => {
  try {
    const [logs] = await db.query(`
      SELECT a.*, u.name as 'changedBy.name', u.role as 'changedBy.role'
      FROM AuditLog a
      LEFT JOIN User u ON a.changedById = u.id
      WHERE a.recordType = 'Salary' AND a.recordId = ?
      ORDER BY a.timestamp DESC LIMIT 50
    `, [req.params.id]);

    const formattedLogs = logs.map(log => {
      const formatted = { ...log, changedBy: null };
      if (log['changedBy.name']) {
        formatted.changedBy = { name: log['changedBy.name'], role: log['changedBy.role'] };
      }
      delete formatted['changedBy.name'];
      delete formatted['changedBy.role'];
      if(typeof formatted.changes === 'string') formatted.changes = JSON.parse(formatted.changes);
      if(typeof formatted.snapshot === 'string') formatted.snapshot = JSON.parse(formatted.snapshot);
      return formatted;
    });

    res.json(formattedLogs);
  } catch (err) { next(err); }
});

module.exports = router;
