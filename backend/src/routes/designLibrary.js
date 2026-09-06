/**
 * designLibrary.js
 *
 * Admin-managed default reference images for Front / Back / Sleeve design sections.
 * Up to 20 images per section.
 * Images stored in: uploads/design-library/{section}/
 * Metadata stored in: uploads/design-library/meta.json
 */
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { protect, adminOnly } = require('../middleware/auth');

const LIBRARY_DIR = path.join(__dirname, '../../uploads/design-library');
const META_FILE   = path.join(LIBRARY_DIR, 'meta.json');
const SECTIONS    = ['front', 'back', 'sleeve'];
const MAX_PER_SECTION = 20;

// ── Ensure dirs exist ──────────────────────────────────────────────────────
function ensureDirs(itemType) {
  const base = path.join(LIBRARY_DIR, itemType || 'default');
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
  for (const s of SECTIONS) {
    const d = path.join(base, s);
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

// ── Meta helpers ───────────────────────────────────────────────────────────
function readMeta() {
  if (!fs.existsSync(LIBRARY_DIR)) fs.mkdirSync(LIBRARY_DIR, { recursive: true });
  if (!fs.existsSync(META_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(META_FILE, 'utf8')); }
  catch { return {}; }
}
function writeMeta(data) {
  if (!fs.existsSync(LIBRARY_DIR)) fs.mkdirSync(LIBRARY_DIR, { recursive: true });
  fs.writeFileSync(META_FILE, JSON.stringify(data, null, 2));
}

// ── Multer ─────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const section = req.params.section;
    const itemType = req.params.itemType || 'default';
    if (!SECTIONS.includes(section)) return cb(new Error('Invalid section'));
    const dir = path.join(LIBRARY_DIR, itemType, section);
    ensureDirs(itemType);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// ── GET /api/design-library/:itemType  — list images for item type ─────────
router.get('/:itemType', protect, (req, res) => {
  const { itemType } = req.params;
  const meta = readMeta();
  res.json({ data: meta[itemType] || { front: [], back: [], sleeve: [] } });
});

// ── POST /api/design-library/:itemType/:section  — upload image ────────────
router.post('/:itemType/:section', protect, adminOnly, upload.single('image'), (req, res) => {
  const { itemType, section } = req.params;
  if (!SECTIONS.includes(section)) return res.status(400).json({ error: 'Invalid section' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const meta = readMeta();
  if (!meta[itemType]) meta[itemType] = { front: [], back: [], sleeve: [] };
  if (!Array.isArray(meta[itemType][section])) meta[itemType][section] = [];

  if (meta[itemType][section].length >= MAX_PER_SECTION) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: `Max ${MAX_PER_SECTION} images allowed per section` });
  }

  const entry = {
    id:       `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    filename: req.file.filename,
    url:      `/uploads/design-library/${itemType}/${section}/${req.file.filename}`,
    section,
    uploadedAt: new Date().toISOString(),
  };
  meta[itemType][section].push(entry);
  writeMeta(meta);

  res.json({ data: entry, message: 'Image uploaded successfully' });
});

// ── DELETE /api/design-library/:itemType/:section/:id  — remove image ──────
router.delete('/:itemType/:section/:id', protect, adminOnly, (req, res) => {
  const { itemType, section, id } = req.params;
  if (!SECTIONS.includes(section)) return res.status(400).json({ error: 'Invalid section' });

  const meta = readMeta();
  if (!meta[itemType] || !meta[itemType][section]) {
    return res.status(404).json({ error: 'Image not found' });
  }

  const idx = meta[itemType][section].findIndex(e => e.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Image not found' });

  const entry = meta[itemType][section][idx];
  const filePath = path.join(LIBRARY_DIR, itemType, section, entry.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  meta[itemType][section].splice(idx, 1);
  writeMeta(meta);

  res.json({ message: 'Image deleted' });
});

module.exports = router;
