const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { protect, adminOnly } = require('../middleware/auth');
const { logCreate, logUpdate, logDelete } = require('../utils/auditLogger');

// GET /api/services
router.get('/', protect, adminOnly, async (req, res, next) => {
  try {
    const services = await prisma.service.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(services);
  } catch (err) { next(err); }
});

// POST /api/services
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { name, description, basePrice, isActive } = req.body;
    const service = await prisma.service.create({
      data: {
        name,
        description: description || '',
        basePrice: parseFloat(basePrice) || 0,
        isActive: isActive !== undefined ? isActive : true
      }
    });
    res.status(201).json(service);
  } catch (err) { next(err); }
});

// PUT /api/services/:id
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const { name, description, basePrice, isActive } = req.body;
    const old = await prisma.service.findUnique({ where: { id: req.params.id } });
    if (!old) return res.status(404).json({ message: 'Service not found' });
    
    const updated = await prisma.service.update({
      where: { id: req.params.id },
      data: {
        name,
        description,
        basePrice: parseFloat(basePrice) || 0,
        isActive
      }
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/services/:id
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const old = await prisma.service.findUnique({ where: { id: req.params.id } });
    if (!old) return res.status(404).json({ message: 'Service not found' });
    
    await prisma.service.delete({ where: { id: req.params.id } });
    res.json({ message: 'Service deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
