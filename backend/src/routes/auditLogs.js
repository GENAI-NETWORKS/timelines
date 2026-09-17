const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/audit-logs
router.get('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { recordType, recordId, action, changedBy, dateFrom, dateTo, page = 1, limit = 30 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    
    let whereClauses = [];
    let params = [];
    
    if (recordType) { whereClauses.push('a.recordType = ?'); params.push(recordType); }
    if (recordId) { whereClauses.push('a.recordId = ?'); params.push(recordId); }
    if (action) { whereClauses.push('a.action = ?'); params.push(action); }
    if (changedBy) { whereClauses.push('a.changedById = ?'); params.push(changedBy); }
    if (dateFrom) { whereClauses.push('a.timestamp >= ?'); params.push(new Date(dateFrom)); }
    if (dateTo) { whereClauses.push('a.timestamp <= ?'); params.push(new Date(dateTo)); }
    
    let whereClause = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';
    
    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM AuditLog a ${whereClause}`, params);
    
    const [logs] = await db.query(`
      SELECT a.*, 
             u.name as 'changedBy.name', u.email as 'changedBy.email', u.role as 'changedBy.role'
      FROM AuditLog a
      LEFT JOIN User u ON a.changedById = u.id
      ${whereClause}
      ORDER BY a.timestamp DESC
      LIMIT ? OFFSET ?
    `, [...params, take, skip]);
    
    const formattedLogs = logs.map(log => {
      const formatted = { ...log, changedBy: null };
      if (log['changedBy.name']) {
        formatted.changedBy = { 
          name: log['changedBy.name'], 
          email: log['changedBy.email'], 
          role: log['changedBy.role'] 
        };
      }
      delete formatted['changedBy.name'];
      delete formatted['changedBy.email'];
      delete formatted['changedBy.role'];
      
      if(typeof formatted.changes === 'string') formatted.changes = JSON.parse(formatted.changes);
      if(typeof formatted.snapshot === 'string') formatted.snapshot = JSON.parse(formatted.snapshot);
      
      return formatted;
    });
    
    res.json({ logs: formattedLogs, total, page: parseInt(page), limit: take });
  } catch (err) { next(err); }
});

module.exports = router;
