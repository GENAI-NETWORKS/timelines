const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { protect, adminOnly } = require('../middleware/auth');
const { logCreate, logUpdate, logDelete } = require('../utils/auditLogger');

// GET /api/inventory
router.get('/', protect, adminOnly, async (req, res, next) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(items);
  } catch (err) { next(err); }
});

// POST /api/inventory
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { name, category, quantity, unit, minStockLevel } = req.body;
    const item = await prisma.inventoryItem.create({
      data: {
        name,
        category: category || 'Raw Material',
        quantity: quantity || 0,
        unit: unit || 'pcs',
        minStockLevel: minStockLevel || 0
      }
    });
    // Assuming auditLogger supports 'InventoryItem'
    // await logCreate('InventoryItem', item.id, req.user, item);
    res.status(201).json(item);
  } catch (err) { next(err); }
});

// PUT /api/inventory/:id
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const { name, category, quantity, unit, minStockLevel } = req.body;
    const old = await prisma.inventoryItem.findUnique({ where: { id: req.params.id } });
    if (!old) return res.status(404).json({ message: 'Item not found' });
    
    const updated = await prisma.inventoryItem.update({
      where: { id: req.params.id },
      data: { name, category, quantity, unit, minStockLevel }
    });
    // await logUpdate('InventoryItem', updated.id, req.user, old, updated);
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/inventory/:id
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const old = await prisma.inventoryItem.findUnique({ where: { id: req.params.id } });
    if (!old) return res.status(404).json({ message: 'Item not found' });
    
    await prisma.inventoryItem.delete({ where: { id: req.params.id } });
    // await logDelete('InventoryItem', old.id, req.user, old);
    res.json({ message: 'Item deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
