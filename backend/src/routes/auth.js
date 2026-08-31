const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { protect, adminOnly } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required.' });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive)
      return res.status(401).json({ message: 'Invalid credentials.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials.' });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    const { password: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', protect, (req, res) => {
  res.json(req.user);
});

// GET /api/auth/credentials
router.get('/credentials', protect, adminOnly, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        plainPassword: true,
        employeeRef: true,
        isActive: true
      },
      orderBy: { role: 'asc' }
    });
    res.json(users);
  } catch (err) { next(err); }
});

// POST /api/auth/logout
router.post('/logout', protect, (req, res) => {
  res.json({ message: 'Logged out successfully.' });
});

module.exports = router;
