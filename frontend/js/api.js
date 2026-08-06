// API Configuration - Same origin (combined server)
const API_BASE_URL = '/api';

// API Helper Functions
const api = {
  // Get auth token
  getToken() {
    return localStorage.getItem('token');
  },

  // Set auth token
  setToken(token) {
    localStorage.setItem('token', token);
  },

  // Remove auth token
  removeToken() {
    localStorage.removeItem('token');
  },

  // Get auth headers
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  // Generic request method
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: this.getHeaders(),
      ...options
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },

  // GET request
  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  // POST request
  post(endpoint, body) {
    return this.request(endpoint, { method: 'POST', body });
  },

  // PUT request
  put(endpoint, body) {
    return this.request(endpoint, { method: 'PUT', body });
  },

  // DELETE request
  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};

// Auth API
const authAPI = {
  login(phone, password) {
    return api.post('/auth/login', { phone, password });
  },

  register(userData) {
    return api.post('/auth/register', userData);
  },

  getProfile() {
    return api.get('/auth/profile');
  },

  updateProfile(userData) {
    return api.put('/auth/profile', userData);
  },

  sendOTP(phone) {
    return api.post('/auth/forgot-password/send-otp', { phone });
  },

  verifyOTPAndResetPassword(phone, otp, newPassword) {
    return api.post('/auth/forgot-password/verify-otp', { phone, otp, newPassword });
  }
};

// Inventory API
const inventoryAPI = {
  getProducts(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/inventory?${queryString}`);
  },

  getProduct(id) {
    return api.get(`/inventory/${id}`);
  },

  createProduct(productData) {
    return api.post('/inventory', productData);
  },

  updateProduct(id, productData) {
    return api.put(`/inventory/${id}`, productData);
  },

  deleteProduct(id) {
    return api.delete(`/inventory/${id}`);
  },

  getLowStock() {
    return api.get('/inventory/low-stock');
  },

  getExpiring(days = 30) {
    return api.get(`/inventory/expiring?days=${days}`);
  },

  updateStock(id, quantity) {
    return api.request(`/inventory/${id}/stock`, {
      method: 'PATCH',
      body: { quantity }
    });
  }
};

// Bills API
const billsAPI = {
  getBills(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/bills?${queryString}`);
  },

  getBill(id) {
    return api.get(`/bills/${id}`);
  },

  createBill(billData) {
    return api.post('/bills', billData);
  },

  updateBill(id, billData) {
    return api.put(`/bills/${id}`, billData);
  },

  deleteBill(id) {
    return api.delete(`/bills/${id}`);
  },

  generatePDF(id, format = 'standard') {
    return api.post(`/bills/${id}/pdf?format=${format}`);
  },

  sendWhatsApp(id) {
    return api.post(`/bills/${id}/whatsapp`);
  },

  getPendingBills() {
    return api.get('/bills/pending');
  },

  getMyBills() {
    return api.get('/bills/my-bills');
  },

  makePayment(billId, paymentData) {
    return api.post(`/bills/${billId}/payment`, paymentData);
  }
};

// Payments API
const paymentsAPI = {
  getPayments(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/payments?${queryString}`);
  },

  getPayment(id) {
    return api.get(`/payments/${id}`);
  },

  createPayment(paymentData) {
    return api.post('/payments', paymentData);
  },

  getPaymentsByBill(billId) {
    return api.get(`/payments/bill/${billId}`);
  },

  getSummary(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/payments/summary?${queryString}`);
  },

  getPendingDues() {
    return api.get('/payments/pending-dues');
  },

  getAllBillsForPayments() {
    return api.get('/payments/all-bills');
  },

  updatePayment(id, paymentData) {
    return api.put(`/payments/${id}`, paymentData);
  }
};

// Expenses API
const expensesAPI = {
  getExpenses(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/expenses?${queryString}`);
  },

  getExpense(id) {
    return api.get(`/expenses/${id}`);
  },

  createExpense(expenseData) {
    return api.post('/expenses', expenseData);
  },

  updateExpense(id, expenseData) {
    return api.put(`/expenses/${id}`, expenseData);
  },

  deleteExpense(id) {
    return api.delete(`/expenses/${id}`);
  },

  getSummary(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/expenses/summary?${queryString}`);
  },

  getDaily(date) {
    return api.get(`/expenses/daily?date=${date}`);
  }
};

// Reports API
const reportsAPI = {
  getDashboardStats() {
    return api.get('/reports/dashboard');
  },

  getSalesReport(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/reports/sales?${queryString}`);
  },

  getProfitLossReport(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/reports/profit-loss?${queryString}`);
  },

  getPaymentAnalysis(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/reports/payment-analysis?${queryString}`);
  },

  getTrendData(days = 30) {
    return api.get(`/reports/trends?days=${days}`);
  }
};

// Orders API
const ordersAPI = {
  // Cart operations
  getCart() {
    return api.get('/orders/cart');
  },

  addToCart(productId, quantity) {
    return api.post('/orders/cart/add', { productId, quantity });
  },

  updateCartItem(cartItemId, quantity) {
    return api.put(`/orders/cart/${cartItemId}`, { quantity });
  },

  removeFromCart(cartItemId) {
    return api.delete(`/orders/cart/${cartItemId}`);
  },

  clearCart() {
    return api.delete('/orders/cart/clear');
  },

  // Order operations
  placeOrder(orderData) {
    return api.post('/orders/place', orderData);
  },

  getMyOrders() {
    return api.get('/orders/my-orders');
  },

  getShopOrders(status) {
    const queryString = status ? `?status=${status}` : '';
    return api.get(`/orders/shop-orders${queryString}`);
  },

  getOrderDetails(orderId) {
    return api.get(`/orders/${orderId}`);
  },

  getOrderByNumber(orderNumber) {
    return api.get(`/orders/number/${orderNumber}`);
  },

  updateOrderStatus(orderId, statusData) {
    return api.put(`/orders/${orderId}/status`, statusData);
  },

  cancelOrder(orderId) {
    return api.put(`/orders/${orderId}/cancel`);
  },

  processRefund(orderId, refundAmount) {
    return api.post(`/orders/${orderId}/refund`, { refundAmount });
  },

  updateOrderPayment(orderId, paymentData) {
    return api.put(`/orders/${orderId}/payment`, paymentData);
  }
};
