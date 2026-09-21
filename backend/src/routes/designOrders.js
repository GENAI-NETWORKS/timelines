const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../utils/db');
const { protect, adminOnly } = require('../middleware/auth');
const { logCreate, logUpdate, logDelete } = require('../utils/auditLogger');
const { v4: uuidv4 } = require('uuid');

// ─── Multer setup ─────────────────────────────────────────────────────────
const { getStorage } = require('../utils/cloudinary');
const storage = getStorage('timelines/sketches');
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Auto-generate Order ID: ORD-XXXX ────────────────────────────────────
async function generateOrderId() {
  const [rows] = await db.query(`SELECT orderId FROM DesignOrder ORDER BY orderId DESC LIMIT 1`);
  const last = rows[0];
  if (!last) return 'ORD-0001';
  const num = parseInt(last.orderId.split('-')[1], 10) + 1;
  return `ORD-${String(num).padStart(4, '0')}`;
}

// ─── Helper to shape order response ──────────────────────────────────────
const formatOrderLight = (row) => {
  const formatted = { ...row, customer: null, tailor: null };
  if (row['customer.customerId']) {
    formatted.customer = { 
      customerId: row['customer.customerId'], name: row['customer.name'], 
      phone: row['customer.phone'], address: row['customer.address'], email: row['customer.email']
    };
  }
  if (row['tailor.employeeId']) {
    formatted.tailor = { 
      employeeId: row['tailor.employeeId'], name: row['tailor.name'], role: row['tailor.role'] 
    };
  }
  
  // Cleanup flat fields
  ['customer.customerId', 'customer.name', 'customer.phone', 'customer.address', 'customer.email',
   'tailor.employeeId', 'tailor.name', 'tailor.role'].forEach(k => delete formatted[k]);
  
  if (typeof formatted.measurements === 'string') {
    try { formatted.measurements = JSON.parse(formatted.measurements); } catch (e) { formatted.measurements = {}; }
  }
  
  return formatted;
};

const getFullOrder = async (orderId) => {
  const [rows] = await db.query(`
    SELECT o.*,
           c.customerId as 'customer.customerId', c.name as 'customer.name', 
           c.phone as 'customer.phone', c.address as 'customer.address', c.email as 'customer.email',
           c.notes as 'customer.notes', c.createdAt as 'customer.createdAt', c.updatedAt as 'customer.updatedAt',
           t.employeeId as 'tailor.employeeId', t.name as 'tailor.name', t.role as 'tailor.role'
    FROM DesignOrder o
    LEFT JOIN Customer c ON o.customerId = c.customerId
    LEFT JOIN Employee t ON o.assignedTailorId = t.employeeId
    WHERE o.orderId = ?
  `, [orderId]);
  
  if (!rows.length) return null;
  const order = formatOrderLight(rows[0]);
  
  // Also nest full customer since fullOrderInclude uses full customer
  if (order.customer) {
    order.customer.notes = rows[0]['customer.notes'];
    order.customer.createdAt = rows[0]['customer.createdAt'];
    order.customer.updatedAt = rows[0]['customer.updatedAt'];
  }

  const [particulars] = await db.query(`SELECT * FROM OrderParticular WHERE orderId = ? ORDER BY sortOrder ASC`, [orderId]);
  const [designSections] = await db.query(`SELECT * FROM OrderDesignSection WHERE orderId = ?`, [orderId]);
  
  order.particulars = particulars;
  order.designSections = designSections;
  
  return order;
};

// ─── Helper: upsert particulars ───────────────────────────────────────────
async function syncParticulars(conn, orderId, particulars = []) {
  await conn.execute(`DELETE FROM OrderParticular WHERE orderId = ?`, [orderId]);
  if (particulars.length > 0) {
    for (let i = 0; i < particulars.length; i++) {
      const p = particulars[i];
      await conn.execute(
        `INSERT INTO OrderParticular (id, orderId, itemName, qty, notes, sortOrder) VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), orderId, p.itemName || '', p.qty || '', p.notes || '', i]
      );
    }
  }
}

// ─── Helper: upsert design sections ──────────────────────────────────────
async function syncDesignSections(conn, orderId, designSections = []) {
  for (const s of designSections) {
    const [existing] = await conn.query(
      `SELECT id FROM OrderDesignSection WHERE orderId = ? AND sectionType = ?`, 
      [orderId, s.sectionType]
    );
    if (existing.length > 0) {
      let query = `UPDATE OrderDesignSection SET notes = ?`;
      let params = [s.notes || ''];
      if (s.sketchImageUrl !== undefined) { query += `, sketchImageUrl = ?`; params.push(s.sketchImageUrl); }
      if (s.sketchJSON !== undefined) { query += `, sketchJSON = ?`; params.push(s.sketchJSON); }
      query += ` WHERE orderId = ? AND sectionType = ?`;
      params.push(orderId, s.sectionType);
      await conn.execute(query, params);
    } else {
      await conn.execute(
        `INSERT INTO OrderDesignSection (id, orderId, sectionType, notes, sketchImageUrl, sketchJSON) VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), orderId, s.sectionType, s.notes || '', s.sketchImageUrl || null, s.sketchJSON || null]
      );
    }
  }
}

