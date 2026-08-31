const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { protect, adminOnly } = require('../middleware/auth');
const { logCreate, logUpdate, logDelete } = require('../utils/auditLogger');

// GET /api/purchases
router.get('/', protect, adminOnly, async (req, res, next) => {
  try {
    const purchases = await prisma.purchase.findMany({
      include: { item: true },
      orderBy: { purchaseDate: 'desc' }
    });
    res.json(purchases);
  } catch (err) { next(err); }
});

// POST /api/purchases
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const { itemId, quantity, totalCost, supplier, purchaseDate } = req.body;
    
    // Create purchase and update inventory atomically
    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          itemId,
          quantity: parseFloat(quantity),
          totalCost: parseFloat(totalCost),
          supplier: supplier || '',
          purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date()
        },
        include: { item: true }
      });
      
      await tx.inventoryItem.update({
        where: { id: itemId },
        data: { quantity: { increment: parseFloat(quantity) } }
      });
      
      return purchase;
    });

    res.status(201).json(result);
  } catch (err) { next(err); }
});

// PUT /api/purchases/:id
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const { itemId, quantity, totalCost, supplier, purchaseDate } = req.body;
    const old = await prisma.purchase.findUnique({ where: { id: req.params.id } });
    if (!old) return res.status(404).json({ message: 'Purchase not found' });
    
    const result = await prisma.$transaction(async (tx) => {
      // Revert old quantity
      await tx.inventoryItem.update({
        where: { id: old.itemId },
        data: { quantity: { decrement: old.quantity } }
      });
      
      // Update purchase
      const updated = await tx.purchase.update({
        where: { id: req.params.id },
        data: {
          itemId,
          quantity: parseFloat(quantity),
          totalCost: parseFloat(totalCost),
          supplier: supplier || '',
          purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined
        },
        include: { item: true }
      });
      
      // Apply new quantity
      await tx.inventoryItem.update({
        where: { id: itemId },
        data: { quantity: { increment: parseFloat(quantity) } }
      });
      
      return updated;
    });

    res.json(result);
  } catch (err) { next(err); }
});

// DELETE /api/purchases/:id
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const old = await prisma.purchase.findUnique({ where: { id: req.params.id } });
    if (!old) return res.status(404).json({ message: 'Purchase not found' });
    
    await prisma.$transaction(async (tx) => {
      await tx.purchase.delete({ where: { id: req.params.id } });
      await tx.inventoryItem.update({
        where: { id: old.itemId },
        data: { quantity: { decrement: old.quantity } }
      });
    });

    res.json({ message: 'Purchase deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
