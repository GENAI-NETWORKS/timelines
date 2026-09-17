const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../utils/db');
const { protect, adminOnly } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// ── Multer ─────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/tailoring');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

// ── Auto-generate Customer ID ──────────────────────────────────────────────
async function generateCustomerId() {
  const year = new Date().getFullYear();
  const prefix = `TC-${year}-`;
  const [rows] = await db.query(`SELECT customerId FROM Customer WHERE customerId LIKE ? ORDER BY customerId DESC LIMIT 1`, [`${prefix}%`]);
  const last = rows[0];
  const num = last ? parseInt(last.customerId.split('-')[2], 10) + 1 : 1;
  return `${prefix}${String(num).padStart(4, '0')}`;
}

// ── Default sub-items builder ──────────────────────────────────────────────
function buildDefaultSubItems(quantity, itemType) {
  return Array.from({ length: quantity }, (_, i) => ({
    number: i + 1,
    price: '',
    referenceImageUrl: null,
    meter: '',
    frontDesignNotes: '',
    backDesignNotes: '',
    sleeveDesignNotes: '',
    frontCanvasJSON: null,
    backCanvasJSON: null,
    sleeveCanvasJSON: null,
    frontCanvasImageUrl: null,
    backCanvasImageUrl: null,
    sleeveCanvasImageUrl: null,
    aryaWorkNotes: '',
    aryaWorkPrice: '',
    frontDesignImageUrl: null,
    backDesignImageUrl: null,
    sleeveDesignImageUrl: null,
    source: 'SHOP',
    liningSource: 'SHOP',
    liningMeter: '',
    liningPrice: '',
    description: '',
    numberOfSarees: '',
    numberOfFalls: '',
    fallsSource: 'SHOP',
  }));
}

const formatOrderList = (row) => {
  const formatted = { ...row, customer: null, _count: { items: row.itemCount || 0 } };
  if (row['customer.customerId']) {
    formatted.customer = {
      customerId: row['customer.customerId'],
      name: row['customer.name'],
      phone: row['customer.phone']
    };
  }
  delete formatted['customer.customerId'];
  delete formatted['customer.name'];
  delete formatted['customer.phone'];
  delete formatted.itemCount;
  return formatted;
};

const getOrderWithItems = async (id) => {
  const [rows] = await db.query(`
    SELECT o.*,
           c.customerId as 'customer.customerId', c.name as 'customer.name', 
           c.phone as 'customer.phone', c.address as 'customer.address', c.email as 'customer.email',
           c.notes as 'customer.notes', c.createdAt as 'customer.createdAt', c.updatedAt as 'customer.updatedAt'
    FROM TailoringOrder o
    LEFT JOIN Customer c ON o.customerId = c.customerId
    WHERE o.id = ?
  `, [id]);
  
  if (rows.length === 0) return null;
  const order = formatOrderList(rows[0]);
  
  if (order.customer) {
    order.customer.address = rows[0]['customer.address'];
    order.customer.email = rows[0]['customer.email'];
    order.customer.notes = rows[0]['customer.notes'];
    order.customer.createdAt = rows[0]['customer.createdAt'];
    order.customer.updatedAt = rows[0]['customer.updatedAt'];
  }
  
  const [items] = await db.query(`SELECT * FROM TailoringOrderItem WHERE orderId = ? ORDER BY sortOrder ASC`, [id]);
  
  order.items = items.map(item => {
    let details = typeof item.details === 'string' ? JSON.parse(item.details) : item.details || {};
    let subItems = typeof item.subItems === 'string' ? JSON.parse(item.subItems) : item.subItems || [];
    return { ...item, details, subItems };
  });
  
  return order;
};

