const express = require('express');
const billController = require('../controllers/billController');
const { authMiddleware, shopkeeperOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, billController.getAllBills);
router.get('/pending', authMiddleware, billController.getPendingBills); // Both roles can see pending bills
router.get('/my-bills', authMiddleware, billController.getCustomerBills); // Customer's own bills
router.post('/:id/payment', authMiddleware, billController.customerMakePayment); // Customer payment endpoint (must be before /:id)
router.get('/:id', authMiddleware, billController.getBill);
router.post('/', authMiddleware, shopkeeperOnly, billController.createBill);
router.put('/:id', authMiddleware, shopkeeperOnly, billController.updateBill);
router.delete('/:id', authMiddleware, shopkeeperOnly, billController.deleteBill);
router.post('/:id/pdf', authMiddleware, billController.generatePDF); // Both shopkeeper and customer can download
router.post('/:id/whatsapp', authMiddleware, shopkeeperOnly, billController.sendBillWhatsApp);

module.exports = router;