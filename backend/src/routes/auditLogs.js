const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/audit-logs
router.get('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { recordType, recordId, action, changedBy, dateFrom, dateTo, page = 1, limit = 30 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    const where = {};
    if (recordType) where.recordType = recordType;
    if (recordId) where.recordId = recordId;
    if (action) where.action = action;
    if (changedBy) where.changedById = changedBy;
    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) where.timestamp.gte = new Date(dateFrom);
      if (dateTo) where.timestamp.lte = new Date(dateTo);
    }
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { changedBy: { select: { name: true, email: true, role: true } } },
        orderBy: { timestamp: 'desc' },
        skip,
        take,
      }),
      prisma.auditLog.count({ where }),
    ]);
    res.json({ logs, total, page: parseInt(page), limit: take });
  } catch (err) { next(err); }
});

module.exports = router;
