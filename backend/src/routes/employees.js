const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../utils/db');
const { protect, adminOnly, requirePermission } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { logCreate, logUpdate, logDelete } = require('../utils/auditLogger');
const { getStorage, cloudinary, isCloudinaryConfigured } = require('../utils/cloudinary');
const { v4: uuidv4 } = require('uuid');

// ── Multer Storage for Employee Proof Photos ─────────────────────────────────
const storage = getStorage('timelines/employees');
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed for employee proof'));
  },
});

// ── Ensure proof columns exist ────────────────────────────────────────────────
async function ensureColumns() {
  for (const col of [
    "ALTER TABLE Employee ADD COLUMN proofUrl VARCHAR(1000) DEFAULT ''",
    "ALTER TABLE Employee ADD COLUMN proofPublicId VARCHAR(500) DEFAULT ''",
  ]) {
    try { await db.query(col); } catch (_) {}
  }
}
ensureColumns().catch(err => console.error('Employee ensureColumns error:', err));

const resolvePhoto = (file) => {
  if (!file) return { proofUrl: '', proofPublicId: '' };
  if (file.buffer) {
    return {
      proofUrl: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
      proofPublicId: '',
    };
  }
  return { proofUrl: '', proofPublicId: '' };
};

// ── Auto-generate Employee ID: EMP-XXXX ─────────────────────────────────
async function generateEmployeeId() {
  const [rows] = await db.query(`SELECT employeeId FROM Employee ORDER BY employeeId DESC LIMIT 1`);
  const last = rows[0];
  if (!last || !last.employeeId.startsWith('EMP-')) return 'EMP-0001';
  const parts = last.employeeId.split('-');
  const num = parseInt(parts[1] || '0', 10) + 1;
  return `EMP-${String(num).padStart(4, '0')}`;
}

// GET /api/employees
router.get('/', protect, async (req, res, next) => {
  try {
    await ensureColumns().catch(() => {});
    const { search = '', status, role, page = 1, limit = 50 } = req.query;
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
    await ensureColumns().catch(() => {});
    const [rows] = await db.query(`SELECT * FROM Employee WHERE employeeId = ?`, [req.params.id]);
    const employee = rows[0];
    if (!employee) return res.status(404).json({ message: 'Employee not found.' });
    res.json(employee);
  } catch (err) { next(err); }
});

// POST /api/employees  (with optional proof photo)
router.post('/', protect, requirePermission('employees'), upload.single('proof'), async (req, res, next) => {
  try {
    await ensureColumns().catch(() => {});
    const { employeeId: customId, name, role = 'Tailor', phone = '', email = '', address = '', joiningDate, status = 'active', notes = '' } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: 'Employee name is required.' });
    }

    let employeeId = customId?.trim();
    if (employeeId) {
      const [dup] = await db.query('SELECT employeeId FROM Employee WHERE employeeId = ?', [employeeId]);
      if (dup.length) {
        return res.status(409).json({ message: `Employee ID "${employeeId}" already exists.` });
      }
    } else {
      employeeId = await generateEmployeeId();
    }

    const joinDate = joiningDate ? new Date(joiningDate) : new Date();
    const { proofUrl, proofPublicId } = resolvePhoto(req.file);

    await db.execute(
      `INSERT INTO Employee (employeeId, name, role, phone, email, address, notes, joiningDate, status, proofUrl, proofPublicId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [employeeId, name.trim(), role, phone.trim(), email.trim(), address.trim(), notes.trim(), joinDate, status, proofUrl, proofPublicId]
    );

    const [rows] = await db.query(`SELECT * FROM Employee WHERE employeeId = ?`, [employeeId]);
    const employee = rows[0];

    // Create staff account for Tailors / Designers if needed
    if (role === 'Designer' || role === 'Tailor') {
      try {
        let userEmail = email?.trim() || `${name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}@timelines.in`;
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
          [uuidv4(), name.trim(), userEmail, defaultPassword, 'timelines123', employee.employeeId]
        );
      } catch (userErr) {
        console.error('Failed to auto-create user for employee:', userErr);
      }
    }

    try { await logCreate('Employee', employee.employeeId, req.user, employee); } catch {}
    res.status(201).json(employee);
  } catch (err) { next(err); }
});

// PUT /api/employees/:id  (with optional new proof photo)
router.put('/:id', protect, requirePermission('employees'), upload.single('proof'), async (req, res, next) => {
  try {
    await ensureColumns().catch(() => {});
    const [rows] = await db.query(`SELECT * FROM Employee WHERE employeeId = ?`, [req.params.id]);
    const old = rows[0];
    if (!old) return res.status(404).json({ message: 'Employee not found.' });

    const { name, role = old.role, phone = '', email = '', address = '', joiningDate, status = old.status, notes = '' } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: 'Employee name is required.' });
    }

    let proofUrl = old.proofUrl || '';
    let proofPublicId = old.proofPublicId || '';

    if (req.file) {
      // Remove old photo
      if (old.proofPublicId) {
        if (isCloudinaryConfigured) {
          try { await cloudinary.uploader.destroy(old.proofPublicId); } catch {}
        } else {
          try {
            const oldPath = path.join(__dirname, '../../uploads/timelines_employees', old.proofPublicId);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          } catch {}
        }
      }
      const resolved = resolvePhoto(req.file);
      proofUrl = resolved.proofUrl;
      proofPublicId = resolved.proofPublicId;
    }

    let query = `UPDATE Employee SET name=?, role=?, phone=?, email=?, address=?, status=?, notes=?, proofUrl=?, proofPublicId=?, updatedAt=NOW()`;
    let params = [name.trim(), role, phone.trim(), email.trim(), address.trim(), status, notes.trim(), proofUrl, proofPublicId];
    
    if (joiningDate) {
      query += `, joiningDate=?`;
      params.push(new Date(joiningDate));
    }
    query += ` WHERE employeeId=?`;
    params.push(req.params.id);

    await db.execute(query, params);

    const [newRows] = await db.query(`SELECT * FROM Employee WHERE employeeId = ?`, [req.params.id]);
    const updated = newRows[0];
    try { await logUpdate('Employee', updated.employeeId, req.user, old, updated); } catch {}
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/employees/:id
router.delete('/:id', protect, requirePermission('employees'), async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT * FROM Employee WHERE employeeId = ?`, [req.params.id]);
    const employee = rows[0];
    if (!employee) return res.status(404).json({ message: 'Employee not found.' });

    // Clean up proof photo
    if (employee.proofPublicId) {
      if (isCloudinaryConfigured) {
        try { await cloudinary.uploader.destroy(employee.proofPublicId); } catch {}
      } else {
        try {
          const oldPath = path.join(__dirname, '../../uploads/timelines_employees', employee.proofPublicId);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        } catch {}
      }
    }

    try { await logDelete('Employee', employee.employeeId, req.user, employee); } catch {}
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
