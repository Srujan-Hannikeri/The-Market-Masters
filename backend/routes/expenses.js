const express = require('express');
const expenseController = require('../controllers/expenseController');
const { authMiddleware, shopkeeperOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, expenseController.getAllExpenses);
router.get('/summary', authMiddleware, shopkeeperOnly, expenseController.getExpenseSummary);
router.get('/daily', authMiddleware, shopkeeperOnly, expenseController.getDailyExpenses);
router.get('/:id', authMiddleware, expenseController.getExpense);
router.post('/', authMiddleware, shopkeeperOnly, expenseController.createExpense);
router.put('/:id', authMiddleware, shopkeeperOnly, expenseController.updateExpense);
router.delete('/:id', authMiddleware, shopkeeperOnly, expenseController.deleteExpense);

module.exports = router;
