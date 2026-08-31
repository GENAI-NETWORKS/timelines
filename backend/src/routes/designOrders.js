const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const prisma = require('../utils/prisma');
const { protect, adminOnly } = require('../middleware/auth');
const { logCreate, logUpdate, logDelete } = require('../utils/auditLogger');

// ─── Multer setup ─────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/sketches');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `sketch-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Auto-generate Order ID: ORD-XXXX ────────────────────────────────────
async function generateOrderId() {
  const last = await prisma.designOrder.findFirst({ orderBy: { orderId: 'desc' } });
  if (!last) return 'ORD-0001';
  const num = parseInt(last.orderId.split('-')[1], 10) + 1;
  return `ORD-${String(num).padStart(4, '0')}`;
}

// ─── Helper to shape order response ──────────────────────────────────────
const orderInclude = {
  customer: { select: { customerId: true, name: true, phone: true, address: true, email: true } },
  tailor: { select: { employeeId: true, name: true, role: true } },
};

// GET /api/design-orders
router.get('/', protect, async (req, res, next) => {
  try {
    const { search = '', status, customerId, tailorId, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    const where = {};

    // Staff only sees their own assigned orders
    if (req.user.role === 'staff' && req.user.employeeRef) {
      where.assignedTailorId = req.user.employeeRef;
    }
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (tailorId) where.assignedTailorId = tailorId;
    if (search) {
      where.OR = [
        { orderId: { contains: search } },
        { garmentType: { contains: search } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.designOrder.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.designOrder.count({ where }),
    ]);
    res.json({ orders, total, page: parseInt(page), limit: take });
  } catch (err) { next(err); }
});

// GET /api/design-orders/:id
router.get('/:id', protect, async (req, res, next) => {
  try {
    const order = await prisma.designOrder.findUnique({
      where: { orderId: req.params.id },
      include: orderInclude,
    });
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    res.json(order);
  } catch (err) { next(err); }
});

// POST /api/design-orders
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const {
      customerId, garmentType, measurements = {}, fabricNotes = '',
      specialInstructions = '', assignedTailorId, deliveryDate, orderDate,
    } = req.body;
    const orderId = await generateOrderId();
    const order = await prisma.designOrder.create({
      data: {
        orderId, customerId, garmentType,
        measurements: measurements || {},
        fabricNotes, specialInstructions,
        assignedTailorId: assignedTailorId || null,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        orderDate: orderDate ? new Date(orderDate) : new Date(),
        createdById: req.user.id,
      },
      include: orderInclude,
    });
    await logCreate('DesignOrder', order.orderId, req.user, order);
    res.status(201).json(order);
  } catch (err) { next(err); }
});

// PUT /api/design-orders/:id
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const old = await prisma.designOrder.findUnique({ where: { orderId: req.params.id } });
    if (!old) return res.status(404).json({ message: 'Order not found.' });
    const {
      customerId, garmentType, measurements, fabricNotes, specialInstructions,
      assignedTailorId, status, deliveryDate, orderDate,
    } = req.body;
    const updated = await prisma.designOrder.update({
      where: { orderId: req.params.id },
      data: {
        customerId, garmentType,
        measurements: measurements || old.measurements,
        fabricNotes, specialInstructions,
        assignedTailorId: assignedTailorId || null,
        status,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        orderDate: orderDate ? new Date(orderDate) : undefined,
      },
      include: orderInclude,
    });
    await logUpdate('DesignOrder', updated.orderId, req.user, old, updated);
    res.json(updated);
  } catch (err) { next(err); }
});

// PATCH assign tailor
router.patch('/:id/assign', protect, adminOnly, async (req, res, next) => {
  try {
    const { tailorId } = req.body;
    const old = await prisma.designOrder.findUnique({ where: { orderId: req.params.id } });
    if (!old) return res.status(404).json({ message: 'Order not found.' });
    const updated = await prisma.designOrder.update({
      where: { orderId: req.params.id },
      data: { assignedTailorId: tailorId || null },
      include: orderInclude,
    });
    await logUpdate('DesignOrder', updated.orderId, req.user, old, updated);
    res.json(updated);
  } catch (err) { next(err); }
});

// PATCH update status
router.patch('/:id/status', protect, async (req, res, next) => {
  try {
    const { status } = req.body;
    const old = await prisma.designOrder.findUnique({ where: { orderId: req.params.id } });
    if (!old) return res.status(404).json({ message: 'Order not found.' });
    const updated = await prisma.designOrder.update({
      where: { orderId: req.params.id },
      data: { status },
    });
    await logUpdate('DesignOrder', updated.orderId, req.user, old, updated);
    res.json(updated);
  } catch (err) { next(err); }
});

// POST upload sketch image
router.post('/:id/sketch', protect, adminOnly, upload.single('sketch'), async (req, res, next) => {
  try {
    const order = await prisma.designOrder.findUnique({ where: { orderId: req.params.id } });
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    const sketchUrl = `/uploads/sketches/${req.file.filename}`;
    const sketchJSON = req.body.sketchJSON || null;
    const updated = await prisma.designOrder.update({
      where: { orderId: req.params.id },
      data: { designSketchUrl: sketchUrl, designSketchJSON: sketchJSON },
    });
    res.json({ designSketchUrl: updated.designSketchUrl });
  } catch (err) { next(err); }
});

// PATCH save sketch JSON only
router.patch('/:id/sketch-json', protect, adminOnly, async (req, res, next) => {
  try {
    const { sketchJSON, designSketchUrl } = req.body;
    const updated = await prisma.designOrder.update({
      where: { orderId: req.params.id },
      data: {
        designSketchJSON: sketchJSON,
        ...(designSketchUrl ? { designSketchUrl } : {}),
      },
    });
    res.json({ message: 'Sketch saved.', designSketchUrl: updated.designSketchUrl });
  } catch (err) { next(err); }
});

// DELETE /api/design-orders/:id
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const order = await prisma.designOrder.findUnique({ where: { orderId: req.params.id } });
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    await logDelete('DesignOrder', order.orderId, req.user, order);
    await prisma.designOrder.delete({ where: { orderId: req.params.id } });
    res.json({ message: 'Order deleted.' });
  } catch (err) { next(err); }
});

// GET audit log for order
router.get('/:id/audit', protect, adminOnly, async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { recordType: 'DesignOrder', recordId: req.params.id },
      orderBy: { timestamp: 'desc' },
      take: 50,
      include: { changedBy: { select: { name: true, role: true } } },
    });
    res.json(logs);
  } catch (err) { next(err); }
});

module.exports = router;
