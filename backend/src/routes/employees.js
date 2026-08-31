const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { protect, adminOnly } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { logCreate, logUpdate, logDelete } = require('../utils/auditLogger');

// ─── Auto-generate Employee ID: EMP-XXXX ─────────────────────────────────
async function generateEmployeeId() {
  const last = await prisma.employee.findFirst({ orderBy: { employeeId: 'desc' } });
  if (!last) return 'EMP-0001';
  const num = parseInt(last.employeeId.split('-')[1], 10) + 1;
  return `EMP-${String(num).padStart(4, '0')}`;
}

// GET /api/employees
router.get('/', protect, async (req, res, next) => {
  try {
    const { search = '', status, role, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    const where = {};
    if (status) where.status = status;
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { employeeId: { contains: search } },
        { phone: { contains: search } },
      ];
    }
    const [employees, total] = await Promise.all([
      prisma.employee.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.employee.count({ where }),
    ]);
    res.json({ employees, total, page: parseInt(page), limit: take });
  } catch (err) { next(err); }
});

// GET /api/employees/tailors - active tailors for dropdowns
router.get('/tailors', protect, async (req, res, next) => {
  try {
    const tailors = await prisma.employee.findMany({
      where: { role: 'Tailor', status: 'active' },
      select: { employeeId: true, name: true },
    });
    res.json(tailors);
  } catch (err) { next(err); }
});

// GET /api/employees/:id
router.get('/:id', protect, async (req, res, next) => {
  try {
    const employee = await prisma.employee.findUnique({ where: { employeeId: req.params.id } });
    if (!employee) return res.status(404).json({ message: 'Employee not found.' });
    res.json(employee);
  } catch (err) { next(err); }
});

// POST /api/employees
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { name, role, phone = '', email = '', address = '', joiningDate, notes = '' } = req.body;
    const employeeId = await generateEmployeeId();
    const employee = await prisma.employee.create({
      data: {
        employeeId, name, role, phone, email, address, notes,
        joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
      },
    });

    if (role === 'Designer' || role === 'Tailor') {
      // Generate unique email if none provided
      let userEmail = email || `${name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}@timelines.in`;
      let emailTaken = await prisma.user.findUnique({ where: { email: userEmail } });
      let counter = 1;
      while (emailTaken) {
        userEmail = `${name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}${counter}@timelines.in`;
        emailTaken = await prisma.user.findUnique({ where: { email: userEmail } });
        counter++;
      }

      const defaultPassword = await bcrypt.hash('timelines123', 10);
      await prisma.user.create({
        data: {
          name,
          email: userEmail,
          password: defaultPassword,
          role: 'staff',
          employeeRef: employee.employeeId,
          plainPassword: 'timelines123'
        }
      });
    }

    await logCreate('Employee', employee.employeeId, req.user, employee);
    res.status(201).json(employee);
  } catch (err) { next(err); }
});

// PUT /api/employees/:id
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const old = await prisma.employee.findUnique({ where: { employeeId: req.params.id } });
    if (!old) return res.status(404).json({ message: 'Employee not found.' });
    const { name, role, phone, email, address, joiningDate, status, notes } = req.body;
    const updated = await prisma.employee.update({
      where: { employeeId: req.params.id },
      data: {
        name, role, phone, email, address, status, notes,
        joiningDate: joiningDate ? new Date(joiningDate) : undefined,
      },
    });
    await logUpdate('Employee', updated.employeeId, req.user, old, updated);
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/employees/:id
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const employee = await prisma.employee.findUnique({ where: { employeeId: req.params.id } });
    if (!employee) return res.status(404).json({ message: 'Employee not found.' });
    await logDelete('Employee', employee.employeeId, req.user, employee);
    await prisma.employee.delete({ where: { employeeId: req.params.id } });
    res.json({ message: 'Employee deleted.' });
  } catch (err) { next(err); }
});

// GET /api/employees/:id/audit
router.get('/:id/audit', protect, adminOnly, async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { recordType: 'Employee', recordId: req.params.id },
      orderBy: { timestamp: 'desc' },
      take: 50,
      include: { changedBy: { select: { name: true, role: true } } },
    });
    res.json(logs);
  } catch (err) { next(err); }
});

module.exports = router;