// ── GET /api/tailoring-orders ──────────────────────────────────────────────
router.get('/', protect, async (req, res, next) => {
  try {
    const { search = '', status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    
    let whereClauses = [];
    let params = [];
    
    if (status) { whereClauses.push('o.status = ?'); params.push(status); }
    if (search) {
      whereClauses.push('(c.name LIKE ? OR c.phone LIKE ?)');
      const likeS = `%${search}%`;
      params.push(likeS, likeS);
    }
    
    let whereClause = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';
    
    const [[{ total }]] = await db.query(`
      SELECT COUNT(DISTINCT o.id) as total FROM TailoringOrder o
      LEFT JOIN Customer c ON o.customerId = c.customerId
      ${whereClause}
    `, params);
    
    const [rows] = await db.query(`
      SELECT o.*,
             c.customerId as 'customer.customerId', c.name as 'customer.name', c.phone as 'customer.phone',
             (SELECT COUNT(*) FROM TailoringOrderItem i WHERE i.orderId = o.id) as itemCount
      FROM TailoringOrder o
      LEFT JOIN Customer c ON o.customerId = c.customerId
      ${whereClause}
      ORDER BY o.createdAt DESC
      LIMIT ? OFFSET ?
    `, [...params, take, skip]);
    
    res.json({ orders: rows.map(formatOrderList), total, page: parseInt(page), limit: take });
  } catch (err) { next(err); }
});

// ── GET /api/tailoring-orders/:id ─────────────────────────────────────────
router.get('/:id', protect, async (req, res, next) => {
  try {
    const order = await getOrderWithItems(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    res.json(order);
  } catch (err) { next(err); }
});

// ── POST /api/tailoring-orders ────────────────────────────────────────────
router.post('/', protect, adminOnly, async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { customerId, customerName, customerPhone, orderDate, deliveryDate, notes, bagNo, bagName } = req.body;
    let resolvedCustomerId = customerId;

    if (!customerId && customerName) {
      const year = new Date().getFullYear();
      const prefix = `TC-${year}-`;
      const [lastRows] = await conn.query(`SELECT customerId FROM Customer WHERE customerId LIKE ? ORDER BY customerId DESC LIMIT 1`, [`${prefix}%`]);
      const last = lastRows[0];
      const num = last ? parseInt(last.customerId.split('-')[2], 10) + 1 : 1;
      resolvedCustomerId = `${prefix}${String(num).padStart(4, '0')}`;
      
      await conn.execute(
        `INSERT INTO Customer (customerId, name, phone, email, address, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [resolvedCustomerId, customerName, customerPhone || '', '', '', '']
      );
    }
    if (!resolvedCustomerId) {
      await conn.rollback();
      return res.status(400).json({ message: 'Customer required.' });
    }

    const id = uuidv4();
    await conn.execute(
      `INSERT INTO TailoringOrder (id, customerId, orderDate, deliveryDate, notes, bagNo, bagName, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Draft', NOW(), NOW())`,
      [id, resolvedCustomerId, orderDate ? new Date(orderDate) : new Date(), deliveryDate ? new Date(deliveryDate) : null, notes || '', bagNo || '', bagName || '']
    );

    await conn.commit();
    const order = await getOrderWithItems(id);
    res.status(201).json(order);
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// ── PUT /api/tailoring-orders/:id ─────────────────────────────────────────
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const { orderDate, deliveryDate, status, notes, bagNo, bagName } = req.body;
    
    let query = `UPDATE TailoringOrder SET status=?, notes=?, bagNo=?, bagName=?, updatedAt=NOW()`;
    let params = [status, notes, bagNo, bagName];
    if (orderDate !== undefined) { query += `, orderDate=?`; params.push(orderDate ? new Date(orderDate) : null); }
    if (deliveryDate !== undefined) { query += `, deliveryDate=?`; params.push(deliveryDate ? new Date(deliveryDate) : null); }
    query += ` WHERE id=?`;
    params.push(req.params.id);
    
    await db.execute(query, params);
    
    const order = await getOrderWithItems(req.params.id);
    res.json(order);
  } catch (err) { next(err); }
});

// ── PATCH /api/tailoring-orders/:id/submit ────────────────────────────────
router.patch('/:id/submit', protect, adminOnly, async (req, res, next) => {
  try {
    await db.execute(`UPDATE TailoringOrder SET status=?, updatedAt=NOW() WHERE id=?`, ['Submitted', req.params.id]);
    const order = await getOrderWithItems(req.params.id);
    res.json(order);
  } catch (err) { next(err); }
});

// ── DELETE /api/tailoring-orders/:id ──────────────────────────────────────
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(`SELECT customerId FROM TailoringOrder WHERE id = ?`, [req.params.id]);
    const order = rows[0];
    if (!order) {
      await conn.rollback();
      return res.status(404).json({ message: 'Order not found.' });
    }

    await conn.execute(`DELETE FROM TailoringOrder WHERE id = ?`, [req.params.id]);

    if (order.customerId) {
      const [[{ tOrders }]] = await conn.query(`SELECT COUNT(*) as tOrders FROM TailoringOrder WHERE customerId = ?`, [order.customerId]);
      const [[{ dOrders }]] = await conn.query(`SELECT COUNT(*) as dOrders FROM DesignOrder WHERE customerId = ?`, [order.customerId]);
      const [[{ payments }]] = await conn.query(`SELECT COUNT(*) as payments FROM Payment WHERE customerId = ?`, [order.customerId]);
      
      if (tOrders === 0 && dOrders === 0 && payments === 0) {
        await conn.execute(`DELETE FROM Customer WHERE customerId = ?`, [order.customerId]);
      }
    }

    await conn.commit();
    res.json({ message: 'Order and orphaned customer deleted.' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// ── POST /api/tailoring-orders/:id/items ──────────────────────────────────
router.post('/:id/items', protect, adminOnly, async (req, res, next) => {
  try {
    const { itemType, quantity = 1, details = {}, subItems } = req.body;
    const [[{ count }]] = await db.query(`SELECT COUNT(*) as count FROM TailoringOrderItem WHERE orderId = ?`, [req.params.id]);
    const id = uuidv4();
    
    const subItemsData = subItems || buildDefaultSubItems(parseInt(quantity), itemType);
    
    await db.execute(
      `INSERT INTO TailoringOrderItem (id, orderId, itemType, quantity, sortOrder, details, subItems, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, req.params.id, itemType, parseInt(quantity), count, JSON.stringify(details || {}), JSON.stringify(subItemsData)]
    );
    
    const [rows] = await db.query(`SELECT * FROM TailoringOrderItem WHERE id = ?`, [id]);
    const item = rows[0];
    item.details = typeof item.details === 'string' ? JSON.parse(item.details) : item.details || {};
    item.subItems = typeof item.subItems === 'string' ? JSON.parse(item.subItems) : item.subItems || [];
    res.status(201).json(item);
  } catch (err) { next(err); }
});

// ── PUT /api/tailoring-orders/:id/items/:itemId ───────────────────────────
router.put('/:id/items/:itemId', protect, adminOnly, async (req, res, next) => {
  try {
    const { quantity, details, subItems, sortOrder } = req.body;
    const [rows] = await db.query(`SELECT * FROM TailoringOrderItem WHERE id = ?`, [req.params.itemId]);
    const existing = rows[0];
    if (!existing) return res.status(404).json({ message: 'Item not found.' });

    const newQty = quantity !== undefined ? parseInt(quantity) : existing.quantity;
    
    let existingSubItemsRaw = existing.subItems;
    if (typeof existingSubItemsRaw === 'string') {
      try { existingSubItemsRaw = JSON.parse(existingSubItemsRaw); } catch (e) { existingSubItemsRaw = []; }
    }
    let updatedSubItems = subItems !== undefined ? subItems : existingSubItemsRaw;

    if (quantity !== undefined && newQty !== existing.quantity) {
      const currentSubs = Array.isArray(updatedSubItems) ? updatedSubItems : [];
      if (newQty > currentSubs.length) {
        const extra = buildDefaultSubItems(newQty - currentSubs.length, existing.itemType)
          .map((s, i) => ({ ...s, number: currentSubs.length + i + 1 }));
        updatedSubItems = [...currentSubs, ...extra];
      } else {
        updatedSubItems = currentSubs.slice(0, newQty);
      }
    }

    let query = `UPDATE TailoringOrderItem SET quantity=?, sortOrder=?, details=?, subItems=?, updatedAt=NOW() WHERE id=?`;
    let params = [
      newQty, 
      sortOrder !== undefined ? parseInt(sortOrder) : existing.sortOrder,
      details ? JSON.stringify(details) : existing.details,
      JSON.stringify(updatedSubItems),
      req.params.itemId
    ];
    
    await db.execute(query, params);
    
    const [newRows] = await db.query(`SELECT * FROM TailoringOrderItem WHERE id = ?`, [req.params.itemId]);
    const updated = newRows[0];
    updated.details = typeof updated.details === 'string' ? JSON.parse(updated.details) : updated.details || {};
    updated.subItems = typeof updated.subItems === 'string' ? JSON.parse(updated.subItems) : updated.subItems || [];
    res.json(updated);
  } catch (err) { next(err); }
});

// ── DELETE /api/tailoring-orders/:id/items/:itemId ────────────────────────
router.delete('/:id/items/:itemId', protect, adminOnly, async (req, res, next) => {
  try {
    await db.execute(`DELETE FROM TailoringOrderItem WHERE id = ?`, [req.params.itemId]);
    res.json({ message: 'Item deleted.' });
  } catch (err) { next(err); }
});

// ── POST /:id/items/:itemId/upload ────────────────────────────────────────
router.post('/:id/items/:itemId/upload', protect, adminOnly, upload.single('image'), async (req, res, next) => {
  try {
    const { subItemNumber, field } = req.body;
    const allowedFields = ['referenceImageUrl', 'frontDesignImageUrl', 'backDesignImageUrl', 'sleeveDesignImageUrl', 'sampleBlouseImageUrl'];
    if (!allowedFields.includes(field)) return res.status(400).json({ message: 'Invalid field.' });

    const [rows] = await db.query(`SELECT details, subItems FROM TailoringOrderItem WHERE id = ?`, [req.params.itemId]);
    const item = rows[0];
    if (!item) return res.status(404).json({ message: 'Item not found.' });

    const imageUrl = `/uploads/tailoring/${req.file.filename}`;

    if (!subItemNumber || subItemNumber === 'null' || subItemNumber === 'undefined') {
      let detailsRaw = item.details;
      if (typeof detailsRaw === 'string') {
        try { detailsRaw = JSON.parse(detailsRaw); } catch (e) { detailsRaw = {}; }
      }
      const details = detailsRaw || {};
      details[field] = imageUrl;

      await db.execute(`UPDATE TailoringOrderItem SET details=?, updatedAt=NOW() WHERE id=?`, [JSON.stringify(details), req.params.itemId]);
      return res.json({ message: 'Image uploaded' });
    }

    const subNum = parseInt(subItemNumber);
    let subsRaw = item.subItems;
    if (typeof subsRaw === 'string') {
      try { subsRaw = JSON.parse(subsRaw); } catch (e) { subsRaw = []; }
    }
    const subs = Array.isArray(subsRaw) ? [...subsRaw] : [];
    
    let idx = subs.findIndex(s => Number(s.number) === subNum);
    if (idx === -1) idx = subNum - 1; 
    if (idx < 0 || idx >= subs.length) return res.status(404).json({ message: 'Sub-item not found.' });
    subs[idx] = { ...subs[idx], [field]: imageUrl };

    await db.execute(`UPDATE TailoringOrderItem SET subItems=?, updatedAt=NOW() WHERE id=?`, [JSON.stringify(subs), req.params.itemId]);
    res.json({ message: 'Image uploaded' });
  } catch (err) { next(err); }
});

// ── POST /:id/items/:itemId/canvas ────────────────────────────────────────
router.post('/:id/items/:itemId/canvas', protect, adminOnly, upload.single('canvas'), async (req, res, next) => {
  try {
    const { subItemNumber, section, canvasJSON } = req.body;
    if (!['front', 'back', 'sleeve'].includes(section)) {
      return res.status(400).json({ message: 'section must be front|back|sleeve' });
    }
    const [rows] = await db.query(`SELECT subItems FROM TailoringOrderItem WHERE id = ?`, [req.params.itemId]);
    const item = rows[0];
    if (!item) return res.status(404).json({ message: 'Item not found.' });

    const imageUrl = req.file ? `/uploads/tailoring/${req.file.filename}` : null;
    const subNum = parseInt(subItemNumber);
    let subsRaw = item.subItems;
    if (typeof subsRaw === 'string') {
      try { subsRaw = JSON.parse(subsRaw); } catch (e) { subsRaw = []; }
    }
    const subs = Array.isArray(subsRaw) ? [...subsRaw] : [];

    let idx = subs.findIndex(s => Number(s.number) === subNum);
    if (idx === -1) idx = subNum - 1; 
    if (idx < 0 || idx >= subs.length) return res.status(404).json({ message: 'Sub-item not found.' });

    subs[idx] = {
      ...subs[idx],
      [`${section}CanvasJSON`]: canvasJSON || null,
      ...(imageUrl ? { [`${section}CanvasImageUrl`]: imageUrl } : {}),
    };

    await db.execute(`UPDATE TailoringOrderItem SET subItems=?, updatedAt=NOW() WHERE id=?`, [JSON.stringify(subs), req.params.itemId]);
    res.json({ imageUrl, subItems: subs });
  } catch (err) { next(err); }
});

module.exports = router;