const selectOrderLightQuery = `
  SELECT o.*,
         c.customerId as 'customer.customerId', c.name as 'customer.name', c.phone as 'customer.phone', c.address as 'customer.address', c.email as 'customer.email',
         t.employeeId as 'tailor.employeeId', t.name as 'tailor.name', t.role as 'tailor.role'
  FROM DesignOrder o
  LEFT JOIN Customer c ON o.customerId = c.customerId
  LEFT JOIN Employee t ON o.assignedTailorId = t.employeeId
`;

// GET /api/design-orders
router.get('/', protect, async (req, res, next) => {
  try {
    const { search = '', status, customerId, tailorId, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    
    let whereClauses = [];
    let params = [];
    
    if (req.user.role === 'staff' && req.user.employeeRef) {
      whereClauses.push('o.assignedTailorId = ?');
      params.push(req.user.employeeRef);
    }
    if (status) { whereClauses.push('o.status = ?'); params.push(status); }
    if (customerId) { whereClauses.push('o.customerId = ?'); params.push(customerId); }
    if (tailorId) { whereClauses.push('o.assignedTailorId = ?'); params.push(tailorId); }
    
    if (search) {
      whereClauses.push('(o.orderId LIKE ? OR o.garmentType LIKE ? OR c.name LIKE ?)');
      const likeS = `%${search}%`;
      params.push(likeS, likeS, likeS);
    }
    
    let whereClause = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';
    
    const [[{ total }]] = await db.query(`
      SELECT COUNT(*) as total FROM DesignOrder o 
      LEFT JOIN Customer c ON o.customerId = c.customerId
      ${whereClause}
    `, params);
    
    const [rows] = await db.query(`
      ${selectOrderLightQuery}
      ${whereClause}
      ORDER BY o.createdAt DESC
      LIMIT ? OFFSET ?
    `, [...params, take, skip]);
    
    res.json({ orders: rows.map(formatOrderLight), total, page: parseInt(page), limit: take });
  } catch (err) { next(err); }
});

// GET /api/design-orders/:id — basic (lightweight)
router.get('/:id', protect, async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      ${selectOrderLightQuery}
      WHERE o.orderId = ?
    `, [req.params.id]);
    
    if (rows.length === 0) return res.status(404).json({ message: 'Order not found.' });
    res.json(formatOrderLight(rows[0]));
  } catch (err) { next(err); }
});

// GET /api/design-orders/:id/full — full order with all nested data
router.get('/:id/full', protect, async (req, res, next) => {
  try {
    const order = await getFullOrder(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    res.json(order);
  } catch (err) { next(err); }
});

// POST /api/design-orders — create order + nested data in one transaction
router.post('/', protect, adminOnly, async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      customerId, garmentType, measurements = {}, fabricNotes = '',
      specialInstructions = '', assignedTailorId, deliveryDate, orderDate,
      bagRef, isSample = false, baseDescription = '',
      threadColors = '', buttonsNeeded = '', customerConfirmedAt,
      particulars = [], designSections = [], newCustomer,
    } = req.body;

    let resolvedCustomerId = customerId;

    if (!customerId && newCustomer && newCustomer.name) {
      const year = new Date().getFullYear();
      const prefix = `TC-${year}-`;
      const [lastRows] = await conn.query(`SELECT customerId FROM Customer WHERE customerId LIKE ? ORDER BY customerId DESC LIMIT 1`, [`${prefix}%`]);
      const last = lastRows[0];
      const num = last ? parseInt(last.customerId.split('-')[2], 10) + 1 : 1;
      const newCustId = `${prefix}${String(num).padStart(4, '0')}`;
      
      await conn.execute(
        `INSERT INTO Customer (customerId, name, phone, email, address, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [newCustId, newCustomer.name, newCustomer.phone || '', newCustomer.email || '', newCustomer.address || '', newCustomer.notes || '']
      );
      resolvedCustomerId = newCustId;
      
      const [custRows] = await conn.query(`SELECT * FROM Customer WHERE customerId = ?`, [newCustId]);
      await logCreate('Customer', newCustId, req.user, custRows[0]);
    }

    if (!resolvedCustomerId) {
      await conn.rollback();
      return res.status(400).json({ message: 'Customer required.' });
    }

    const orderId = await generateOrderId();

    await conn.execute(
      `INSERT INTO DesignOrder (
        orderId, customerId, garmentType, measurements, fabricNotes, specialInstructions,
        assignedTailorId, deliveryDate, orderDate, createdById, bagRef, isSample,
        baseDescription, threadColors, buttonsNeeded, customerConfirmedAt, status, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', NOW(), NOW())`,
      [
        orderId, resolvedCustomerId, garmentType, JSON.stringify(measurements || {}), fabricNotes, specialInstructions,
        assignedTailorId || null, deliveryDate ? new Date(deliveryDate) : null, orderDate ? new Date(orderDate) : new Date(),
        req.user.id, bagRef || null, isSample ? 1 : 0, baseDescription || '', threadColors || '', buttonsNeeded || '',
        customerConfirmedAt ? new Date(customerConfirmedAt) : null
      ]
    );

    await syncParticulars(conn, orderId, particulars);
    await syncDesignSections(conn, orderId, designSections);
    
    await conn.commit();
    
    const order = await getFullOrder(orderId);
    await logCreate('DesignOrder', orderId, req.user, order);
    res.status(201).json(order);
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// PUT /api/design-orders/:id — update order + nested data in one transaction
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const oldOrder = await getFullOrder(req.params.id);
    if (!oldOrder) {
      await conn.rollback();
      return res.status(404).json({ message: 'Order not found.' });
    }

    const {
      customerId, garmentType, measurements, fabricNotes, specialInstructions,
      assignedTailorId, status, deliveryDate, orderDate,
      bagRef, isSample, baseDescription, threadColors, buttonsNeeded, customerConfirmedAt,
      particulars, designSections,
    } = req.body;
    
    let query = `
      UPDATE DesignOrder SET 
        customerId=?, garmentType=?, measurements=?, fabricNotes=?, specialInstructions=?,
        assignedTailorId=?, status=?, bagRef=?, isSample=?, baseDescription=?, threadColors=?, buttonsNeeded=?,
        updatedAt=NOW()
    `;
    let params = [
      customerId, garmentType, JSON.stringify(measurements || oldOrder.measurements), fabricNotes, specialInstructions,
      assignedTailorId || null, status, bagRef !== undefined ? bagRef : oldOrder.bagRef,
      isSample !== undefined ? (isSample ? 1 : 0) : oldOrder.isSample,
      baseDescription !== undefined ? baseDescription : oldOrder.baseDescription,
      threadColors !== undefined ? threadColors : oldOrder.threadColors,
      buttonsNeeded !== undefined ? buttonsNeeded : oldOrder.buttonsNeeded
    ];
    
    if (deliveryDate !== undefined) { query += `, deliveryDate=?`; params.push(deliveryDate ? new Date(deliveryDate) : null); }
    if (orderDate !== undefined) { query += `, orderDate=?`; params.push(orderDate ? new Date(orderDate) : null); }
    if (customerConfirmedAt !== undefined) { query += `, customerConfirmedAt=?`; params.push(customerConfirmedAt ? new Date(customerConfirmedAt) : null); }
    
    query += ` WHERE orderId=?`;
    params.push(req.params.id);
    
    await conn.execute(query, params);

    if (particulars !== undefined) await syncParticulars(conn, req.params.id, particulars);
    if (designSections !== undefined) await syncDesignSections(conn, req.params.id, designSections);
    
    await conn.commit();
    
    const updatedOrder = await getFullOrder(req.params.id);
    await logUpdate('DesignOrder', req.params.id, req.user, oldOrder, updatedOrder);
    res.json(updatedOrder);
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// PATCH assign tailor
router.patch('/:id/assign', protect, adminOnly, async (req, res, next) => {
  try {
    const { tailorId } = req.body;
    const oldOrder = await getFullOrder(req.params.id);
    if (!oldOrder) return res.status(404).json({ message: 'Order not found.' });
    
    await db.execute(`UPDATE DesignOrder SET assignedTailorId=?, updatedAt=NOW() WHERE orderId=?`, [tailorId || null, req.params.id]);
    
    const updatedOrder = await getFullOrder(req.params.id);
    await logUpdate('DesignOrder', req.params.id, req.user, oldOrder, updatedOrder);
    res.json(updatedOrder);
  } catch (err) { next(err); }
});

// PATCH update status
router.patch('/:id/status', protect, async (req, res, next) => {
  try {
    const { status } = req.body;
    const oldOrder = await getFullOrder(req.params.id);
    if (!oldOrder) return res.status(404).json({ message: 'Order not found.' });
    
    await db.execute(`UPDATE DesignOrder SET status=?, updatedAt=NOW() WHERE orderId=?`, [status, req.params.id]);
    
    const updatedOrder = await getFullOrder(req.params.id);
    await logUpdate('DesignOrder', req.params.id, req.user, oldOrder, updatedOrder);
    res.json(updatedOrder);
  } catch (err) { next(err); }
});

// POST upload main sketch image (legacy/freeform canvas)
router.post('/:id/sketch', protect, adminOnly, upload.single('sketch'), async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT orderId FROM DesignOrder WHERE orderId = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Order not found.' });
    
    const sketchUrl = req.file.path;
    const sketchJSON = req.body.sketchJSON || null;
    
    await db.execute(
      `UPDATE DesignOrder SET designSketchUrl=?, designSketchJSON=?, updatedAt=NOW() WHERE orderId=?`,
      [sketchUrl, sketchJSON, req.params.id]
    );
    res.json({ designSketchUrl: sketchUrl });
  } catch (err) { next(err); }
});

