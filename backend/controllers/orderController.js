const { Order, Cart, Product, User, Bill } = require('../models');

const generateOrderNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `ORD-${timestamp}-${random}`;
};

const generateBillNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `BILL-${timestamp}-${random}`;
};

exports.getCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    let cart = await Cart.findOne({ customerId }).populate('items.productId');

    if (!cart) {
      cart = { items: [] };
    }

    const items = (cart.items || []).map(item => {
      const p = item.productId || {};
      const unitPrice = Number(item.unitPrice || p.mrp || p.price || 0);
      const qty = Number(item.quantity || 1);
      return {
        id: item._id ? item._id.toString() : '',
        productId: p._id ? p._id.toString() : item.productId,
        productName: item.productName || p.name || 'Product',
        productImage: item.productImage || p.image || '',
        quantity: qty,
        unitPrice,
        total: Number((unitPrice * qty).toFixed(2)),
        stock: p.stock !== undefined ? p.stock : 0
      };
    });

    const totalAmount = items.reduce((sum, i) => sum + i.total, 0);

    res.json({
      items,
      totalAmount: Number(totalAmount.toFixed(2)),
      itemCount: items.length
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ message: 'Error fetching cart.', error: error.message });
  }
};

exports.addToCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { productId, quantity } = req.body;
    const qty = parseInt(quantity) || 1;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    if (product.stock < qty) {
      return res.status(400).json({ message: 'Insufficient stock.' });
    }

    let cart = await Cart.findOne({ customerId });
    if (!cart) {
      cart = new Cart({ customerId, items: [] });
    }

    const unitPrice = Number(product.mrp || product.price || 0);
    const existingIndex = cart.items.findIndex(i => i.productId.toString() === productId);

    if (existingIndex > -1) {
      const newQty = cart.items[existingIndex].quantity + qty;
      if (product.stock < newQty) {
        return res.status(400).json({ message: 'Insufficient stock for updated quantity.' });
      }
      cart.items[existingIndex].quantity = newQty;
      cart.items[existingIndex].total = newQty * unitPrice;
    } else {
      cart.items.push({
        productId: product._id,
        productName: product.name,
        productImage: product.image || '',
        quantity: qty,
        unitPrice,
        total: qty * unitPrice
      });
    }

    await cart.save();

    res.status(201).json({
      message: 'Item added to cart.',
      cart
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ message: 'Error adding to cart.', error: error.message });
  }
};

exports.updateCartItem = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { cartItemId } = req.params;
    const { quantity } = req.body;

    const cart = await Cart.findOne({ customerId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found.' });
    }

    const item = cart.items.id(cartItemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found in cart.' });
    }

    const product = await Product.findById(item.productId);
    if (product && product.stock < quantity) {
      return res.status(400).json({ message: 'Insufficient stock.' });
    }

    item.quantity = quantity;
    item.total = quantity * item.unitPrice;
    await cart.save();

    res.json({ message: 'Cart updated.', cart });
  } catch (error) {
    res.status(500).json({ message: 'Error updating cart.', error: error.message });
  }
};

exports.removeFromCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { cartItemId } = req.params;

    const cart = await Cart.findOne({ customerId });
    if (cart) {
      cart.items = cart.items.filter(i => i._id.toString() !== cartItemId);
      await cart.save();
    }

    res.json({ message: 'Item removed from cart.' });
  } catch (error) {
    res.status(500).json({ message: 'Error removing from cart.', error: error.message });
  }
};

exports.clearCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    await Cart.findOneAndDelete({ customerId });
    res.json({ message: 'Cart cleared.' });
  } catch (error) {
    res.status(500).json({ message: 'Error clearing cart.', error: error.message });
  }
};

