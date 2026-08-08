// Online Shopping Module
const shopping = {
  cart: [],
  products: [],
  currentOrder: null,
  currentShopkeeperId: null, // Track which shop the customer is ordering from
  currentShopName: null, // Track the shop name

  // Initialize shopping module
  init() {
    this.loadProducts();
    this.updateCartCount();
  },

  // Load products for shopping
  async loadProducts() {
    try {
      const response = await inventoryAPI.getProducts({ status: 'active' });
      this.products = response.products || [];
      this.renderProductCatalog();
    } catch (error) {
      console.error('Error loading products:', error);
    }
  },

  // Render product catalog for customers
  renderProductCatalog() {
    const container = document.getElementById('products-catalog');
    if (!container) return;

    if (this.products.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-box-open"></i>
          <h3>No Products Available</h3>
          <p>Check back later for new products!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.products.map(product => `
      <div class="product-card">
        <div class="product-image">
          ${product.image ? 
            `<img src="${product.image}" alt="${product.name}">` : 
            `<i class="fas fa-box"></i>`
          }
        </div>
        <div class="product-info">
          <h4>${product.name}</h4>
          <p class="product-category">${product.category || 'General'}</p>
          ${product.User && product.User.shopName ? `<p class="product-shop-name" style="font-size: 13px; color: #666; margin-bottom: 8px;"><i class="fas fa-store"></i> ${product.User.shopName}</p>` : ''}
          <p class="product-price">₹${parseFloat(product.price).toFixed(2)}</p>
          <p class="product-stock ${product.stock < 10 ? 'low-stock' : ''}">
            ${product.stock > 0 ? `In Stock: ${product.stock} ${product.unit || 'units'}` : 'Out of Stock'}
          </p>
          ${product.stock > 0 ? `
            <div class="product-actions">
              <div class="quantity-selector">
                <button onclick="shopping.updateQuantity(${product.id}, -1)" class="btn-quantity">-</button>
                <input type="number" id="qty-${product.id}" value="1" min="1" max="${product.stock}">
                <button onclick="shopping.updateQuantity(${product.id}, 1)" class="btn-quantity">+</button>
              </div>
              <button onclick="shopping.addToCart(${product.id})" class="btn btn-primary btn-add-cart">
                <i class="fas fa-cart-plus"></i> Add to Cart
              </button>
            </div>
          ` : `
            <button class="btn btn-disabled" disabled>Out of Stock</button>
          `}
        </div>
      </div>
    `).join('');
  },

  // Update quantity input
  updateQuantity(productId, change) {
    const input = document.getElementById(`qty-${productId}`);
    if (!input) return;
    
    const currentVal = parseInt(input.value) || 1;
    const newVal = currentVal + change;
    const max = parseInt(input.max) || 999;
    
    if (newVal >= 1 && newVal <= max) {
      input.value = newVal;
    }
  },

  // Add product to cart
  async addToCart(productId) {
    try {

      const qtyInput = document.getElementById(`qty-${productId}`);
      const quantity = qtyInput ? parseInt(qtyInput.value) || 1 : 1;

      // Find the product to get shopkeeper ID
      const product = this.products.find(p => p.id === productId);
      if (!product) {
        toast.error('Product not found');
        return;
      }

      const productShopkeeperId = product.userId || (product.User && product.User.id);
      const productShopName = product.User && product.User.shopName ? product.User.shopName : 'Unknown Shop';

      // Check if cart already has items from a different shop
      if (this.currentShopkeeperId && productShopkeeperId !== this.currentShopkeeperId) {
        toast.error(`⚠️ Your cart already has items from "${this.currentShopName}". Please checkout those items first or clear your cart to order from "${productShopName}".`);
        return;
      }

      // Set the shopkeeper ID if this is the first item
      if (!this.currentShopkeeperId) {
        this.currentShopkeeperId = productShopkeeperId;
        this.currentShopName = productShopName;

      }

      const response = await ordersAPI.addToCart(productId, quantity);

      toast.success(`Added to cart from ${productShopName}!`);
      this.updateCartCount();
      
      // Reset quantity
      if (qtyInput) qtyInput.value = 1;
    } catch (error) {
      console.error('Add to cart error:', error);
      toast.error(error.message || 'Failed to add to cart');
    }
  },

  // Update cart item quantity
  async updateCartItem(cartItemId, quantity) {
    try {
      if (quantity <= 0) {
        await this.removeFromCart(cartItemId);
        return;
      }
      
      await ordersAPI.updateCartItem(cartItemId, quantity);
      await this.loadCart();
      toast.success('Cart updated');
    } catch (error) {
      toast.error(error.message || 'Failed to update cart');
    }
  },

  // Remove item from cart
  async removeFromCart(cartItemId) {
    try {
      await ordersAPI.removeFromCart(cartItemId);
      await this.loadCart();
      this.updateCartCount();
      toast.success('Item removed from cart');
    } catch (error) {
      toast.error(error.message || 'Failed to remove item');
    }
  },

  // Clear entire cart
  async clearCart() {
    try {
      await ordersAPI.clearCart();
      this.cart = [];
      this.currentShopkeeperId = null;
      this.currentShopName = null;
      this.updateCartCount();
      this.renderCart();
      toast.success('Cart cleared');
    } catch (error) {
      toast.error(error.message || 'Failed to clear cart');
    }
  },

  // Load cart items
  async loadCart() {
    try {

      const response = await ordersAPI.getCart();

      this.cart = response.items || [];

      // Determine shopkeeper ID from cart items
      if (this.cart.length > 0) {
        // Get the first item's shopkeeper ID
        const firstItem = this.cart[0];
        if (firstItem.Product && firstItem.Product.userId) {
          this.currentShopkeeperId = firstItem.Product.userId;
          this.currentShopName = firstItem.Product.User?.shopName || 'Unknown Shop';
        }
      } else {
        // Cart is empty, reset shop tracking
        this.currentShopkeeperId = null;
        this.currentShopName = null;
      }
      
      this.renderCart();
      this.updateCartCount();
    } catch (error) {
      console.error('Error loading cart:', error);
      toast.error('Failed to load cart: ' + (error.message || 'Unknown error'));
    }
  },

  // Render cart
  renderCart() {
    const container = document.getElementById('cart-items');
    const summaryContainer = document.getElementById('cart-summary');
    if (!container) return;

    if (this.cart.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-shopping-cart"></i>
          <h3>Your Cart is Empty</h3>
          <p>Browse products and add items to your cart</p>
          <button onclick="app.navigateTo('shop')" class="btn btn-primary">Start Shopping</button>
        </div>
      `;
      if (summaryContainer) summaryContainer.style.display = 'none';
      return;
    }

    container.innerHTML = this.cart.map(item => `
      <div class="cart-item">
        <div class="cart-item-image">
          ${item.productImage ? 
            `<img src="${item.productImage}" alt="${item.productName}">` : 
            `<i class="fas fa-box"></i>`
          }
        </div>
        <div class="cart-item-details">
          <h4>${item.productName}</h4>
          <p class="cart-item-price">₹${item.unitPrice.toFixed(2)} / unit</p>
        </div>
        <div class="cart-item-quantity">
          <button onclick="shopping.updateCartItem(${item.id}, ${item.quantity - 1})" class="btn-quantity">-</button>
          <span>${item.quantity}</span>
          <button onclick="shopping.updateCartItem(${item.id}, ${item.quantity + 1})" class="btn-quantity">+</button>
        </div>
        <div class="cart-item-total">
          <p>₹${item.total.toFixed(2)}</p>
          <button onclick="shopping.removeFromCart(${item.id})" class="btn-remove">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');

    // Calculate totals
    const totalAmount = this.cart.reduce((sum, item) => sum + item.total, 0);
    
    if (summaryContainer) {
      summaryContainer.style.display = 'block';
      summaryContainer.innerHTML = `
        <div class="cart-summary-box">
          <h3>Order Summary</h3>
          ${this.currentShopName ? `<div style="background: #e3f2fd; padding: 10px; border-radius: 5px; margin-bottom: 15px; font-size: 13px;"><i class="fas fa-store"></i> <strong>Shop:</strong> ${this.currentShopName}</div>` : ''}
          <div class="summary-row">
            <span>Subtotal (${this.cart.length} items)</span>
            <span>₹${totalAmount.toFixed(2)}</span>
          </div>
          <div class="summary-row">
            <span>Shipping</span>
            <span>Free</span>
          </div>
          <div class="summary-row total">
            <span>Total</span>
            <span>₹${totalAmount.toFixed(2)}</span>
          </div>
          <button onclick="shopping.showCheckout()" class="btn btn-primary btn-checkout">
            Proceed to Checkout
          </button>
          <button onclick="shopping.clearCart()" class="btn btn-warning" style="margin-top: 10px; width: 100%;">
            <i class="fas fa-trash"></i> Clear Cart
          </button>
          <button onclick="app.navigateTo('shop')" class="btn btn-secondary" style="margin-top: 10px; width: 100%;">
            Continue Shopping
          </button>
        </div>
      `;
    }
  },

  // Update cart count badge
  async updateCartCount() {
    try {
      const response = await ordersAPI.getCart();
      const count = response.itemCount || 0;
      const badge = document.getElementById('cart-count');
      if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline' : 'none';
      }
    } catch (error) {
      console.error('Error updating cart count:', error);
    }
  },

  // Show checkout modal
  showCheckout() {
    // Validate that all items are from the same shop
    if (this.cart.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    const totalAmount = this.cart.reduce((sum, item) => sum + item.total, 0);
    
    // Remove existing checkout modal if any
    const existingModal = document.getElementById('checkout-modal');
    if (existingModal) {
      existingModal.remove();
    }
    
    const modalEl = document.createElement('div');
    modalEl.id = 'checkout-modal';
    modalEl.className = 'modal';
    modalEl.innerHTML = `
      <div class="modal-header">
        <h3>Checkout</h3>
        <button class="modal-close" onclick="modal.closeAll();">&times;</button>
      </div>
      <div class="modal-body">
        <div class="checkout-modal">
          <div class="checkout-summary">
            <p><strong>Total Amount:</strong> ₹${totalAmount.toFixed(2)}</p>
          </div>
          <form id="checkout-form" onsubmit="shopping.placeOrder(event)">
            <div class="form-group">
              <label>Shipping Address *</label>
              <textarea id="shipping-address" rows="3" required placeholder="Enter your complete shipping address"></textarea>
            </div>
            <div class="form-group">
              <label>Payment Mode *</label>
              <select id="payment-mode" required>
                <option value="">Select Payment Mode</option>
                <option value="COD">Cash on Delivery (COD)</option>
                <option value="UPI">UPI</option>
                <option value="Card">Credit/Debit Card</option>
                <option value="Net Banking">Net Banking</option>
              </select>
            </div>
            <div class="form-group">
              <label>Order Notes (Optional)</label>
              <textarea id="order-notes" rows="2" placeholder="Any special instructions..."></textarea>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Place Order</button>
              <button type="button" onclick="modal.closeAll()" class="btn btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.getElementById('modal-overlay').appendChild(modalEl);
    
    // Add payment mode change listener
    const paymentModeSelect = document.getElementById('payment-mode');
    if (paymentModeSelect) {
      paymentModeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'UPI') {
          this.showUPIPaymentModal();
        }
      });
    }
    
    modal.open('checkout-modal');
  },

  // Show UPI Payment Modal
  async showUPIPaymentModal() {
    try {
      // Get shopkeeper info (first shopkeeper for now)
      const response = await api.get('/auth/profile');
      const currentUser = response.user;
      
      // For demo, we'll show a placeholder - in production, fetch actual shopkeeper's UPI details
      const upiId = 'shop@example@upi'; // This should come from shopkeeper's profile
      const qrCode = null; // This should be shopkeeper's uploaded QR code
      
      // Create UPI payment modal
      const upiModal = document.createElement('div');
      upiModal.id = 'upi-payment-modal';
      upiModal.className = 'modal';
      upiModal.innerHTML = `
        <div class="modal-header">
          <h3>Pay via UPI</h3>
          <button class="modal-close" onclick="document.getElementById('upi-payment-modal').remove();">&times;</button>
        </div>
        <div class="modal-body">
          <div style="text-align: center; padding: 20px;">
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
              <h4 style="color: #2c5f2d; margin-bottom: 15px;">Shop Payment Details</h4>
              
              ${qrCode ? `
                <div style="margin: 20px 0;">
                  <img src="${qrCode}" alt="UPI QR Code" style="max-width: 250px; border: 2px solid #ddd; border-radius: 10px; padding: 10px; background: white;">
                  <p style="color: #666; font-size: 12px; margin-top: 10px;">Scan this QR code to pay</p>
                </div>
              ` : `
                <div style="margin: 20px 0; padding: 40px; background: #fff; border: 2px dashed #ddd; border-radius: 10px;">
                  <i class="fas fa-qrcode" style="font-size: 48px; color: #ccc;"></i>
                  <p style="color: #999; margin-top: 10px;">QR Code not available</p>
                </div>
              `}
              
              <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0; color: #666;">UPI ID:</p>
                <p style="margin: 5px 0; font-size: 18px; font-weight: bold; color: #2c5f2d; user-select: all;">${upiId}</p>
                <button onclick="navigator.clipboard.writeText('${upiId}'); toast.success('UPI ID copied!');" 
                        style="margin-top: 10px; padding: 8px 16px; background: #e3f2fd; border: none; border-radius: 5px; cursor: pointer; color: #1976d2; font-size: 12px;">
                  <i class="fas fa-copy"></i> Copy UPI ID
                </button>
              </div>
              
              <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 20px; text-align: left;">
                <p style="margin: 5px 0; font-size: 13px; color: #856404;">
                  <i class="fas fa-info-circle"></i> <strong>How to pay:</strong>
                </p>
                <ol style="margin: 10px 0; padding-left: 20px; font-size: 13px; color: #856404;">
                  <li>Open your UPI app (GPay, PhonePe, Paytm, etc.)</li>
                  <li>Scan the QR code or enter UPI ID</li>
                  <li>Enter the amount and complete payment</li>
                  <li>Order will be confirmed after payment verification</li>
                </ol>
              </div>
            </div>
            
            <button onclick="document.getElementById('upi-payment-modal').remove();" 
                    class="btn btn-secondary" style="margin-top: 10px;">
              <i class="fas fa-times"></i> Close
            </button>
          </div>
        </div>
      `;
      
      document.getElementById('modal-overlay').appendChild(upiModal);
      modal.open('upi-payment-modal');
      
    } catch (error) {
      console.error('Error showing UPI modal:', error);
      toast.error('Failed to load payment details');
    }
  },

  // Place order
  async placeOrder(event) {
    event.preventDefault();
    
    const shippingAddress = document.getElementById('shipping-address').value.trim();
    const paymentMode = document.getElementById('payment-mode').value;
    const notes = document.getElementById('order-notes').value.trim();
    
    if (!shippingAddress || !paymentMode) {
      toast.error('Please fill all required fields');
      return;
    }

    try {

      const response = await ordersAPI.placeOrder({
        shippingAddress,
        paymentMode,
        notes
      });

      modal.closeAll();
      toast.success('Order placed successfully!');
      
      // Clear cart and reset shop tracking
      this.cart = [];
      this.currentShopkeeperId = null;
      this.currentShopName = null;
      
      this.updateCartCount();
      app.navigateTo('my-orders');
    } catch (error) {
      console.error('Place order error:', error);
      toast.error(error.message || 'Failed to place order');
    }
  },

  // Load customer orders
  async loadMyOrders() {
    try {
      const response = await ordersAPI.getMyOrders();
      this.renderMyOrders(response.orders || []);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Failed to load orders');
    }
  },

  // Render customer orders
  renderMyOrders(orders) {
    const container = document.getElementById('my-orders-list');
    if (!container) return;

    if (orders.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-shopping-bag"></i>
          <h3>No Orders Yet</h3>
          <p>Start shopping to place your first order!</p>
          <button onclick="app.navigateTo('shop')" class="btn btn-primary">Browse Products</button>
        </div>
      `;
      return;
    }

    container.innerHTML = orders.map(order => {
      const orderStatusClass = order.orderStatus.toLowerCase().replace(/\s+/g, '-');
      const paymentStatusClass = order.paymentStatus.toLowerCase().replace(/\s+/g, '-');
      const statusIcon = this.getOrderStatusIcon(order.orderStatus);
      
      return `
      <div class="order-card">
        <div class="order-header">
          <div class="order-info">
            <h4>Order #${order.orderNumber}</h4>
            <p class="order-date"><i class="far fa-calendar-alt"></i> ${new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
          <div class="order-status">
            <div class="status-row">
              <span class="status-icon">${statusIcon}</span>
              <span class="status-badge status-${orderStatusClass}">${order.orderStatus}</span>
            </div>
            <span class="payment-badge payment-${paymentStatusClass}">${order.paymentStatus}</span>
          </div>
        </div>
        
        <div class="order-progress">
          ${this.renderOrderProgress(order.orderStatus)}
        </div>
        
        <div class="order-items-preview">
          ${order.OrderItems.slice(0, 2).map(item => `
            <div class="order-item-preview">
              <span class="item-name">${item.productName}</span>
              <span class="item-qty">x${item.quantity}</span>
            </div>
          `).join('')}
          ${order.OrderItems.length > 2 ? `<p class="more-items">+${order.OrderItems.length - 2} more items</p>` : ''}
        </div>
        <div class="order-footer">
          <div class="order-total-section">
            <span class="order-label">Total Amount</span>
            <p class="order-total"><strong>₹${parseFloat(order.finalAmount).toFixed(2)}</strong></p>
          </div>
          ${order.orderStatus === 'Cancelled' && order.refundStatus ? `
            <div style="background: #d1ecf1; padding: 10px; border-radius: 5px; margin-bottom: 10px; font-size: 13px;">
              <p style="margin: 0; color: #0c5460;">
                <i class="fas fa-undo"></i> 
                Refund: <strong>${order.refundStatus}</strong>
                ${order.refundAmount ? ` | Rs. ${parseFloat(order.refundAmount).toFixed(2)}` : ''}
              </p>
            </div>
          ` : ''}
          <div class="order-actions">
            ${order.orderStatus !== 'Cancelled' && order.orderStatus !== 'Delivered' ? `
              <button onclick="shopping.showPaymentModal(${order.id}, '${order.paymentMode}', ${order.finalAmount})" class="btn btn-sm btn-success">
                <i class="fas fa-credit-card"></i> Pay Now
              </button>
              <button onclick="shopping.cancelOrder(${order.id})" class="btn btn-sm btn-danger">
                <i class="fas fa-times"></i> Cancel
              </button>
            ` : ''}
            <button onclick="shopping.viewOrderDetails(${order.id})" class="btn btn-sm btn-secondary">
              <i class="fas fa-eye"></i> View Details
            </button>
          </div>
        </div>
      </div>
    `}).join('');
  },

  // Get order status icon
  getOrderStatusIcon(status) {
    const icons = {
      'Pending': '<i class="fas fa-clock"></i>',
      'Confirmed': '<i class="fas fa-check-circle"></i>',
      'Processing': '<i class="fas fa-cog fa-spin"></i>',
      'Shipped': '<i class="fas fa-shipping-fast"></i>',
      'Delivered': '<i class="fas fa-check-double"></i>',
      'Cancelled': '<i class="fas fa-times-circle"></i>'
    };
    return icons[status] || '<i class="fas fa-info-circle"></i>';
  },

  // Render order progress bar
  renderOrderProgress(currentStatus) {
    const statuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered'];
    const currentIndex = statuses.indexOf(currentStatus);
    
    if (currentStatus === 'Cancelled') {
      return `<div class="order-progress-bar cancelled"><span class="cancelled-text">Order Cancelled</span></div>`;
    }
    
    const progressPercent = ((currentIndex + 1) / statuses.length) * 100;
    
    return `
      <div class="order-progress-bar">
        <div class="progress-fill" style="width: ${progressPercent}%"></div>
        <div class="progress-steps">
          ${statuses.map((status, index) => `
            <div class="progress-step ${index <= currentIndex ? 'active' : ''} ${index === currentIndex ? 'current' : ''}">
              <div class="step-dot"></div>
              <span class="step-label">${status}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  // View order details
  async viewOrderDetails(orderId) {
    try {
      const response = await ordersAPI.getOrderDetails(orderId);
      const order = response.order;
      
      const modalContent = `
        <div class="order-details-modal">
          <div class="order-details-header">
            <h3>Order #${order.orderNumber}</h3>
            <div class="order-status-badges">
              <span class="status-badge status-${order.orderStatus.toLowerCase().replace(' ', '-')}">${order.orderStatus}</span>
              <span class="payment-badge payment-${order.paymentStatus.toLowerCase().replace(' ', '-')}">${order.paymentStatus}</span>
            </div>
          </div>
          
          <div class="order-details-section">
            <h4>Items</h4>
            <div class="order-items-list">
              ${order.OrderItems.map(item => `
                <div class="order-item-detail">
                  <span class="item-name">${item.productName}</span>
                  <span class="item-qty">x${item.quantity}</span>
                  <span class="item-price">₹${parseFloat(item.total).toFixed(2)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="order-details-section">
            <h4>Order Summary</h4>
            <div class="order-summary-rows">
              <div class="summary-row">
                <span>Subtotal</span>
                <span>₹${parseFloat(order.totalAmount).toFixed(2)}</span>
              </div>
              <div class="summary-row">
                <span>Discount</span>
                <span>₹${parseFloat(order.discount).toFixed(2)}</span>
              </div>
              <div class="summary-row total">
                <span>Total</span>
                <span>₹${parseFloat(order.finalAmount).toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          <div class="order-details-section">
            <h4>Shipping Details</h4>
            <p>${order.shippingAddress.replace(/\n/g, '<br>')}</p>
            <p><strong>Phone:</strong> <i class="fas fa-phone" onclick="copyPhoneNumber('${order.customerPhone}', event)" title="Click to copy phone number" style="cursor: pointer; color: var(--primary);"></i> ${order.customerPhone}</p>
          </div>
          
          <div class="order-details-section">
            <h4>Payment</h4>
            <p><strong>Mode:</strong> ${order.paymentMode}</p>
          </div>
          
          ${order.notes ? `
            <div class="order-details-section">
              <h4>Notes</h4>
              <p>${order.notes}</p>
            </div>
          ` : ''}
        </div>
      `;
      
      // Remove existing modal if any
      const existingModal = document.getElementById('order-details-modal');
      if (existingModal) {
        existingModal.remove();
      }
      
      const modalEl = document.createElement('div');
      modalEl.id = 'order-details-modal';
      modalEl.className = 'modal';
      modalEl.innerHTML = `
        <div class="modal-header">
          <h3>Order Details</h3>
          <button class="modal-close" onclick="modal.closeAll();">&times;</button>
        </div>
        <div class="modal-body">
          ${modalContent}
        </div>
      `;
      
      document.getElementById('modal-overlay').appendChild(modalEl);
      modal.open('order-details-modal');
    } catch (error) {
      console.error('View order details error:', error);
      toast.error('Failed to load order details');
    }
  },

  // Load shopkeeper orders
  async loadShopOrders(status = '') {
    try {
      const response = await ordersAPI.getShopOrders(status);
      this.renderShopOrders(response.orders || []);
      
      // Update sidebar badge with new orders count
      if (response.newOrdersCount !== undefined) {
        this.updateOrdersBadge(response.newOrdersCount);
      }
      
      // Show notification for new orders
      if (response.newOrdersCount > 0 && !status) {
        toast.info(`🔔 You have ${response.newOrdersCount} new order${response.newOrdersCount > 1 ? 's' : ''}!`);
      }
    } catch (error) {
      console.error('Error loading shop orders:', error);
      toast.error('Failed to load orders');
    }
  },

  // Update orders badge in sidebar
  updateOrdersBadge(count) {
    let badge = document.getElementById('orders-badge');
    const ordersNavItem = document.querySelector('[data-page="shop-orders"]');
    
    if (!ordersNavItem) return;
    
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.id = 'orders-badge';
        badge.style.cssText = 'background: #dc3545; color: white; border-radius: 50%; padding: 2px 6px; font-size: 11px; font-weight: bold; margin-left: 8px; min-width: 20px; text-align: center;';
        ordersNavItem.appendChild(badge);
      }
      badge.textContent = count > 99 ? '99+' : count;
    } else if (badge) {
      badge.remove();
    }
  },

  // Render shopkeeper orders
  renderShopOrders(orders) {
    const container = document.getElementById('shop-orders-list');
    if (!container) return;

    if (orders.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-inbox"></i>
          <h3>No Orders</h3>
          <p>No orders found for the selected filter</p>
        </div>
      `;
      return;
    }

    // Color mapping for different order statuses
    const statusColors = {
      'Pending': { bg: '#fff3cd', border: '#ffc107', text: '#856404' },
      'Confirmed': { bg: '#d1ecf1', border: '#17a2b8', text: '#0c5460' },
      'Processing': { bg: '#d4edda', border: '#28a745', text: '#155724' },
      'Shipped': { bg: '#cce5ff', border: '#007bff', text: '#004085' },
      'Delivered': { bg: '#d4edda', border: '#28a745', text: '#155724' },
      'Cancelled': { bg: '#f8d7da', border: '#dc3545', text: '#721c24' }
    };

    container.innerHTML = orders.map(order => {
      const colors = statusColors[order.orderStatus] || { bg: '#f8f9fa', border: '#6c757d', text: '#495057' };
      const isNew = order.orderStatus === 'Pending';
      
      return `
      <div class="order-card shop-order-card" style="background: ${colors.bg}; border-left: 4px solid ${colors.border}; ${isNew ? 'animation: pulse 2s infinite;' : ''}">
        ${isNew ? '<div style="background: #dc3545; color: white; padding: 4px 12px; text-align: center; font-size: 12px; font-weight: bold;"><i class="fas fa-bell"></i> NEW ORDER</div>' : ''}
        <div class="order-header">
          <div>
            <h4 style="color: ${colors.text};">Order #${order.orderNumber}</h4>
            <p class="order-customer" style="color: ${colors.text};">${order.Customer?.name || 'Unknown'}</p>
            <p class="order-date" style="color: ${colors.text};">${new Date(order.created_at).toLocaleDateString('en-IN')}</p>
          </div>
          <div class="order-status-actions">
            <span class="status-badge status-${order.orderStatus.toLowerCase().replace(' ', '-')}">${order.orderStatus}</span>
            <span class="payment-badge payment-${order.paymentStatus.toLowerCase().replace(' ', '-')}">${order.paymentStatus}</span>
          </div>
        </div>
        <div class="order-items-preview">
          ${order.OrderItems.slice(0, 3).map(item => `
            <div class="order-item-preview">
              <span>${item.productName}</span>
              <span>x${item.quantity}</span>
            </div>
          `).join('')}
          ${order.OrderItems.length > 3 ? `<p class="more-items">+${order.OrderItems.length - 3} more</p>` : ''}
        </div>
        <div class="order-footer">
          <p class="order-total"><strong style="color: ${colors.text};">Total: ₹${parseFloat(order.finalAmount).toFixed(2)}</strong></p>
          ${order.orderStatus === 'Cancelled' && (order.paymentStatus === 'Paid' || order.paymentStatus === 'Partially Paid') ? `
            <div style="background: #fff3cd; padding: 10px; border-radius: 5px; margin-bottom: 10px; font-size: 13px;">
              <p style="margin: 0; color: #856404;">
                <i class="fas fa-info-circle"></i> 
                Refund Status: <strong>${order.refundStatus || 'Not Refunded'}</strong>
                ${order.refundAmount ? ` | Amount: Rs. ${parseFloat(order.refundAmount).toFixed(2)}` : ''}
              </p>
            </div>
          ` : ''}
          <div class="order-actions">
            <button onclick="shopping.viewShopOrderDetails(${order.id})" class="btn btn-sm btn-secondary">View</button>
            <button onclick="shopping.updateOrderStatusModal(${order.id}, '${order.orderStatus}', '${order.paymentStatus}')" class="btn btn-sm btn-primary">Update</button>
            ${order.orderStatus === 'Cancelled' && (order.paymentStatus === 'Paid' || order.paymentStatus === 'Partially Paid') && order.refundStatus !== 'Refunded' ? `
              <button onclick="shopping.showRefundModal(${order.id}, ${order.finalAmount})" class="btn btn-sm btn-warning">
                <i class="fas fa-undo"></i> Process Refund
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `}).join('');
  },

  // View shop order details
  async viewShopOrderDetails(orderId) {
    try {
      const response = await ordersAPI.getOrderDetails(orderId);
      const order = response.order;
      
      const modalContent = `
        <div class="order-details-modal">
          <div class="order-details-header">
            <h3>Order #${order.orderNumber}</h3>
          </div>
          
          <div class="order-details-section">
            <h4>Customer Information</h4>
            <p><strong>Name:</strong> ${order.Customer?.name}</p>
            <p><strong>Phone:</strong> <i class="fas fa-phone" onclick="copyPhoneNumber('${order.customerPhone}', event)" title="Click to copy phone number" style="cursor: pointer; color: var(--primary);"></i> ${order.customerPhone}</p>
            <p><strong>Email:</strong> ${order.Customer?.email || 'N/A'}</p>
          </div>
          
          <div class="order-details-section">
            <h4>Items</h4>
            <div class="order-items-list">
              ${order.OrderItems.map(item => `
                <div class="order-item-detail">
                  <span class="item-name">${item.productName}</span>
                  <span class="item-qty">x${item.quantity}</span>
                  <span class="item-price">₹${parseFloat(item.total).toFixed(2)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="order-details-section">
            <h4>Order Summary</h4>
            <div class="order-summary-rows">
              <div class="summary-row">
                <span>Subtotal</span>
                <span>₹${parseFloat(order.totalAmount).toFixed(2)}</span>
              </div>
              <div class="summary-row total">
                <span>Total</span>
                <span>₹${parseFloat(order.finalAmount).toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          <div class="order-details-section">
            <h4>Shipping Address</h4>
            <p>${order.shippingAddress.replace(/\n/g, '<br>')}</p>
          </div>
          
          <div class="order-details-section">
            <h4>Current Status</h4>
            <p><strong>Order Status:</strong> ${order.orderStatus}</p>
            <p><strong>Payment Status:</strong> ${order.paymentStatus}</p>
            <p><strong>Payment Mode:</strong> ${order.paymentMode}</p>
          </div>
        </div>
      `;
      
      // Remove existing modal if any
      const existingModal = document.getElementById('shop-order-details-modal');
      if (existingModal) {
        existingModal.remove();
      }
      
      const modalEl = document.createElement('div');
      modalEl.id = 'shop-order-details-modal';
      modalEl.className = 'modal';
      modalEl.innerHTML = `
        <div class="modal-header">
          <h3>Order Details</h3>
          <button class="modal-close" onclick="modal.closeAll();">&times;</button>
        </div>
        <div class="modal-body">
          ${modalContent}
        </div>
      `;
      
      document.getElementById('modal-overlay').appendChild(modalEl);
      modal.open('shop-order-details-modal');
    } catch (error) {
      console.error('View shop order details error:', error);
      toast.error('Failed to load order details');
    }
  },

  // Update order status modal
  updateOrderStatusModal(orderId, currentOrderStatus, currentPaymentStatus) {
    const modalContent = `
      <div class="update-status-modal">
        <h3>Update Order Status</h3>
        <form id="update-status-form" onsubmit="shopping.saveOrderStatus(event, ${orderId})">
          <div class="form-group">
            <label>Order Status</label>
            <select id="update-order-status" required>
              <option value="Pending" ${currentOrderStatus === 'Pending' ? 'selected' : ''}>Pending</option>
              <option value="Confirmed" ${currentOrderStatus === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
              <option value="Processing" ${currentOrderStatus === 'Processing' ? 'selected' : ''}>Processing</option>
              <option value="Shipped" ${currentOrderStatus === 'Shipped' ? 'selected' : ''}>Shipped</option>
              <option value="Delivered" ${currentOrderStatus === 'Delivered' ? 'selected' : ''}>Delivered</option>
              <option value="Cancelled" ${currentOrderStatus === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </div>
          <div class="form-group">
            <label>Payment Status</label>
            <select id="update-payment-status" required>
              <option value="Pending" ${currentPaymentStatus === 'Pending' ? 'selected' : ''}>Pending</option>
              <option value="Paid" ${currentPaymentStatus === 'Paid' ? 'selected' : ''}>Paid</option>
              <option value="Partially Paid" ${currentPaymentStatus === 'Partially Paid' ? 'selected' : ''}>Partially Paid</option>
              <option value="Failed" ${currentPaymentStatus === 'Failed' ? 'selected' : ''}>Failed</option>
            </select>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Update Status</button>
            <button type="button" onclick="modal.closeAll()" class="btn btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('update-status-modal');
    if (existingModal) {
      existingModal.remove();
    }
    
    const modalEl = document.createElement('div');
    modalEl.id = 'update-status-modal';
    modalEl.className = 'modal';
    modalEl.innerHTML = `
      <div class="modal-header">
        <h3>Update Order Status</h3>
        <button class="modal-close" onclick="modal.closeAll();">&times;</button>
      </div>
      <div class="modal-body">
        ${modalContent}
      </div>
    `;
    
    document.getElementById('modal-overlay').appendChild(modalEl);
    modal.open('update-status-modal');
  },

  // Save order status
  async saveOrderStatus(event, orderId) {
    event.preventDefault();
    
    const orderStatus = document.getElementById('update-order-status').value;
    const paymentStatus = document.getElementById('update-payment-status').value;
    
    try {
      await ordersAPI.updateOrderStatus(orderId, { orderStatus, paymentStatus });
      modal.closeAll();
      toast.success('Order status updated');
      this.loadShopOrders();
    } catch (error) {
      toast.error(error.message || 'Failed to update status');
    }
  },

  // Show payment modal for order
  async showPaymentModal(orderId, currentPaymentMode, amount) {
    try {
      // Fetch shopkeeper's UPI details
      let shopkeeperUPI = null;
      try {
        const response = await api.get('/auth/profile');
        if (response.user && response.user.role === 'customer') {
          // For customer, we need to get the shopkeeper info from the order
          const orderResponse = await ordersAPI.getOrderDetails(orderId);
          const order = orderResponse.order;
          if (order && order.shopkeeperId) {
            // Get shopkeeper profile
            const shopProfile = await api.get(`/auth/shopkeeper/${order.shopkeeperId}`);
            if (shopProfile.user) {
              shopkeeperUPI = {
                upiId: shopProfile.user.upiId,
                upiQrCode: shopProfile.user.upiQrCode
              };
            }
          }
        }
      } catch (error) {
        console.error('Error fetching shopkeeper UPI:', error);
      }
      
      // Store UPI data globally for the modal to access
      window.currentOrderShopkeeperUPI = shopkeeperUPI;
      
      const paymentModal = document.createElement('div');
      paymentModal.id = 'order-payment-modal';
      paymentModal.className = 'modal';
      paymentModal.innerHTML = `
        <div class="modal-header">
          <h3>Make Payment</h3>
          <button class="modal-close" onclick="document.getElementById('order-payment-modal').remove();">&times;</button>
        </div>
        <div class="modal-body">
          <div style="padding: 20px;">
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
              <h4 style="color: #2c5f2d; margin-bottom: 10px;">Order Amount</h4>
              <p style="font-size: 28px; font-weight: bold; color: #2c5f2d; margin: 10px 0;">Rs. ${parseFloat(amount).toFixed(2)}</p>
            </div>
            
            <form id="order-payment-form" onsubmit="shopping.processOrderPayment(event, ${orderId}, ${amount})">
              <div class="form-group">
                <label>Select Payment Mode *</label>
                <select id="order-payment-mode" required onchange="shopping.showPaymentDetails(this.value, ${amount});">
                  <option value="">Choose Payment Method</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Credit/Debit Card</option>
                  <option value="Net Banking">Net Banking</option>
                </select>
              </div>
              
              <div class="form-group">
                <label>Payment Type *</label>
                <select id="payment-type" required onchange="shopping.togglePartialPayment(${amount})">
                  <option value="Full">Full Payment</option>
                  <option value="Partial">Partial Payment</option>
                </select>
              </div>
              
              <div id="partial-payment-field" style="display: none;">
                <div class="form-group">
                  <label>Amount Paid (Rs.) *</label>
                  <input type="number" id="amount-paid" step="0.01" min="0.01" max="${amount}" placeholder="Enter amount paid">
                  <small style="color: #666;">Maximum: Rs. ${parseFloat(amount).toFixed(2)}</small>
                </div>
              </div>
              
              <div id="payment-details-container" style="margin-top: 20px;">
                <!-- Payment details will be shown here based on selection -->
              </div>
              
              <div class="form-actions" style="margin-top: 20px;">
                <button type="submit" class="btn btn-primary">
                  <i class="fas fa-check"></i> Confirm Payment
                </button>
                <button type="button" onclick="document.getElementById('order-payment-modal').remove();" class="btn btn-secondary">
                  <i class="fas fa-times"></i> Close
                </button>
              </div>
            </form>
          </div>
        </div>
      `;
      
      document.getElementById('modal-overlay').appendChild(paymentModal);
      modal.open('order-payment-modal');
      
    } catch (error) {
      console.error('Error showing payment modal:', error);
      toast.error('Failed to load payment options');
    }
  },

  // Show payment details based on selected mode
  showPaymentDetails(paymentMode, amount, shopkeeperUPI) {
    const container = document.getElementById('payment-details-container');
    if (!container) return;
    
    // Use passed UPI data or fall back to global variable
    const upiData = shopkeeperUPI || window.currentOrderShopkeeperUPI || null;
    
    // Use actual shopkeeper UPI details or show message to set them up
    const upiId = upiData && upiData.upiId ? upiData.upiId : null;
    const qrCode = upiData && upiData.upiQrCode ? upiData.upiQrCode : null;
    
    if (paymentMode === 'UPI') {
      if (!upiId && !qrCode) {
        // Show message that shopkeeper hasn't set up UPI yet
        container.innerHTML = `
          <div style="background: #fff3cd; padding: 20px; border-radius: 10px; border: 2px solid #ffc107;">
            <h4 style="color: #856404; margin-bottom: 15px; text-align: center;">
              <i class="fas fa-qrcode"></i> Pay via UPI
            </h4>
            <div style="text-align: center; padding: 30px 20px;">
              <i class="fas fa-info-circle" style="font-size: 48px; color: #ffc107; margin-bottom: 15px;"></i>
              <p style="color: #856404; font-size: 14px; margin: 10px 0;">Shopkeeper has not configured UPI payment details yet.</p>
              <p style="color: #856404; font-size: 13px; margin: 10px 0;">Please contact the shopkeeper or choose another payment method.</p>
            </div>
            <div style="background: #d1ecf1; padding: 12px; border-radius: 8px; margin-top: 15px;">
              <p style="margin: 0; font-size: 13px; color: #0c5460;">
                <i class="fas fa-info-circle"></i> <strong>Amount to pay:</strong> Rs. ${parseFloat(amount).toFixed(2)}
              </p>
            </div>
          </div>
        `;
      } else {
        // Show UPI QR code and ID
        container.innerHTML = `
          <div style="background: #fff3cd; padding: 20px; border-radius: 10px; border: 2px solid #ffc107;">
            <h4 style="color: #856404; margin-bottom: 15px; text-align: center;">
              <i class="fas fa-qrcode"></i> Pay via UPI
            </h4>
            
            <div style="text-align: center; margin: 20px 0;">
              <div style="background: white; padding: 20px; border-radius: 10px; display: inline-block; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                ${qrCode ? 
                  `<img src="${qrCode}" alt="UPI QR Code" style="max-width: 200px; max-height: 200px;">` :
                  `<i class="fas fa-qrcode" style="font-size: 120px; color: #2c5f2d;"></i>`
                }
                <p style="color: #666; font-size: 12px; margin-top: 10px;">Shop QR Code</p>
              </div>
            </div>
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: center;">
              <p style="margin: 5px 0; color: #666; font-size: 13px;">UPI ID:</p>
              <p style="margin: 5px 0; font-size: 20px; font-weight: bold; color: #2c5f2d; user-select: all; letter-spacing: 1px;">${upiId}</p>
              <button type="button" onclick="navigator.clipboard.writeText('${upiId}'); toast.success('UPI ID copied!');" 
                      style="margin-top: 10px; padding: 8px 16px; background: #e3f2fd; border: none; border-radius: 5px; cursor: pointer; color: #1976d2; font-size: 13px;">
                <i class="fas fa-copy"></i> Copy UPI ID
              </button>
            </div>
            
            <div style="background: #d1ecf1; padding: 12px; border-radius: 8px; margin-top: 15px;">
              <p style="margin: 0; font-size: 13px; color: #0c5460;">
                <i class="fas fa-info-circle"></i> <strong>Amount to pay:</strong> Rs. ${parseFloat(amount).toFixed(2)}
              </p>
            </div>
          </div>
        `;
      }
    } else if (paymentMode === 'Cash') {
      container.innerHTML = `
        <div style="background: #d4edda; padding: 20px; border-radius: 10px; border: 2px solid #28a745; text-align: center;">
          <i class="fas fa-money-bill-wave" style="font-size: 48px; color: #28a745; margin-bottom: 15px;"></i>
          <h4 style="color: #155724; margin-bottom: 10px;">Cash Payment</h4>
          <p style="color: #155724; margin: 10px 0;">Pay cash to the shopkeeper upon delivery or pickup.</p>
          <p style="font-size: 18px; font-weight: bold; color: #155724; margin-top: 15px;">Amount: Rs. ${parseFloat(amount).toFixed(2)}</p>
        </div>
      `;
    } else if (paymentMode === 'Card') {
      container.innerHTML = `
        <div style="background: #e7f3ff; padding: 20px; border-radius: 10px; border: 2px solid #0066cc; text-align: center;">
          <i class="fas fa-credit-card" style="font-size: 48px; color: #0066cc; margin-bottom: 15px;"></i>
          <h4 style="color: #004085; margin-bottom: 10px;">Card Payment</h4>
          <p style="color: #004085; margin: 10px 0;">Pay using Credit or Debit card at the shop.</p>
          <p style="font-size: 18px; font-weight: bold; color: #004085; margin-top: 15px;">Amount: Rs. ${parseFloat(amount).toFixed(2)}</p>
        </div>
      `;
    } else if (paymentMode === 'Net Banking') {
      container.innerHTML = `
        <div style="background: #f0e7ff; padding: 20px; border-radius: 10px; border: 2px solid #6f42c1; text-align: center;">
          <i class="fas fa-university" style="font-size: 48px; color: #6f42c1; margin-bottom: 15px;"></i>
          <h4 style="color: #4a2c82; margin-bottom: 10px;">Net Banking</h4>
          <p style="color: #4a2c82; margin: 10px 0;">Transfer amount via online banking to shop's account.</p>
          <p style="font-size: 18px; font-weight: bold; color: #4a2c82; margin-top: 15px;">Amount: Rs. ${parseFloat(amount).toFixed(2)}</p>
        </div>
      `;
    } else {
      container.innerHTML = '';
    }
  },

  // Process order payment
  async processOrderPayment(event, orderId, totalAmount) {
    event.preventDefault();
    
    const paymentMode = document.getElementById('order-payment-mode').value;
    const paymentType = document.getElementById('payment-type').value;
    const amountPaid = paymentType === 'Partial' ? parseFloat(document.getElementById('amount-paid').value) : totalAmount;
    
    if (!paymentMode) {
      toast.error('Please select a payment mode');
      return;
    }
    
    if (paymentType === 'Partial' && (!amountPaid || amountPaid <= 0 || amountPaid > totalAmount)) {
      toast.error('Please enter a valid amount paid');
      return;
    }
    
    try {
      // Update order payment status using customer-specific endpoint
      await ordersAPI.updateOrderPayment(orderId, {
        paymentStatus: paymentType === 'Partial' ? 'Partially Paid' : 'Paid',
        paymentMode: paymentMode,
        amountPaid: amountPaid
      });
      
      toast.success('Payment recorded successfully!');
      document.getElementById('order-payment-modal').remove();
      
      // Reload orders
      this.loadMyOrders();
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error(error.message || 'Failed to process payment');
    }
  },

  // Toggle partial payment field
  togglePartialPayment(totalAmount) {
    const paymentType = document.getElementById('payment-type').value;
    const partialField = document.getElementById('partial-payment-field');
    const amountInput = document.getElementById('amount-paid');
    
    if (paymentType === 'Partial') {
      partialField.style.display = 'block';
      if (amountInput) {
        amountInput.required = true;
        amountInput.max = totalAmount;
      }
    } else {
      partialField.style.display = 'none';
      if (amountInput) {
        amountInput.required = false;
        amountInput.value = '';
      }
    }
  },

  // Cancel order with confirmation
  async cancelOrder(orderId) {
    // Show confirmation dialog
    const confirmed = confirm('Are you sure you want to cancel this order?\n\nThis action cannot be undone.');
    
    if (!confirmed) {
      return; // User cancelled
    }
    
    try {
      await ordersAPI.cancelOrder(orderId);
      toast.success('Order cancelled successfully');
      
      // Reload orders to reflect changes
      this.loadMyOrders();
    } catch (error) {
      console.error('Error cancelling order:', error);
      
      // Show friendly error message
      if (error.message && error.message.includes('already cancelled')) {
        toast.info('This order is already cancelled');
      } else if (error.message && error.message.includes('delivered')) {
        toast.info('Cannot cancel a delivered order');
      } else {
        toast.error(error.message || 'Failed to cancel order');
      }
    }
  },

  // Show refund modal for shopkeeper
  showRefundModal(orderId, maxAmount) {
    const refundModal = document.createElement('div');
    refundModal.id = 'refund-modal';
    refundModal.className = 'modal';
    refundModal.innerHTML = `
      <div class="modal-header">
        <h3>Process Refund</h3>
        <button class="modal-close" onclick="document.getElementById('refund-modal').remove();">&times;</button>
      </div>
      <div class="modal-body">
        <div style="padding: 20px;">
          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; color: #856404;">
              <i class="fas fa-info-circle"></i> 
              Enter the refund amount to process for this cancelled order.
            </p>
          </div>
          
          <form id="refund-form" onsubmit="shopping.processRefundSubmit(event, ${orderId}, ${maxAmount})">
            <div class="form-group">
              <label>Refund Amount (Rs.) *</label>
              <input type="number" id="refund-amount" step="0.01" min="0.01" max="${maxAmount}" value="${maxAmount}" required>
              <small style="color: #666;">Maximum: Rs. ${parseFloat(maxAmount).toFixed(2)}</small>
            </div>
            
            <div class="form-actions">
              <button type="submit" class="btn btn-warning">
                <i class="fas fa-check"></i> Process Refund
              </button>
              <button type="button" onclick="document.getElementById('refund-modal').remove();" class="btn btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.getElementById('modal-overlay').appendChild(refundModal);
    modal.open('refund-modal');
  },

  // Process refund submission
  async processRefundSubmit(event, orderId, maxAmount) {
    event.preventDefault();
    
    const refundAmount = parseFloat(document.getElementById('refund-amount').value);
    
    if (!refundAmount || refundAmount <= 0) {
      toast.error('Please enter a valid refund amount');
      return;
    }
    
    if (refundAmount > maxAmount) {
      toast.error('Refund amount cannot exceed order total');
      return;
    }
    
    try {
      await ordersAPI.processRefund(orderId, refundAmount);
      toast.success('Refund processed successfully!');
      document.getElementById('refund-modal').remove();
      
      // Reload shop orders
      this.loadShopOrders();
    } catch (error) {
      console.error('Error processing refund:', error);
      toast.error(error.message || 'Failed to process refund');
    }
  }
};
