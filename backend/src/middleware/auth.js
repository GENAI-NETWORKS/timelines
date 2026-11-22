const jwt = require('jsonwebtoken');
const db = require('../utils/db');

const DEFAULT_ADMIN_PERMISSIONS = {
  customers: true,
  orders: true,
  billing: true,
  paymentRecords: true,
  materials: true,
  tailorsPayment: true,
  employees: true,
};

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer '))
      return res.status(401).json({ message: 'Not authenticated. Please log in.' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await db.query(
      `SELECT id, name, email, role, employeeRef, permissions, isActive, createdAt FROM User WHERE id = ?`,
      [decoded.id]
    );
    const user = rows[0];

    if (!user || !user.isActive)
      return res.status(401).json({ message: 'User not found or deactivated.' });

    if (user.role === 'admin') {
      user.permissions = { ...DEFAULT_ADMIN_PERMISSIONS };
    } else if (user.permissions && typeof user.permissions === 'string') {
      try {
        user.permissions = JSON.parse(user.permissions);
      } catch {
        user.permissions = {};
      }
    } else if (!user.permissions) {
      user.permissions = {};
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ message: 'Admin access required.' });
  next();
};

const requirePermission = (permKey) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated.' });
    if (req.user.role === 'admin') return next();
    if (req.user.permissions && req.user.permissions[permKey]) return next();
    return res.status(403).json({ message: `Access denied. Requires '${permKey}' panel access.` });
  };
};

module.exports = { protect, adminOnly, requirePermission };
