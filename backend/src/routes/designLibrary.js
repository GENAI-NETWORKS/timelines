/**
 * designLibrary.js
 *
 * Admin-managed default reference images for Front / Back / Sleeve design sections.
 * Up to 20 images per section.
 * Images stored in: Cloudinary
 * Metadata stored in: MySQL (DesignLibrary table)
 */
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const { protect, adminOnly } = require('../middleware/auth');
const db = require('../utils/db');
const { getStorage, cloudinary } = require('../utils/cloudinary');
const { v4: uuidv4 } = require('uuid');

const SECTIONS = ['front', 'back', 'sleeve'];
const MAX_PER_SECTION = 20;

// ── Multer (Cloudinary) ────────────────────────────────────────────────────
const storage = getStorage('timelines/design-library');
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// ── GET /api/design-library/:itemType  — list images for item type ─────────
router.get('/:itemType', protect, async (req, res) => {
  try {
    const { itemType } = req.params;
    const [rows] = await db.query(`SELECT * FROM DesignLibrary WHERE itemType = ? ORDER BY uploadedAt ASC`, [itemType]);
    
    const data = { front: [], back: [], sleeve: [] };
    for (const row of rows) {
      if (data[row.section]) {
        data[row.section].push({
          id: row.id,
          filename: row.filename,
          url: row.url,
          section: row.section,
          uploadedAt: row.uploadedAt
        });
      }
    }
    res.json({ data });
  } catch (err) {
    console.error('Error fetching design library:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── POST /api/design-library/:itemType/:section  — upload image ────────────
router.post('/:itemType/:section', protect, adminOnly, upload.single('image'), async (req, res) => {
  try {
    const { itemType, section } = req.params;
    if (!SECTIONS.includes(section)) return res.status(400).json({ error: 'Invalid section' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Check count limit
    const [[{ count }]] = await db.query(`SELECT COUNT(*) as count FROM DesignLibrary WHERE itemType = ? AND section = ?`, [itemType, section]);
    
    if (count >= MAX_PER_SECTION) {
      // Delete from cloudinary if limit reached
      if (req.file.filename) {
        await cloudinary.uploader.destroy(req.file.filename);
      }
      return res.status(400).json({ error: `Max ${MAX_PER_SECTION} images allowed per section` });
    }

    const entry = {
      id: uuidv4(),
      itemType,
      section,
      filename: req.file.filename, // Cloudinary public_id
      url: req.file.path,          // Cloudinary secure_url
    };

    await db.execute(
      `INSERT INTO DesignLibrary (id, itemType, section, filename, url, uploadedAt) VALUES (?, ?, ?, ?, ?, NOW())`,
      [entry.id, entry.itemType, entry.section, entry.filename, entry.url]
    );

    res.json({ 
      data: {
        id: entry.id,
        filename: entry.filename,
        url: entry.url,
        section: entry.section,
        uploadedAt: new Date().toISOString()
      }, 
      message: 'Image uploaded successfully' 
    });
  } catch (err) {
    console.error('Error uploading design library image:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ── DELETE /api/design-library/:itemType/:section/:id  — remove image ──────
router.delete('/:itemType/:section/:id', protect, adminOnly, async (req, res) => {
  try {
    const { itemType, section, id } = req.params;
    if (!SECTIONS.includes(section)) return res.status(400).json({ error: 'Invalid section' });

    const [rows] = await db.query(`SELECT filename FROM DesignLibrary WHERE id = ? AND itemType = ? AND section = ?`, [id, itemType, section]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const { filename } = rows[0];

    // Delete from Cloudinary
    if (filename) {
      await cloudinary.uploader.destroy(filename).catch(e => console.error('Cloudinary destroy error:', e));
    }

    // Delete from DB
    await db.execute(`DELETE FROM DesignLibrary WHERE id = ?`, [id]);

    res.json({ message: 'Image deleted' });
  } catch (err) {
    console.error('Error deleting design library image:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;
