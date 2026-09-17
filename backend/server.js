const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const prisma = require('./src/utils/prisma');
const app = express();

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    // Allow any vercel.app subdomain for preview deployments
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Static files for uploads
app.use('/uploads', cors({ origin: '*' }), express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/customers', require('./src/routes/customers'));
app.use('/api/employees', require('./src/routes/employees'));
app.use('/api/garment-templates', require('./src/routes/garmentTemplates'));
app.use('/api/design-orders', require('./src/routes/designOrders'));
app.use('/api/tailoring-orders', require('./src/routes/tailoringOrders'));
app.use('/api/salary', require('./src/routes/salary'));
app.use('/api/audit-logs', require('./src/routes/auditLogs'));
app.use('/api/inventory', require('./src/routes/inventory'));
app.use('/api/purchases', require('./src/routes/purchases'));
app.use('/api/services', require('./src/routes/services'));
app.use('/api/payments', require('./src/routes/payments'));
app.use('/api/design-library', require('./src/routes/designLibrary'));

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected', time: new Date() });
  } catch {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// ⚠️  TEMPORARY: One-time admin reset — DELETE after use
app.get('/api/setup-admin', async (req, res) => {
  const SECRET = 'timelines-reset-2026';
  if (req.query.token !== SECRET)
    return res.status(403).json({ error: 'Forbidden' });
  try {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('Admin@2026', 12);
    const user = await prisma.user.upsert({
      where:  { email: 'admin@timelines.in' },
      update: { password: hash, isActive: true, role: 'admin' },
      create: { name: 'Admin User', email: 'admin@timelines.in', password: hash, role: 'admin', isActive: true },
    });
    res.json({ success: true, message: 'Admin ready', email: user.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/test-db', async (req, res) => {
  try {
    const mysql = require('mysql2/promise');
    const conn = await mysql.createConnection({
      host: 'srv1128.hstgr.io',
      user: 'u416856653_timelines',
      password: 'Timelines@2026',
      database: 'u416856653_timelines',
      connectTimeout: 5000
    });
    await conn.end();
    res.json({ success: true, message: 'Connected to MySQL using mysql2 successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, stack: err.stack });
  }
});

// Error handler
app.use(require('./src/middleware/errorHandler'));

const PORT = process.env.PORT || 5000;

async function main() {
  try {
    // Attempt an initial connection, but don't crash if it's slow
    prisma.$connect().then(() => {
      console.log('✅ MySQL connected via Prisma');
    }).catch(err => {
      console.error('⚠️ Initial DB connect failed (will retry on first query):', err.message);
    });
    
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('❌ Server start error:', err.message);
  }
}

main();

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = app;
