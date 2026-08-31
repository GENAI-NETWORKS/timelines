const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { protect, adminOnly } = require('../middleware/auth');
const { logCreate, logUpdate, logDelete } = require('../utils/auditLogger');

// GET /api/payments
router.get('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { customerId } = req.query;
    const where = {};
    if (customerId) where.customerId = customerId;
    
    const payments = await prisma.payment.findMany({
      where,
      include: {
        customer: { select: { customerId: true, name: true } },
        order: { select: { orderId: true, garmentType: true } }
      },
      orderBy: { paymentDate: 'desc' }
    });
    res.json(payments);
  } catch (err) { next(err); }
});

// POST /api/payments
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { customerId, orderId, amount, paymentDate, paymentMethod, status, notes } = req.body;
    const payment = await prisma.payment.create({
      data: {
        customerId,
        orderId: orderId || null,
        amount: parseFloat(amount),
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        paymentMethod: paymentMethod || 'Cash',
        status: status || 'Completed',
        notes: notes || ''
      },
      include: {
        customer: { select: { customerId: true, name: true } },
        order: { select: { orderId: true, garmentType: true } }
      }
    });
    res.status(201).json(payment);
  } catch (err) { next(err); }
});

// PUT /api/payments/:id
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const { customerId, orderId, amount, paymentDate, paymentMethod, status, notes } = req.body;
    const old = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!old) return res.status(404).json({ message: 'Payment not found' });
    
    const updated = await prisma.payment.update({
      where: { id: req.params.id },
      data: {
        customerId,
        orderId: orderId || null,
        amount: parseFloat(amount),
        paymentDate: paymentDate ? new Date(paymentDate) : undefined,
        paymentMethod,
        status,
        notes
      },
      include: {
        customer: { select: { customerId: true, name: true } },
        order: { select: { orderId: true, garmentType: true } }
      }
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/payments/:id
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const old = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!old) return res.status(404).json({ message: 'Payment not found' });
    
    await prisma.payment.delete({ where: { id: req.params.id } });
    res.json({ message: 'Payment deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
