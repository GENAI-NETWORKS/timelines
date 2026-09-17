const jwt = require('jsonwebtoken');
const db = require('../utils/db');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer '))
      return res.status(401).json({ message: 'Not authenticated. Please log in.' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await db.query(
      `SELECT id, name, email, role, employeeRef, isActive, createdAt FROM User WHERE id = ?`,
      [decoded.id]
    );
    const user = rows[0];

    if (!user || !user.isActive)
      return res.status(401).json({ message: 'User not found or deactivated.' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ message: 'Admin access required.' });
  next();
};

module.exports = { protect, adminOnly };
