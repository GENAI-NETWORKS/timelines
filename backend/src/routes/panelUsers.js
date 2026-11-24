const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');
const { protect, adminOnly } = require('../middleware/auth');

// ── Auto-ensure columns exist in database ──────────────────────────────────
async function ensureColumns() {
  try {
    await db.query("ALTER TABLE User ADD COLUMN permissions TEXT");
  } catch (_) {}
  try {
    await db.query("ALTER TABLE User ADD COLUMN plainPassword VARCHAR(255) DEFAULT 'timelines123'");
  } catch (_) {}
  try {
    await db.query("ALTER TABLE TailoringOrder ADD COLUMN assignedToId VARCHAR(64) DEFAULT ''");
  } catch (_) {}
  try {
    await db.query("ALTER TABLE TailoringOrder ADD COLUMN assignedToName VARCHAR(255) DEFAULT ''");
  } catch (_) {}
}
ensureColumns().catch(() => {});

// Default full permissions for admin
const DEFAULT_PERMISSIONS = {
  customers: true,
  orders: true,
  billing: true,
  paymentRecords: true,
  billHistory: true,
  materials: true,
  tailorsPayment: true,
  employees: true,
};

// Helper to parse permissions
function parsePerms(raw, role) {
  if (role === 'admin') return { ...DEFAULT_PERMISSIONS };
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// ── GET /api/panel-users/assignable (For Order Assignment dropdown) ──────────
router.get('/assignable', protect, async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, email, role FROM User WHERE isActive = 1 ORDER BY name ASC`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /api/panel-users (Admin only: list all panel users) ─────────────────
router.get('/', protect, adminOnly, async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, email, role, plainPassword, permissions, isActive, employeeRef, createdAt, updatedAt
       FROM User
       ORDER BY role ASC, name ASC`
    );

    const users = rows.map((u) => ({
      ...u,
      permissions: parsePerms(u.permissions, u.role),
    }));

    res.json(users);
  } catch (err) { next(err); }
});

// ── POST /api/panel-users (Admin only: create new panel user) ───────────────
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { name, email, password, role = 'staff', permissions = {} } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email ID is required.' });
    }
    if (!password || !password.trim()) {
      return res.status(400).json({ message: 'Password is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const [existing] = await db.query(`SELECT id FROM User WHERE email = ?`, [cleanEmail]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'A user with this email ID already exists.' });
    }

    const cleanName = (name && name.trim()) || cleanEmail.split('@')[0];
    const hashedPassword = await bcrypt.hash(password.trim(), 10);
    const id = uuidv4();
    const permString = JSON.stringify(permissions || {});

    await db.execute(
      `INSERT INTO User (id, name, email, password, plainPassword, role, permissions, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [id, cleanName, cleanEmail, hashedPassword, password.trim(), role, permString]
    );

    const [rows] = await db.query(
      `SELECT id, name, email, role, plainPassword, permissions, isActive, createdAt FROM User WHERE id = ?`,
      [id]
    );

    res.status(201).json({
      ...rows[0],
      permissions: parsePerms(rows[0].permissions, rows[0].role),
    });
  } catch (err) { next(err); }
});

// ── PUT /api/panel-users/:id (Admin only: edit panel user) ──────────────────
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const { name, email, password, role, isActive, permissions } = req.body;
    const { id } = req.params;

    const [rows] = await db.query(`SELECT * FROM User WHERE id = ?`, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }
    const current = rows[0];

    let updateFields = [];
    let params = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      params.push(name.trim());
    }
    if (email !== undefined && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      // Check if another user has this email
      const [duplicate] = await db.query(`SELECT id FROM User WHERE email = ? AND id != ?`, [cleanEmail, id]);
      if (duplicate.length > 0) {
        return res.status(400).json({ message: 'Email is already used by another user.' });
      }
      updateFields.push('email = ?');
      params.push(cleanEmail);
    }
    if (password && password.trim()) {
      const hashedPassword = await bcrypt.hash(password.trim(), 10);
      updateFields.push('password = ?');
      params.push(hashedPassword);
      updateFields.push('plainPassword = ?');
      params.push(password.trim());
    }
    if (role !== undefined) {
      updateFields.push('role = ?');
      params.push(role);
    }
    if (isActive !== undefined) {
      updateFields.push('isActive = ?');
      params.push(isActive ? 1 : 0);
    }
    if (permissions !== undefined) {
      updateFields.push('permissions = ?');
      params.push(JSON.stringify(permissions || {}));
    }

    if (updateFields.length > 0) {
      updateFields.push('updatedAt = NOW()');
      params.push(id);
      await db.execute(`UPDATE User SET ${updateFields.join(', ')} WHERE id = ?`, params);
    }

    const [updatedRows] = await db.query(
      `SELECT id, name, email, role, plainPassword, permissions, isActive, createdAt, updatedAt FROM User WHERE id = ?`,
      [id]
    );

    res.json({
      ...updatedRows[0],
      permissions: parsePerms(updatedRows[0].permissions, updatedRows[0].role),
    });
  } catch (err) { next(err); }
});

// ── PATCH /api/panel-users/:id/permissions (Admin only: quick toggle) ────────
router.patch('/:id/permissions', protect, adminOnly, async (req, res, next) => {
  try {
    const { permissions } = req.body;
    const { id } = req.params;

    const [rows] = await db.query(`SELECT id, role FROM User WHERE id = ?`, [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'User not found.' });

    const permString = JSON.stringify(permissions || {});
    await db.execute(`UPDATE User SET permissions = ?, updatedAt = NOW() WHERE id = ?`, [permString, id]);

    res.json({ success: true, permissions: permissions || {} });
  } catch (err) { next(err); }
});

// ── DELETE /api/panel-users/:id (Admin only: delete panel user) ─────────────
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (req.user.id === id) {
      return res.status(400).json({ message: 'You cannot delete your own admin account.' });
    }

    const [existing] = await db.query(`SELECT id, email FROM User WHERE id = ?`, [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    await db.execute(`DELETE FROM User WHERE id = ?`, [id]);
    res.json({ message: 'Panel user deleted successfully.' });
  } catch (err) { next(err); }
});

module.exports = router;
