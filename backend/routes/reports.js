const express = require('express');
const reportController = require('../controllers/reportController');
const { authMiddleware, shopkeeperOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', authMiddleware, reportController.getDashboardStats);
router.get('/sales', authMiddleware, shopkeeperOnly, reportController.getSalesReport);
router.get('/profit-loss', authMiddleware, shopkeeperOnly, reportController.getProfitLossReport);
router.get('/payment-analysis', authMiddleware, shopkeeperOnly, reportController.getPaymentModeAnalysis);
router.get('/trends', authMiddleware, shopkeeperOnly, reportController.getTrendData);

module.exports = router;