exports.placeOrder = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { shippingAddress, paymentMode, notes } = req.body;

    const cart = await Cart.findOne({ customerId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty.' });
    }

    const customer = await User.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found.' });
    }

    const firstProduct = cart.items[0].productId;
    if (!firstProduct) {
      return res.status(400).json({ message: 'Invalid product in cart.' });
    }
    const resolvedShopkeeperId = firstProduct.userId?._id || firstProduct.userId;
    if (!resolvedShopkeeperId) {
      return res.status(400).json({ message: 'Could not determine shopkeeper for this order.' });
    }

    let totalAmount = 0;
    const orderItems = [];
    const billItems = [];

    for (const item of cart.items) {
      const p = item.productId;
      if (!p || p.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${item.productName}.` });
      }

      const unitPrice = Number(item.unitPrice || p.mrp || p.price);
      const total = unitPrice * item.quantity;
      totalAmount += total;

      orderItems.push({
        productId: p._id,
        productName: item.productName || p.name,
        quantity: item.quantity,
        unitPrice,
        total
      });

      billItems.push({
        productId: p._id,
        productName: item.productName || p.name,
        quantity: item.quantity,
        unitPrice,
        mrp: p.mrp || unitPrice,
        total
      });

      p.stock -= item.quantity;
      await p.save();
    }

    const orderNumber = generateOrderNumber();
    const isPaid = false; // All online orders start as pending until verified
    const paymentStatus = 'Pending';

    // Map COD -> Cash for Bill model (Bill enum doesn't include 'COD')
    const billPaymentMode = (paymentMode === 'COD') ? 'Cash' : (paymentMode || 'Cash');

    const order = await Order.create({
      orderNumber,
      customerId,
      shopkeeperId: resolvedShopkeeperId,
      items: orderItems,
      totalAmount,
      discount: 0,
      finalAmount: totalAmount,
      paymentMode: paymentMode || 'COD',
      paymentStatus,
      orderStatus: 'Pending',
      shippingAddress,
      customerPhone: customer.phone || '',
      notes: notes || ''
    });

    const billNumber = generateBillNumber();
    await Bill.create({
      billNumber,
      shopkeeperId: resolvedShopkeeperId,
      customerId,
      customerName: customer.name || 'Customer',
      customerPhone: customer.phone || '',
      items: billItems,
      subtotal: totalAmount,
      discount: 0,
      totalAmount,
      paidAmount: isPaid ? totalAmount : 0,
      balanceAmount: isPaid ? 0 : totalAmount,
      paymentMode: billPaymentMode,
      paymentStatus,
      notes: `Order: ${orderNumber}`
    });

    await Cart.findOneAndDelete({ customerId });

    res.status(201).json({
      message: 'Order placed successfully.',
      order
    });
  } catch (error) {
    console.error('Place order error:', error);
    res.status(500).json({ message: 'Error placing order.', error: error.message });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customerId: req.user.id }).sort({ created_at: -1 });
    res.json({ orders });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching orders.', error: error.message });
  }
};

exports.getShopOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const query = { shopkeeperId: req.user.id };
    if (status) query.orderStatus = status;

    const orders = await Order.find(query)
      .populate('customerId', 'name email phone')
      .sort({ createdAt: -1 });

    const newOrdersCount = await Order.countDocuments({
      shopkeeperId: req.user.id,
      orderStatus: 'Pending'
    });

    res.json({ orders, newOrdersCount });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching shop orders.', error: error.message });
  }
};

exports.getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId || req.params.id)
      .populate('customerId', 'name email phone')
      .populate('shopkeeperId', 'name shopName shopAddress upiId upiQrCode');

    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    res.json({ order });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching order details.', error: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderStatus, paymentStatus } = req.body;
    const order = await Order.findById(req.params.orderId || req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    if (orderStatus) order.orderStatus = orderStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;

    await order.save();

    res.json({ message: 'Order status updated.', order });
  } catch (error) {
    res.status(500).json({ message: 'Error updating order status.', error: error.message });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId || req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    if (order.orderStatus === 'Cancelled') {
      return res.status(400).json({ message: 'Order is already cancelled.' });
    }
    if (order.orderStatus === 'Delivered') {
      return res.status(400).json({ message: 'Cannot cancel a delivered order.' });
    }

    order.orderStatus = 'Cancelled';
    await order.save();

    for (const item of order.items) {
      const p = await Product.findById(item.productId);
      if (p) {
        p.stock += item.quantity;
        await p.save();
      }
    }

    res.json({ message: 'Order cancelled successfully.', order });
  } catch (error) {
    res.status(500).json({ message: 'Error cancelling order.', error: error.message });
  }
};

exports.processRefund = async (req, res) => {
  try {
    const { refundAmount } = req.body;
    const order = await Order.findById(req.params.orderId || req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    order.refundStatus = 'Refunded';
    order.refundAmount = refundAmount || order.finalAmount;
    await order.save();

    res.json({ message: 'Refund processed successfully.', order });
  } catch (error) {
    res.status(500).json({ message: 'Error processing refund.', error: error.message });
  }
};

exports.updateOrderPayment = async (req, res) => {
  try {
    const { paymentStatus, paymentMode } = req.body;
    const order = await Order.findById(req.params.orderId || req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (paymentMode) order.paymentMode = paymentMode;

    await order.save();

    res.json({ message: 'Payment updated.', order });
  } catch (error) {
    res.status(500).json({ message: 'Error updating order payment.', error: error.message });
  }
};

// Aliases so route names match controller exports
exports.getCustomerOrders = exports.getMyOrders;
exports.getShopkeeperOrders = exports.getShopOrders;
exports.customerUpdatePayment = exports.updateOrderPayment;

exports.getOrderByNumber = async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber });

    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    // Only the customer or the shopkeeper of this order can view it
    const userId = req.user.id || req.user._id;
    if (
      order.customerId.toString() !== userId.toString() &&
      order.shopkeeperId.toString() !== userId.toString()
    ) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    res.json({ order });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching order.', error: error.message });
  }
};
