const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { connectDB } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { startScheduler } = require('./services/schedulerService');

// Import routes
const authRoutes = require('./routes/auth');
const inventoryRoutes = require('./routes/inventory');
const billRoutes = require('./routes/bills');
const paymentRoutes = require('./routes/payments');
const expenseRoutes = require('./routes/expenses');
const reportRoutes = require('./routes/reports');
const orderRoutes = require('./routes/orderRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure DB connection middleware for serverless environment
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api')) {
    await connectDB();
  }
  next();
});

// Static files for bills
app.use('/bills', express.static(path.join(__dirname, 'bills')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/orders', orderRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Market Masters API is running with MongoDB' });
});

// Serve Frontend Static Files
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Fallback to index.html for non-API GET routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'API route not found' });
  }
  const indexPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend static files not found');
  }
});

// Error handler
app.use(errorHandler);

// Initialize server for local dev (if not imported as module)
if (require.main === module) {
  const startServer = async () => {
    await connectDB();
    try {
      startScheduler();
    } catch (e) {
      console.warn('Scheduler warning:', e.message);
    }
    app.listen(PORT, () => {
      console.log(`
========================================
  Market Masters MongoDB Server
========================================
  Server running on port: ${PORT}
  Environment: ${process.env.NODE_ENV || 'development'}
  
  URL: http://localhost:${PORT}
========================================
      `);
    });
  };
  startServer();
}

module.exports = app;
