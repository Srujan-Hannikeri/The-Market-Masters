const express = require('express');
const paymentController = require('../controllers/paymentController');
const { authMiddleware, shopkeeperOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, paymentController.getAllPayments);
router.get('/summary', authMiddleware, shopkeeperOnly, paymentController.getPaymentSummary);
router.get('/pending-dues', authMiddleware, shopkeeperOnly, paymentController.getPendingDues);
router.get('/verification-pending', authMiddleware, shopkeeperOnly, paymentController.getVerificationPendingBills);
router.get('/all-bills', authMiddleware, shopkeeperOnly, paymentController.getAllBillsForPayments);
router.get('/bill/:billId', authMiddleware, paymentController.getPaymentsByBill);
router.get('/:id', authMiddleware, paymentController.getPayment);
router.post('/', authMiddleware, shopkeeperOnly, paymentController.createPayment);
router.put('/:id', authMiddleware, shopkeeperOnly, paymentController.updatePayment);
router.post('/:id/confirm', authMiddleware, shopkeeperOnly, paymentController.confirmPayment);
router.post('/:id/reject', authMiddleware, shopkeeperOnly, paymentController.rejectPayment);

module.exports = router;
