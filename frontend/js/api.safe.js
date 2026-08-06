// Safe API helper (ensures valid api.getHeaders and window.api proxy)
const API_BASE_URL = '/api';

const apiSafe = {
  getToken() { return localStorage.getItem('token'); },
  setToken(token) { localStorage.setItem('token', token); },
  removeToken() { localStorage.removeItem('token'); },

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    try {
      const token = this.getToken();
      if (token) headers['Authorization'] = 'Bearer ' + token;
    } catch (e) { /* ignore */ }
    return headers;
  },

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = { headers: this.getHeaders(), ...options };
    if (config.body && typeof config.body === 'object') config.body = JSON.stringify(config.body);
    const response = await fetch(url, config);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'API Error');
    return data;
  },

  get(endpoint) { return this.request(endpoint, { method: 'GET' }); },
  post(endpoint, body) { return this.request(endpoint, { method: 'POST', body }); },
  put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body }); },
  delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); }
};

// Install as global `api` if original is broken or missing
(function(){
  try {
    if (typeof api === 'undefined') {
      window.api = apiSafe;
    } else {
      // If existing api.getHeaders throws or returns invalid value, replace it
      try {
        const test = api.getHeaders();
        if (!test || typeof test !== 'object') {
          api.getHeaders = apiSafe.getHeaders.bind(apiSafe);
        }
      } catch (e) {
        api.getHeaders = apiSafe.getHeaders.bind(apiSafe);
      }
    }
  } catch (e) {
    window.api = apiSafe;
  }
})();

// Provide minimal authAPI proxy if missing
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
})();