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

const fullOrderInclude = {
  customer: true,
  tailor: { select: { employeeId: true, name: true, role: true } },
  particulars: { orderBy: { sortOrder: 'asc' } },
  designSections: true,
};

// ─── Helper: upsert particulars ───────────────────────────────────────────
async function syncParticulars(tx, orderId, particulars = []) {
  await tx.orderParticular.deleteMany({ where: { orderId } });
  if (particulars.length > 0) {
    await tx.orderParticular.createMany({
      data: particulars.map((p, i) => ({
        orderId,
        itemName: p.itemName || '',
        qty: p.qty || '',
        notes: p.notes || '',
        sortOrder: i,
      })),
    });
  }
}

// ─── Helper: upsert design sections ──────────────────────────────────────
async function syncDesignSections(tx, orderId, designSections = []) {
  for (const s of designSections) {
    await tx.orderDesignSection.upsert({
      where: { orderId_sectionType: { orderId, sectionType: s.sectionType } },
      create: {
        orderId,
        sectionType: s.sectionType,
        notes: s.notes || '',
        sketchImageUrl: s.sketchImageUrl || null,
        sketchJSON: s.sketchJSON || null,
      },
      update: {
        notes: s.notes || '',
        sketchImageUrl: s.sketchImageUrl !== undefined ? s.sketchImageUrl : undefined,
        sketchJSON: s.sketchJSON !== undefined ? s.sketchJSON : undefined,
      },
    });
  }
}

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
        { customer: { name: { contains: search } } },
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

// GET /api/design-orders/:id — basic (lightweight)
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

// GET /api/design-orders/:id/full — full order with all nested data
router.get('/:id/full', protect, async (req, res, next) => {
  try {
    const order = await prisma.designOrder.findUnique({
      where: { orderId: req.params.id },
      include: fullOrderInclude,
    });
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    res.json(order);
  } catch (err) { next(err); }
});

// POST /api/design-orders — create order + nested data in one transaction
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const {
      customerId, garmentType, measurements = {}, fabricNotes = '',
      specialInstructions = '', assignedTailorId, deliveryDate, orderDate,
      // New unified fields
      bagRef, isSample = false, baseDescription = '',
      threadColors = '', buttonsNeeded = '', customerConfirmedAt,
      // Nested
      particulars = [], designSections = [],
      // Optional inline new customer
      newCustomer,
    } = req.body;

    let resolvedCustomerId = customerId;

    // If a new customer is being created inline, do it first
    if (!customerId && newCustomer && newCustomer.name) {
      const year = new Date().getFullYear();
      const prefix = `TC-${year}-`;
      const last = await prisma.customer.findFirst({
        where: { customerId: { startsWith: prefix } },
        orderBy: { customerId: 'desc' },
      });
      const num = last ? parseInt(last.customerId.split('-')[2], 10) + 1 : 1;
      const newCustId = `${prefix}${String(num).padStart(4, '0')}`;
      const created = await prisma.customer.create({
        data: {
          customerId: newCustId,
          name: newCustomer.name,
          phone: newCustomer.phone || '',
          email: newCustomer.email || '',
          address: newCustomer.address || '',
          notes: newCustomer.notes || '',
        },
      });
      await logCreate('Customer', created.customerId, req.user, created);
      resolvedCustomerId = newCustId;
    }

    if (!resolvedCustomerId) return res.status(400).json({ message: 'Customer required.' });

    const orderId = await generateOrderId();

    const order = await prisma.$transaction(async (tx) => {
      const o = await tx.designOrder.create({
        data: {
          orderId, customerId: resolvedCustomerId, garmentType,
          measurements: measurements || {},
          fabricNotes, specialInstructions,
          assignedTailorId: assignedTailorId || null,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          orderDate: orderDate ? new Date(orderDate) : new Date(),
          createdById: req.user.id,
          bagRef: bagRef || null,
          isSample: Boolean(isSample),
          baseDescription: baseDescription || '',
          threadColors: threadColors || '',
          buttonsNeeded: buttonsNeeded || '',
          customerConfirmedAt: customerConfirmedAt ? new Date(customerConfirmedAt) : null,
        },
        include: fullOrderInclude,
      });
      await syncParticulars(tx, orderId, particulars);
      await syncDesignSections(tx, orderId, designSections);
      return tx.designOrder.findUnique({ where: { orderId }, include: fullOrderInclude });
    });

    await logCreate('DesignOrder', order.orderId, req.user, order);
    res.status(201).json(order);
  } catch (err) { next(err); }
});

// PUT /api/design-orders/:id — update order + nested data in one transaction
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const old = await prisma.designOrder.findUnique({ where: { orderId: req.params.id } });
    if (!old) return res.status(404).json({ message: 'Order not found.' });

    const {
      customerId, garmentType, measurements, fabricNotes, specialInstructions,
      assignedTailorId, status, deliveryDate, orderDate,
      bagRef, isSample, baseDescription, threadColors, buttonsNeeded, customerConfirmedAt,
      particulars, designSections,
    } = req.body;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.designOrder.update({
        where: { orderId: req.params.id },
        data: {
          customerId, garmentType,
          measurements: measurements || old.measurements,
          fabricNotes, specialInstructions,
          assignedTailorId: assignedTailorId || null,
          status,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          orderDate: orderDate ? new Date(orderDate) : undefined,
          bagRef: bagRef !== undefined ? bagRef : old.bagRef,
          isSample: isSample !== undefined ? Boolean(isSample) : old.isSample,
          baseDescription: baseDescription !== undefined ? baseDescription : old.baseDescription,
          threadColors: threadColors !== undefined ? threadColors : old.threadColors,
          buttonsNeeded: buttonsNeeded !== undefined ? buttonsNeeded : old.buttonsNeeded,
          customerConfirmedAt: customerConfirmedAt !== undefined
            ? (customerConfirmedAt ? new Date(customerConfirmedAt) : null)
            : old.customerConfirmedAt,
        },
      });
      if (particulars !== undefined) await syncParticulars(tx, req.params.id, particulars);
      if (designSections !== undefined) await syncDesignSections(tx, req.params.id, designSections);
      return tx.designOrder.findUnique({ where: { orderId: req.params.id }, include: fullOrderInclude });
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

// POST upload main sketch image (legacy/freeform canvas)
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

// PATCH save main sketch JSON only
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

// POST upload per-section sketch: /api/design-orders/:id/section-sketch
// Body: sectionType (back_neck|sleeve|front_neck), file: sketch
router.post('/:id/section-sketch', protect, adminOnly, upload.single('sketch'), async (req, res, next) => {
  try {
    const { sectionType, sketchJSON } = req.body;
    if (!['back_neck', 'sleeve', 'front_neck'].includes(sectionType)) {
      return res.status(400).json({ message: 'Invalid sectionType.' });
    }
    const order = await prisma.designOrder.findUnique({ where: { orderId: req.params.id } });
    if (!order) return res.status(404).json({ message: 'Order not found.' });

    const sketchUrl = req.file ? `/uploads/sketches/${req.file.filename}` : null;

    const section = await prisma.orderDesignSection.upsert({
      where: { orderId_sectionType: { orderId: req.params.id, sectionType } },
      create: {
        orderId: req.params.id,
        sectionType,
        sketchImageUrl: sketchUrl,
        sketchJSON: sketchJSON || null,
      },
      update: {
        ...(sketchUrl ? { sketchImageUrl: sketchUrl } : {}),
        ...(sketchJSON !== undefined ? { sketchJSON } : {}),
      },
    });
    res.json({ sectionType, sketchImageUrl: section.sketchImageUrl });
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
