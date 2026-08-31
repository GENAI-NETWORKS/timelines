const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { protect, adminOnly } = require('../middleware/auth');
const { logCreate, logUpdate, logDelete } = require('../utils/auditLogger');

// ─── Helper: calculate net ────────────────────────────────────────────────
function calcNet(data) {
  return (
    Number(data.baseSalary || 0) +
    Number(data.bonus || 0) -
    Number(data.advances || 0) -
    Number(data.deductions || 0)
  );
}

// GET all salaries
router.get('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { employeeId, month, year, paidStatus, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    const where = {};
    if (employeeId) where.employeeId = employeeId;
    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);
    if (paidStatus) where.paidStatus = paidStatus;

    const [records, total] = await Promise.all([
      prisma.salary.findMany({
        where,
        include: { employee: { select: { name: true, employeeId: true, role: true } } },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        skip,
        take,
      }),
      prisma.salary.count({ where }),
    ]);
    res.json({ records, total, page: parseInt(page), limit: take });
  } catch (err) { next(err); }
});

// GET salaries by employee
router.get('/employee/:employeeId', protect, async (req, res, next) => {
  try {
    const { year } = req.query;
    const where = { employeeId: req.params.employeeId };
    if (year) where.year = parseInt(year);
    const records = await prisma.salary.findMany({
      where,
      include: { employee: { select: { name: true, employeeId: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    res.json(records);
  } catch (err) { next(err); }
});

// GET single salary record
router.get('/:id', protect, async (req, res, next) => {
  try {
    const record = await prisma.salary.findUnique({
      where: { id: req.params.id },
      include: { employee: { select: { name: true, employeeId: true, role: true } } },
    });
    if (!record) return res.status(404).json({ message: 'Record not found.' });
    res.json(record);
  } catch (err) { next(err); }
});

// POST create salary record
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { employeeId, month, year, baseSalary = 0, advances = 0, deductions = 0, bonus = 0, paidStatus = 'unpaid', notes = '' } = req.body;
    const netPaid = calcNet({ baseSalary, advances, deductions, bonus });
    const record = await prisma.salary.create({
      data: {
        employeeId, month: parseInt(month), year: parseInt(year),
        baseSalary: Number(baseSalary), advances: Number(advances),
        deductions: Number(deductions), bonus: Number(bonus),
        netPaid, paidStatus, notes, paymentHistory: [],
      },
      include: { employee: { select: { name: true, employeeId: true, role: true } } },
    });
    await logCreate('Salary', record.id, req.user, record);
    res.status(201).json(record);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ message: 'Salary record already exists for this employee and month/year.' });
    next(err);
  }
});

// PUT update salary record
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const old = await prisma.salary.findUnique({ where: { id: req.params.id } });
    if (!old) return res.status(404).json({ message: 'Record not found.' });
    const { baseSalary, advances, deductions, bonus, paidStatus, notes } = req.body;
    const netPaid = calcNet({ baseSalary, advances, deductions, bonus });
    const updated = await prisma.salary.update({
      where: { id: req.params.id },
      data: {
        baseSalary: Number(baseSalary), advances: Number(advances),
        deductions: Number(deductions), bonus: Number(bonus),
        netPaid, paidStatus, notes,
      },
      include: { employee: { select: { name: true, employeeId: true, role: true } } },
    });
    await logUpdate('Salary', updated.id, req.user, old, updated);
    res.json(updated);
  } catch (err) { next(err); }
});

// PATCH mark as paid
router.patch('/:id/mark-paid', protect, adminOnly, async (req, res, next) => {
  try {
    const { amount = 0, note = 'Marked paid' } = req.body;
    const record = await prisma.salary.findUnique({ where: { id: req.params.id } });
    if (!record) return res.status(404).json({ message: 'Record not found.' });
    const history = Array.isArray(record.paymentHistory) ? record.paymentHistory : [];
    history.push({ amount: Number(amount), note, paidAt: new Date().toISOString() });
    const updated = await prisma.salary.update({
      where: { id: req.params.id },
      data: { paidStatus: 'paid', paymentHistory: history },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE salary record
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const record = await prisma.salary.findUnique({ where: { id: req.params.id } });
    if (!record) return res.status(404).json({ message: 'Record not found.' });
    await logDelete('Salary', record.id, req.user, record);
    await prisma.salary.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted.' });
  } catch (err) { next(err); }
});

// GET audit log for salary record
router.get('/:id/audit', protect, adminOnly, async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { recordType: 'Salary', recordId: req.params.id },
      orderBy: { timestamp: 'desc' },
      take: 50,
      include: { changedBy: { select: { name: true, role: true } } },
    });
    res.json(logs);
  } catch (err) { next(err); }
});

module.exports = router;
