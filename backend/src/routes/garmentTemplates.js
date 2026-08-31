const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { protect, adminOnly } = require('../middleware/auth');
const { logCreate, logUpdate, logDelete } = require('../utils/auditLogger');

// GET all templates
router.get('/', protect, async (req, res, next) => {
  try {
    const templates = await prisma.garmentTemplate.findMany({ orderBy: { garmentType: 'asc' } });
    res.json(templates);
  } catch (err) { next(err); }
});

// GET template by garment type name
router.get('/type/:garmentType', protect, async (req, res, next) => {
  try {
    const tpl = await prisma.garmentTemplate.findUnique({
      where: { garmentType: decodeURIComponent(req.params.garmentType) },
    });
    if (!tpl) return res.status(404).json({ message: 'Template not found.' });
    res.json(tpl);
  } catch (err) { next(err); }
});

// GET single template by id
router.get('/:id', protect, async (req, res, next) => {
  try {
    const tpl = await prisma.garmentTemplate.findUnique({ where: { id: req.params.id } });
    if (!tpl) return res.status(404).json({ message: 'Template not found.' });
    res.json(tpl);
  } catch (err) { next(err); }
});

// POST create template
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { garmentType, fields, isActive = true } = req.body;
    const tpl = await prisma.garmentTemplate.create({
      data: { garmentType, fields: fields || [], isActive },
    });
    await logCreate('GarmentTemplate', tpl.id, req.user, tpl);
    res.status(201).json(tpl);
  } catch (err) { next(err); }
});

// PUT update template
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const old = await prisma.garmentTemplate.findUnique({ where: { id: req.params.id } });
    if (!old) return res.status(404).json({ message: 'Template not found.' });
    const { garmentType, fields, isActive } = req.body;
    const updated = await prisma.garmentTemplate.update({
      where: { id: req.params.id },
      data: { garmentType, fields, isActive },
    });
    await logUpdate('GarmentTemplate', updated.id, req.user, old, updated);
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE template
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const tpl = await prisma.garmentTemplate.findUnique({ where: { id: req.params.id } });
    if (!tpl) return res.status(404).json({ message: 'Template not found.' });
    await logDelete('GarmentTemplate', tpl.id, req.user, tpl);
    await prisma.garmentTemplate.delete({ where: { id: req.params.id } });
    res.json({ message: 'Template deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
