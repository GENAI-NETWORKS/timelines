const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { protect, adminOnly } = require('../middleware/auth');
const { logCreate, logUpdate, logDelete } = require('../utils/auditLogger');

// ─── Auto-generate Customer ID: TC-YYYY-XXXX ─────────────────────────────
async function generateCustomerId() {
  const year = new Date().getFullYear();
  const prefix = `TC-${year}-`;
  const last = await prisma.customer.findFirst({
    where: { customerId: { startsWith: prefix } },
    orderBy: { customerId: 'desc' },
  });
  if (!last) return `${prefix}0001`;
  const num = parseInt(last.customerId.split('-')[2], 10) + 1;
  return `${prefix}${String(num).padStart(4, '0')}`;
}

// GET /api/customers/search?q=  — typeahead (must be before /:id)
router.get('/search', protect, async (req, res, next) => {
  try {
    const { q = '' } = req.query;
    const where = q
      ? {
          OR: [
            { name: { contains: q } },
            { phone: { contains: q } },
            { customerId: { contains: q } },
          ],
        }
      : {};
    const customers = await prisma.customer.findMany({
      where,
      select: { customerId: true, name: true, phone: true, address: true, email: true },
      orderBy: { name: 'asc' },
      take: 15,
    });
    res.json(customers);
  } catch (err) { next(err); }
});

// GET /api/customers
router.get('/', protect, async (req, res, next) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    const where = search
      ? {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
            { customerId: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {};
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.customer.count({ where }),
    ]);
    res.json({ customers, total, page: parseInt(page), limit: take });
  } catch (err) { next(err); }
});

// GET /api/customers/:id
router.get('/:id', protect, async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({ where: { customerId: req.params.id } });
    if (!customer) return res.status(404).json({ message: 'Customer not found.' });
    res.json(customer);
  } catch (err) { next(err); }
});

// POST /api/customers
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { name, phone, address = '', email = '', notes = '' } = req.body;
    const customerId = await generateCustomerId();
    const customer = await prisma.customer.create({
      data: { customerId, name, phone, address, email, notes },
    });
    await logCreate('Customer', customer.customerId, req.user, customer);
    res.status(201).json(customer);
  } catch (err) { next(err); }
});

// PUT /api/customers/:id
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const old = await prisma.customer.findUnique({ where: { customerId: req.params.id } });
    if (!old) return res.status(404).json({ message: 'Customer not found.' });
    const { name, phone, address, email, notes } = req.body;
    const updated = await prisma.customer.update({
      where: { customerId: req.params.id },
      data: { name, phone, address, email, notes },
    });
    await logUpdate('Customer', updated.customerId, req.user, old, updated);
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/customers/:id
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({ where: { customerId: req.params.id } });
    if (!customer) return res.status(404).json({ message: 'Customer not found.' });
    await logDelete('Customer', customer.customerId, req.user, customer);
    await prisma.customer.delete({ where: { customerId: req.params.id } });
    res.json({ message: 'Customer deleted.' });
  } catch (err) { next(err); }
});

// GET /api/customers/:id/audit
router.get('/:id/audit', protect, adminOnly, async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { recordType: 'Customer', recordId: req.params.id },
      orderBy: { timestamp: 'desc' },
      take: 50,
      include: { changedBy: { select: { name: true, role: true } } },
    });
    res.json(logs);
  } catch (err) { next(err); }
});

module.exports = router;
