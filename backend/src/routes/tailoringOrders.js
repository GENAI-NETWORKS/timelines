const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const prisma = require('../utils/prisma');
const { protect, adminOnly } = require('../middleware/auth');

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
  const last = await prisma.customer.findFirst({
    where: { customerId: { startsWith: prefix } },
    orderBy: { customerId: 'desc' },
  });
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
    // Arya Work specific
    aryaWorkNotes: '',
    aryaWorkPrice: '',
    frontDesignImageUrl: null,
    backDesignImageUrl: null,
    sleeveDesignImageUrl: null,
    // Lining / source specific
    source: 'SHOP',
    description: '',
    // Saree specific
    numberOfSarees: '',
    numberOfFalls: '',
    fallsSource: 'SHOP',
  }));
}

// ── GET /api/tailoring-orders ──────────────────────────────────────────────
router.get('/', protect, async (req, res, next) => {
  try {
    const { search = '', status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    const where = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { customer: { name: { contains: search } } },
        { customer: { phone: { contains: search } } },
      ];
    }
    const [orders, total] = await Promise.all([
      prisma.tailoringOrder.findMany({
        where,
        include: { 
          customer: { select: { customerId: true, name: true, phone: true } },
          _count: { select: { items: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip, take,
      }),
      prisma.tailoringOrder.count({ where }),
    ]);
    res.json({ orders, total, page: parseInt(page), limit: take });
  } catch (err) { next(err); }
});

// ── GET /api/tailoring-orders/:id ─────────────────────────────────────────
router.get('/:id', protect, async (req, res, next) => {
  try {
    const order = await prisma.tailoringOrder.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    res.json(order);
  } catch (err) { next(err); }
});

// ── POST /api/tailoring-orders ────────────────────────────────────────────
// Create order. Body: { customerName, customerPhone, orderDate, deliveryDate, notes }
// OR { customerId } to link existing customer
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { customerId, customerName, customerPhone, orderDate, deliveryDate, notes } = req.body;
    let resolvedCustomerId = customerId;

    if (!customerId && customerName) {
      // Create new customer
      const newId = await generateCustomerId();
      const cust = await prisma.customer.create({
        data: { customerId: newId, name: customerName, phone: customerPhone || '', email: '', address: '' },
      });
      resolvedCustomerId = cust.customerId;
    }
    if (!resolvedCustomerId) return res.status(400).json({ message: 'Customer required.' });

    const order = await prisma.tailoringOrder.create({
      data: {
        customerId: resolvedCustomerId,
        orderDate: orderDate ? new Date(orderDate) : new Date(),
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        notes: notes || '',
      },
      include: { customer: true, items: true },
    });
    res.status(201).json(order);
  } catch (err) { next(err); }
});

// ── PUT /api/tailoring-orders/:id ─────────────────────────────────────────
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const { orderDate, deliveryDate, status, notes } = req.body;
    const order = await prisma.tailoringOrder.update({
      where: { id: req.params.id },
      data: {
        orderDate: orderDate ? new Date(orderDate) : undefined,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        status, notes,
      },
      include: { customer: true, items: { orderBy: { sortOrder: 'asc' } } },
    });
    res.json(order);
  } catch (err) { next(err); }
});

// ── PATCH /api/tailoring-orders/:id/submit ────────────────────────────────
router.patch('/:id/submit', protect, adminOnly, async (req, res, next) => {
  try {
    const order = await prisma.tailoringOrder.update({
      where: { id: req.params.id },
      data: { status: 'Submitted' },
      include: { customer: true, items: { orderBy: { sortOrder: 'asc' } } },
    });
    res.json(order);
  } catch (err) { next(err); }
});

// ── DELETE /api/tailoring-orders/:id ──────────────────────────────────────
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const order = await prisma.tailoringOrder.findUnique({
      where: { id: req.params.id },
      select: { customerId: true }
    });
    
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    await prisma.tailoringOrder.delete({ where: { id: req.params.id } });

    // Check if the customer has any other records
    if (order.customerId) {
      const [tOrders, dOrders, payments] = await Promise.all([
        prisma.tailoringOrder.count({ where: { customerId: order.customerId } }),
        prisma.designOrder.count({ where: { customerId: order.customerId } }),
        prisma.payment.count({ where: { customerId: order.customerId } })
      ]);
      
      if (tOrders === 0 && dOrders === 0 && payments === 0) {
        await prisma.customer.delete({ where: { customerId: order.customerId } });
      }
    }

    res.json({ message: 'Order and orphaned customer deleted.' });
  } catch (err) { next(err); }
});

