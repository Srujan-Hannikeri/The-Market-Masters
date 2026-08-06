const express = require('express');
const inventoryController = require('../controllers/inventoryController');
const { authMiddleware, shopkeeperOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, inventoryController.getAllProducts);
router.get('/low-stock', authMiddleware, shopkeeperOnly, inventoryController.getLowStockProducts);
router.get('/expiring', authMiddleware, shopkeeperOnly, inventoryController.getExpiringProducts);
router.get('/:id', authMiddleware, inventoryController.getProduct);
router.post('/', authMiddleware, shopkeeperOnly, inventoryController.createProduct);
router.put('/:id', authMiddleware, shopkeeperOnly, inventoryController.updateProduct);
router.delete('/:id', authMiddleware, shopkeeperOnly, inventoryController.deleteProduct);
router.patch('/:id/stock', authMiddleware, shopkeeperOnly, inventoryController.updateStock);

module.exports = router;
