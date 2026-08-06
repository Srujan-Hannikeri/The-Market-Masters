// API Configuration - Same origin (combined server)
const API_BASE_URL = '/api';

// API Helper Functions (fixed safe copy)
const apiFixed2 = {
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

  // Get auth headers (fixed)
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
      console.error('API Fixed2 Error:', error);
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

// Expose wrapper to match existing authAPI etc expectations by proxying to apiFixed2
(function(){
  if (typeof api === 'undefined') {
    window.api = apiFixed2;
  } else {
    try {
      const test = api.getHeaders && api.getHeaders();
      if (!test || typeof test !== 'object') {
        api.getHeaders = apiFixed2.getHeaders.bind(apiFixed2);
      }
    } catch (e) {
      api.getHeaders = apiFixed2.getHeaders.bind(apiFixed2);
    }
  }
})();

// Minimal proxies for commonly used API groups if missing
(function(){
  if (typeof authAPI === 'undefined') {
    window.authAPI = {
      login: (phone, password) => api.post('/auth/login', { phone, password }),
      register: (userData) => api.post('/auth/register', userData),
      getProfile: () => api.get('/auth/profile'),
      updateProfile: (userData) => api.put('/auth/profile', userData),
      sendOTP: (phone) => api.post('/auth/forgot-password/send-otp', { phone }),
      verifyOTPAndResetPassword: (phone, otp, newPassword) => api.post('/auth/forgot-password/verify-otp', { phone, otp, newPassword })
    };
  }

  function ensureProxy(name, builder) {
    if (typeof window[name] === 'undefined') window[name] = builder(api);
  }

  ensureProxy('inventoryAPI', (a) => ({
    getProducts: (params = {}) => { const qs = new URLSearchParams(params).toString(); return a.get(`/inventory?${qs}`); },
    getProduct: (id) => a.get(`/inventory/${id}`),
    createProduct: (data) => a.post('/inventory', data),
    updateProduct: (id, data) => a.put(`/inventory/${id}`, data),
    deleteProduct: (id) => a.delete(`/inventory/${id}`),
    getLowStock: () => a.get('/inventory/low-stock'),
    getExpiring: (days=30) => a.get(`/inventory/expiring?days=${days}`),
    updateStock: (id, quantity) => a.request(`/inventory/${id}/stock`, { method: 'PATCH', body: { quantity } })
  }));

  ensureProxy('billsAPI', (a) => ({
    getBills: (params={}) => a.get(`/bills?${new URLSearchParams(params).toString()}`),
    getBill: (id) => a.get(`/bills/${id}`),
    createBill: (data) => a.post('/bills', data),
    updateBill: (id, data) => a.put(`/bills/${id}`, data),
    deleteBill: (id) => a.delete(`/bills/${id}`),
    generatePDF: (id, format='standard') => a.post(`/bills/${id}/pdf?format=${format}`),
    sendWhatsApp: (id) => a.post(`/bills/${id}/whatsapp`),
    getPendingBills: () => a.get('/bills/pending'),
    getMyBills: () => a.get('/bills/my-bills'),
    makePayment: (billId, paymentData) => a.post(`/bills/${billId}/payment`, paymentData)
  }));

  ensureProxy('ordersAPI', (a) => ({
    getCart: () => a.get('/orders/cart'),
    addToCart: (productId, qty) => a.post('/orders/cart/add', { productId, quantity: qty }),
    updateCartItem: (cartItemId, quantity) => a.put(`/orders/cart/${cartItemId}`, { quantity }),
    removeFromCart: (cartItemId) => a.delete(`/orders/cart/${cartItemId}`),
    clearCart: () => a.delete('/orders/cart/clear'),
    placeOrder: (data) => a.post('/orders/place', data),
    getMyOrders: () => a.get('/orders/my-orders'),
    getShopOrders: (status) => a.get(`/orders/shop-orders${status ? `?status=${status}` : ''}`),
    getOrderDetails: (id) => a.get(`/orders/${id}`),
    getOrderByNumber: (num) => a.get(`/orders/number/${num}`),
    updateOrderStatus: (id, statusData) => a.put(`/orders/${id}/status`, statusData),
    cancelOrder: (id) => a.put(`/orders/${id}/cancel`),
    processRefund: (id, refundAmount) => a.post(`/orders/${id}/refund`, { refundAmount }),
    updateOrderPayment: (id, paymentData) => a.put(`/orders/${id}/payment`, paymentData)
  }));
})();