// PATCH save main sketch JSON only
router.patch('/:id/sketch-json', protect, adminOnly, async (req, res, next) => {
  try {
    const { sketchJSON, designSketchUrl } = req.body;
    let query = `UPDATE DesignOrder SET designSketchJSON=?, updatedAt=NOW()`;
    let params = [sketchJSON];
    if (designSketchUrl) { query += `, designSketchUrl=?`; params.push(designSketchUrl); }
    query += ` WHERE orderId=?`;
    params.push(req.params.id);
    
    await db.execute(query, params);
    
    const [rows] = await db.query(`SELECT designSketchUrl FROM DesignOrder WHERE orderId = ?`, [req.params.id]);
    res.json({ message: 'Sketch saved.', designSketchUrl: rows[0].designSketchUrl });
  } catch (err) { next(err); }
});

// POST upload per-section sketch: /api/design-orders/:id/section-sketch
router.post('/:id/section-sketch', protect, adminOnly, upload.single('sketch'), async (req, res, next) => {
  try {
    const { sectionType, sketchJSON } = req.body;
    if (!['back_neck', 'sleeve', 'front_neck'].includes(sectionType)) {
      return res.status(400).json({ message: 'Invalid sectionType.' });
    }
    const [rows] = await db.query(`SELECT orderId FROM DesignOrder WHERE orderId = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Order not found.' });

    const sketchUrl = req.file ? req.file.path : null;

    const [existing] = await db.query(`SELECT id FROM OrderDesignSection WHERE orderId = ? AND sectionType = ?`, [req.params.id, sectionType]);
    if (existing.length > 0) {
      let query = `UPDATE OrderDesignSection SET sketchJSON = ?`;
      let params = [sketchJSON || null];
      if (sketchUrl) { query += `, sketchImageUrl = ?`; params.push(sketchUrl); }
      query += ` WHERE orderId = ? AND sectionType = ?`;
      params.push(req.params.id, sectionType);
      await db.execute(query, params);
    } else {
      await db.execute(
        `INSERT INTO OrderDesignSection (id, orderId, sectionType, sketchImageUrl, sketchJSON, notes) VALUES (?, ?, ?, ?, ?, '')`,
        [uuidv4(), req.params.id, sectionType, sketchUrl, sketchJSON || null]
      );
    }
    
    const [secRows] = await db.query(`SELECT sketchImageUrl FROM OrderDesignSection WHERE orderId = ? AND sectionType = ?`, [req.params.id, sectionType]);
    res.json({ sectionType, sketchImageUrl: secRows[0].sketchImageUrl });
  } catch (err) { next(err); }
});

// DELETE /api/design-orders/:id
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const order = await getFullOrder(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    await logDelete('DesignOrder', order.orderId, req.user, order);
    await db.execute(`DELETE FROM DesignOrder WHERE orderId = ?`, [req.params.id]);
    res.json({ message: 'Order deleted.' });
  } catch (err) { next(err); }
});

// GET audit log for order
router.get('/:id/audit', protect, adminOnly, async (req, res, next) => {
  try {
    const [logs] = await db.query(`
      SELECT a.*, u.name as 'changedBy.name', u.role as 'changedBy.role'
      FROM AuditLog a
      LEFT JOIN User u ON a.changedById = u.id
      WHERE a.recordType = 'DesignOrder' AND a.recordId = ?
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
