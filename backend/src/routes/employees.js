const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { protect, adminOnly } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { logCreate, logUpdate, logDelete } = require('../utils/auditLogger');
const { v4: uuidv4 } = require('uuid');

// ─── Auto-generate Employee ID: EMP-XXXX ─────────────────────────────────
async function generateEmployeeId() {
  const [rows] = await db.query(`SELECT employeeId FROM Employee ORDER BY employeeId DESC LIMIT 1`);
  const last = rows[0];
  if (!last) return 'EMP-0001';
  const num = parseInt(last.employeeId.split('-')[1], 10) + 1;
  return `EMP-${String(num).padStart(4, '0')}`;
}

// GET /api/employees
router.get('/', protect, async (req, res, next) => {
  try {
    const { search = '', status, role, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    let whereClauses = [];
    let params = [];
    if (status) {
      whereClauses.push(`status = ?`);
      params.push(status);
    }
    if (role) {
      whereClauses.push(`role = ?`);
      params.push(role);
    }
    if (search) {
      whereClauses.push(`(name LIKE ? OR employeeId LIKE ? OR phone LIKE ?)`);
      const likeS = `%${search}%`;
      params.push(likeS, likeS, likeS);
    }
    
    let whereClause = whereClauses.length ? `WHERE ` + whereClauses.join(' AND ') : '';

    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM Employee ${whereClause}`, params);
    const [employees] = await db.query(
      `SELECT * FROM Employee ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      [...params, take, skip]
    );

    res.json({ employees, total, page: parseInt(page), limit: take });
  } catch (err) { next(err); }
});

// GET /api/employees/tailors - active tailors for dropdowns
router.get('/tailors', protect, async (req, res, next) => {
  try {
    const [tailors] = await db.query(
      `SELECT employeeId, name FROM Employee WHERE role = 'Tailor' AND status = 'active'`
    );
    res.json(tailors);
  } catch (err) { next(err); }
});

// GET /api/employees/:id
router.get('/:id', protect, async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT * FROM Employee WHERE employeeId = ?`, [req.params.id]);
    const employee = rows[0];
    if (!employee) return res.status(404).json({ message: 'Employee not found.' });
    res.json(employee);
  } catch (err) { next(err); }
});

// POST /api/employees
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { name, role, phone = '', email = '', address = '', joiningDate, notes = '' } = req.body;
    const employeeId = await generateEmployeeId();
    const joinDate = joiningDate ? new Date(joiningDate) : new Date();

    await db.execute(
      `INSERT INTO Employee (employeeId, name, role, phone, email, address, notes, joiningDate, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
      [employeeId, name, role, phone, email, address, notes, joinDate]
    );

    const [rows] = await db.query(`SELECT * FROM Employee WHERE employeeId = ?`, [employeeId]);
    const employee = rows[0];

    if (role === 'Designer' || role === 'Tailor') {
      let userEmail = email || `${name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}@timelines.in`;
      let [existingUsers] = await db.query(`SELECT id FROM User WHERE email = ?`, [userEmail]);
      let counter = 1;
      while (existingUsers.length > 0) {
        userEmail = `${name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}${counter}@timelines.in`;
        [existingUsers] = await db.query(`SELECT id FROM User WHERE email = ?`, [userEmail]);
        counter++;
      }

      const defaultPassword = await bcrypt.hash('timelines123', 10);
      await db.execute(
        `INSERT INTO User (id, name, email, password, plainPassword, role, employeeRef, isActive, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 'staff', ?, 1, NOW(), NOW())`,
        [uuidv4(), name, userEmail, defaultPassword, 'timelines123', employee.employeeId]
      );
    }

    await logCreate('Employee', employee.employeeId, req.user, employee);
    res.status(201).json(employee);
  } catch (err) { next(err); }
});

// PUT /api/employees/:id
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT * FROM Employee WHERE employeeId = ?`, [req.params.id]);
    const old = rows[0];
    if (!old) return res.status(404).json({ message: 'Employee not found.' });

    const { name, role, phone, email, address, joiningDate, status, notes } = req.body;
    let query = `UPDATE Employee SET name=?, role=?, phone=?, email=?, address=?, status=?, notes=?, updatedAt=NOW()`;
    let params = [name, role, phone, email, address, status, notes];
    
    if (joiningDate) {
      query += `, joiningDate=?`;
      params.push(new Date(joiningDate));
    }
    query += ` WHERE employeeId=?`;
    params.push(req.params.id);

    await db.execute(query, params);

    const [newRows] = await db.query(`SELECT * FROM Employee WHERE employeeId = ?`, [req.params.id]);
    const updated = newRows[0];
    await logUpdate('Employee', updated.employeeId, req.user, old, updated);
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/employees/:id
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT * FROM Employee WHERE employeeId = ?`, [req.params.id]);
    const employee = rows[0];
    if (!employee) return res.status(404).json({ message: 'Employee not found.' });

    await logDelete('Employee', employee.employeeId, req.user, employee);
    await db.execute(`DELETE FROM Employee WHERE employeeId = ?`, [req.params.id]);
    res.json({ message: 'Employee deleted.' });
  } catch (err) { next(err); }
});

// GET /api/employees/:id/audit
router.get('/:id/audit', protect, adminOnly, async (req, res, next) => {
  try {
    const [logs] = await db.query(`
      SELECT a.*, u.name as 'changedBy.name', u.role as 'changedBy.role'
      FROM AuditLog a
      LEFT JOIN User u ON a.changedById = u.id
      WHERE a.recordType = 'Employee' AND a.recordId = ?
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
