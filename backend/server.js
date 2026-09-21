const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const db = require('./src/utils/db');
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
    await db.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', time: new Date() });
  } catch {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});


// Error handler
app.use(require('./src/middleware/errorHandler'));

const PORT = process.env.PORT || 5000;

async function main() {
  try {
    // Initialize required tables
    await db.query(`
      CREATE TABLE IF NOT EXISTS DesignLibrary (
        id VARCHAR(255) PRIMARY KEY,
        itemType VARCHAR(100),
        section VARCHAR(50),
        filename VARCHAR(255),
        url VARCHAR(500),
        uploadedAt DATETIME
      )
    `);

    // db.js automatically initializes the pool and tests connection
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('❌ Server start error:', err.message);
  }
}

main();

// Graceful shutdown
process.on('SIGINT', async () => {
  await db.end();
  process.exit(0);
});

module.exports = app;
