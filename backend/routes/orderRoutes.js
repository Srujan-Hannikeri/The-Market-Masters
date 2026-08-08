const express = require('express');
const router = express.Router();

// Lazy load middleware and controller to avoid circular dependency issues
const getAuth = () => require('../middleware/auth');
const getController = () => require('../controllers/orderController');

// Helper to get authenticate middleware
const authenticate = (req, res, next) => getAuth().authMiddleware(req, res, next);

// Cart routes (customer only)
router.get('/cart', authenticate, (req, res) => getController().getCart(req, res));
router.post('/cart/add', authenticate, (req, res) => getController().addToCart(req, res));
router.put('/cart/:cartItemId', authenticate, (req, res) => getController().updateCartItem(req, res));
// clearCart must be before /:cartItemId so Express doesn't swallow "clear" as an ID
router.delete('/cart/clear', authenticate, (req, res) => getController().clearCart(req, res));
router.delete('/cart/:cartItemId', authenticate, (req, res) => getController().removeFromCart(req, res));

// Order routes
router.post('/place', authenticate, (req, res) => getController().placeOrder(req, res));
router.get('/my-orders', authenticate, (req, res) => getController().getCustomerOrders(req, res));
router.get('/shop-orders', authenticate, (req, res) => getController().getShopkeeperOrders(req, res));
router.get('/number/:orderNumber', authenticate, (req, res) => getController().getOrderByNumber(req, res));
router.get('/:orderId', authenticate, (req, res) => getController().getOrderDetails(req, res));
router.put('/:orderId/status', authenticate, (req, res) => getController().updateOrderStatus(req, res));
router.put('/:orderId/cancel', authenticate, (req, res) => getController().cancelOrder(req, res));
router.post('/:orderId/refund', authenticate, (req, res) => getController().processRefund(req, res));
router.put('/:orderId/payment', authenticate, (req, res) => getController().customerUpdatePayment(req, res));

module.exports = router;