// ── POST /api/tailoring-orders/:id/items ──────────────────────────────────
router.post('/:id/items', protect, adminOnly, async (req, res, next) => {
  try {
    const { itemType, quantity = 1, details = {}, subItems } = req.body;
    const count = await prisma.tailoringOrderItem.count({ where: { orderId: req.params.id } });
    const item = await prisma.tailoringOrderItem.create({
      data: {
        orderId: req.params.id,
        itemType,
        quantity: parseInt(quantity),
        sortOrder: count,
        details: JSON.stringify(details || {}),
        subItems: JSON.stringify(subItems || buildDefaultSubItems(parseInt(quantity), itemType)),
      },
    });
    res.status(201).json(item);
  } catch (err) { next(err); }
});

// ── PUT /api/tailoring-orders/:id/items/:itemId ───────────────────────────
router.put('/:id/items/:itemId', protect, adminOnly, async (req, res, next) => {
  try {
    const { quantity, details, subItems, sortOrder } = req.body;
    const existing = await prisma.tailoringOrderItem.findUnique({ where: { id: req.params.itemId } });
    if (!existing) return res.status(404).json({ message: 'Item not found.' });

    const newQty = quantity !== undefined ? parseInt(quantity) : existing.quantity;
    let updatedSubItems = subItems !== undefined ? subItems : existing.subItems;

    // Grow/shrink sub-items array if quantity changed
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

    const updated = await prisma.tailoringOrderItem.update({
      where: { id: req.params.itemId },
      data: {
        quantity: quantity !== undefined ? parseInt(quantity) : undefined,
        sortOrder: sortOrder !== undefined ? parseInt(sortOrder) : undefined,
        ...(details ? { details: JSON.stringify(details) } : {}),
        ...(subItems ? { subItems: JSON.stringify(subItems) } : {}),
      },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// ── DELETE /api/tailoring-orders/:id/items/:itemId ────────────────────────
router.delete('/:id/items/:itemId', protect, adminOnly, async (req, res, next) => {
  try {
    await prisma.tailoringOrderItem.delete({ where: { id: req.params.itemId } });
    res.json({ message: 'Item deleted.' });
  } catch (err) { next(err); }
});

// ── POST /:id/items/:itemId/upload ────────────────────────────────────────
// Upload a reference/design image for a specific sub-item + field.
// Body (multipart): subItemNumber (1-based), field (referenceImageUrl | frontDesignImageUrl | backDesignImageUrl | sleeveDesignImageUrl)
router.post('/:id/items/:itemId/upload', protect, adminOnly, upload.single('image'), async (req, res, next) => {
  try {
    const { subItemNumber, field } = req.body;
    const allowedFields = ['referenceImageUrl', 'frontDesignImageUrl', 'backDesignImageUrl', 'sleeveDesignImageUrl'];
    if (!allowedFields.includes(field)) return res.status(400).json({ message: 'Invalid field.' });

    const item = await prisma.tailoringOrderItem.findUnique({ where: { id: req.params.itemId } });
    if (!item) return res.status(404).json({ message: 'Item not found.' });

    const imageUrl = `/uploads/tailoring/${req.file.filename}`;
    const subNum = parseInt(subItemNumber);
    const subs = Array.isArray(item.subItems) ? [...item.subItems] : [];
    const idx = subs.findIndex(s => s.number === subNum);
    if (idx === -1) return res.status(404).json({ message: 'Sub-item not found.' });
    subs[idx] = { ...subs[idx], [field]: imageUrl };

    const updated = await prisma.tailoringOrderItem.update({
      where: { id: req.params.itemId },
      data: { subItems: subs },
    });
    res.json({ imageUrl, subItems: updated.subItems });
  } catch (err) { next(err); }
});

// ── POST /:id/items/:itemId/canvas ────────────────────────────────────────
// Save canvas PNG + JSON for a specific sub-item + section (front|back|sleeve)
// Body (multipart): subItemNumber, section (front|back|sleeve)
router.post('/:id/items/:itemId/canvas', protect, adminOnly, upload.single('canvas'), async (req, res, next) => {
  try {
    const { subItemNumber, section, canvasJSON } = req.body;
    if (!['front', 'back', 'sleeve'].includes(section)) {
      return res.status(400).json({ message: 'section must be front|back|sleeve' });
    }
    const item = await prisma.tailoringOrderItem.findUnique({ where: { id: req.params.itemId } });
    if (!item) return res.status(404).json({ message: 'Item not found.' });

    const imageUrl = req.file ? `/uploads/tailoring/${req.file.filename}` : null;
    const subNum = parseInt(subItemNumber);
    const subs = Array.isArray(item.subItems) ? [...item.subItems] : [];
    const idx = subs.findIndex(s => s.number === subNum);
    if (idx === -1) return res.status(404).json({ message: 'Sub-item not found.' });

    subs[idx] = {
      ...subs[idx],
      [`${section}CanvasJSON`]: canvasJSON || null,
      ...(imageUrl ? { [`${section}CanvasImageUrl`]: imageUrl } : {}),
    };

    const updated = await prisma.tailoringOrderItem.update({
      where: { id: req.params.itemId },
      data: { subItems: subs },
    });
    res.json({ imageUrl, subItems: updated.subItems });
  } catch (err) { next(err); }
});

module.exports = router;
