const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const prisma = require('./src/utils/prisma');
const app = express();

// Middleware
app.use(cors({ 
  origin: [
    'http://localhost:5173',
    process.env.CLIENT_URL
  ].filter(Boolean), 
  credentials: true 
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
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
    await prisma.$connect();
    console.log('✅ MySQL connected via Prisma (Hostinger)');
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    process.exit(1);
  }
}

main();

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = app;
