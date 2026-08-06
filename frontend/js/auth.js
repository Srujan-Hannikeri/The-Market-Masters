// Authentication Module
const auth = {
  user: null,

  // Initialize auth
  init() {
    this.checkAuth();
    this.setupEventListeners();
  },

  // Check if user is authenticated
  async checkAuth() {
    const token = api.getToken();

    // If we're on the login page (no app shell present), avoid trying to boot the app even if a token exists.
    // This prevents the login UI from being hidden on index.html when app.html isn't loaded here.
    const appShellPresent = !!document.getElementById('app-container');

    if (token && appShellPresent) {
      try {
        const response = await authAPI.getProfile();
        this.user = response.user;
        this.showApp();
      } catch (error) {
        console.error('Auth check failed:', error?.message || error);
        // Clear invalid token and redirect to login
        api.removeToken();
        this.user = null;
        this.showAuth();
        toast.error('Session expired. Please login again.');
      }
    } else {
      // No token or not on app shell — ensure auth UI is shown on this page
      this.showAuth();
    }
  },

  // Setup event listeners
  setupEventListeners() {
    // Login form
    document.getElementById('login-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // Register form
    document.getElementById('register-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleRegister();
    });

    // Switch between login/register
    document.getElementById('show-register')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleAuthForms('register');
    });

    document.getElementById('show-login')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleAuthForms('login');
    });

    // Forgot password links
    document.getElementById('show-forgot-password')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleAuthForms('forgot-password');
    });

    document.getElementById('show-login-from-forgot')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleAuthForms('login');
    });

    // Developer Info link
    document.getElementById('show-developer')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleAuthForms('developer');
    });

    document.getElementById('show-login-from-dev')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleAuthForms('login');
    });

    // Send OTP button
    document.getElementById('send-otp-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleSendOTP();
    });

    // Verify OTP button
    document.getElementById('verify-otp-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleVerifyOTP();
    });

    // Role change in register form
    document.getElementById('reg-role')?.addEventListener('change', (e) => {
      const shopkeeperFields = document.querySelectorAll('.shopkeeper-only');
      shopkeeperFields.forEach(field => {
        field.style.display = e.target.value === 'shopkeeper' ? 'block' : 'none';
      });
    });

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', () => {
      this.logout();
    });
  },

  // Handle login
  async handleLogin() {
    const phone = document.getElementById('login-phone').value;
    const password = document.getElementById('login-password').value;
    const submitBtn = document.querySelector('#login-form button[type="submit"]');

    setLoading(submitBtn, true);

    try {
      const response = await authAPI.login(phone, password);
      api.setToken(response.token);
      this.user = response.user;
      toast.success('Login successful!');
      
      // Clear any previous session data
      this.clearSessionData();
      
      // Redirect to the app shell (app.html) where the SPA runs
      window.location.href = 'app.html';
    } catch (error) {
      console.error('Login error:', error);
      
      // Show specific message for database errors
      if (error.message.includes('Database connection') || error.message.includes('Service Unavailable')) {
        toast.error('⚠ Database not configured. Please run MySQL-Setup.bat first!');
        setTimeout(() => {
          alert(
            'Database Connection Required\n\n' +
            'To login, you need to configure MySQL database first.\n\n' +
            'Please follow these steps:\n' +
            '1. Close this window\n' +
            '2. Run "MySQL-Setup.bat"\n' +
            '3. Enter your MySQL password\n' +
            '4. Restart the application with "Start.bat"\n\n' +
            'See QUICK-START.md for detailed instructions.'
          );
        }, 500);
      } else {
        toast.error(error.message || 'Login failed');
      }
    } finally {
      setLoading(submitBtn, false);
    }
  },

  // Handle register
  async handleRegister() {
    const userData = {
      name: document.getElementById('reg-name').value,
      phone: document.getElementById('reg-phone').value,
      email: document.getElementById('reg-email').value,
      password: document.getElementById('reg-password').value,
      role: document.getElementById('reg-role').value,
      shopName: document.getElementById('reg-shop-name').value,
      shopAddress: document.getElementById('reg-shop-address').value
    };

    const submitBtn = document.querySelector('#register-form button[type="submit"]');
    setLoading(submitBtn, true);

    try {
      const response = await authAPI.register(userData);
      api.setToken(response.token);
      this.user = response.user;
      toast.success('Registration successful!');
      
      // Clear any previous session data
      this.clearSessionData();
      
      // Redirect to the app shell (app.html) where the SPA runs
      window.location.href = 'app.html';
    } catch (error) {
      console.error('Registration error:', error);
      
      // Show specific message for database errors
      if (error.message.includes('Database connection') || error.message.includes('Service Unavailable')) {
        toast.error('⚠ Database not configured. Please run MySQL-Setup.bat first!');
        setTimeout(() => {
          alert(
            'Database Connection Required\n\n' +
            'To register, you need to configure MySQL database first.\n\n' +
            'Please follow these steps:\n' +
            '1. Close this window\n' +
            '2. Run "MySQL-Setup.bat"\n' +
            '3. Enter your MySQL password\n' +
            '4. Restart the application with "Start.bat"\n\n' +
            'See QUICK-START.md for detailed instructions.'
          );
        }, 500);
      } else {
        toast.error(error.message || 'Registration failed');
      }
    } finally {
      setLoading(submitBtn, false);
    }
  },

  // Toggle between login and register forms
  toggleAuthForms(show) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const developerBox = document.getElementById('developer-box');

    // Hide all forms first
    loginForm?.classList.add('hidden');
    registerForm?.classList.add('hidden');
    forgotPasswordForm?.classList.add('hidden');
    developerBox?.classList.add('hidden');

    // Show the requested form
    if (show === 'register') {
      registerForm?.classList.remove('hidden');
    } else if (show === 'developer') {
      developerBox?.classList.remove('hidden');
    } else if (show === 'forgot-password') {
      forgotPasswordForm?.classList.remove('hidden');
      // Reset forgot password form to step 1
      document.getElementById('forgot-password-step-1')?.classList.remove('hidden');
      document.getElementById('forgot-password-step-2')?.classList.add('hidden');
      document.getElementById('forgot-phone').value = '';
      document.getElementById('otp-input').value = '';
      document.getElementById('new-password').value = '';
    } else {
      loginForm?.classList.remove('hidden');
    }
  },

  // Show auth container
  showAuth() {
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    if (authContainer) {
      authContainer.classList.remove('hidden');
      if (appContainer) appContainer.classList.add('hidden');
    } else {
      // If auth container is not present (we're on app.html), redirect to login (index.html)
      try { window.location.href = 'index.html'; } catch (e) { console.warn('showAuth redirect failed', e); }
    }
  },

  // Show app container
  showApp() {
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    if (authContainer) authContainer.classList.add('hidden');
    if (appContainer) appContainer.classList.remove('hidden');

    // Update user info if elements exist
    const userNameEl = document.getElementById('user-name');
    const userRoleEl = document.getElementById('user-role');
    if (userNameEl) userNameEl.textContent = this.user?.name || 'User';
    if (userRoleEl) userRoleEl.textContent = this.user?.role || '';

    // Show/hide shopkeeper-only elements
    const shopkeeperElements = document.querySelectorAll('.shopkeeper-only');
    shopkeeperElements.forEach(el => {
      try { el.style.display = this.user?.role === 'shopkeeper' ? 'block' : 'none'; } catch(e){}
    });

    // Show/hide sidebar nav items based on role
    const shopkeeperNavItems = document.querySelectorAll('.nav-item[data-page="billing"], .nav-item[data-page="payments"], .nav-item[data-page="expenses"], .nav-item[data-page="reports"], .nav-item[data-page="shop-orders"]');
    shopkeeperNavItems.forEach(el => { try { el.style.display = this.user?.role === 'shopkeeper' ? 'flex' : 'none'; } catch(e){} });

    // Show customer-only nav items
    const customerNavItems = document.querySelectorAll('.nav-item[data-page="shop"], .nav-item[data-page="cart"], .nav-item[data-page="my-orders"]');
    customerNavItems.forEach(el => { try { el.style.display = this.user?.role === 'customer' ? 'flex' : 'none'; } catch(e){} });

    // Show My Bills only for customers
    const myBillsNav = document.querySelector('.nav-item[data-page="my-bills"]');
    if (myBillsNav) {
      try { myBillsNav.style.display = this.user?.role === 'customer' ? 'flex' : 'none'; } catch(e){}
    }

    // Rename Inventory to Products for customers
    const inventoryNav = document.querySelector('.nav-item[data-page="inventory"] span');
    if (inventoryNav) {
      try { inventoryNav.textContent = this.user?.role === 'shopkeeper' ? 'Inventory' : 'Products'; } catch(e){}
    }
    
    // Update cart count for customers
    try {
      if (this.user?.role === 'customer' && typeof shopping !== 'undefined') {
        shopping.updateCartCount();
      }
    } catch (e) {}

    // Initialize app if available
    try { if (typeof app !== 'undefined' && typeof app.init === 'function') app.init(); } catch(e) {}
  },


  // Logout
  logout() {
    api.removeToken();
    this.user = null;
    
    // Clear all session data
    this.clearSessionData();
    
    // If auth container exists on this page, show it; otherwise redirect to login (index.html)
    const authContainer = document.getElementById('auth-container');
    if (authContainer) {
      this.showAuth();
    } else {
      try { window.location.href = 'index.html'; } catch (e) { console.warn('logout redirect failed', e); }
    }
    toast.info('Logged out successfully');
  },


  // Clear session data from previous account
  clearSessionData() {
    // Reset shopping cart
    if (typeof shopping !== 'undefined') {
      shopping.cart = [];
      shopping.products = [];
      shopping.currentOrder = null;
    }
    
    // Reset billing module
    if (typeof billing !== 'undefined') {
      billing.products = [];
      billing.billItems = [];
      billing.currentBill = null;
      billing.listenersSetup = false;
      
      // Clear bill items container
      const billItemsContainer = document.getElementById('bill-items-container');
      if (billItemsContainer) {
        billItemsContainer.innerHTML = '';
      }
    }
    
    // Reset inventory module
    if (typeof inventory !== 'undefined') {
      inventory.products = [];
    }
    
    // Reset my bills
    if (typeof myBills !== 'undefined') {
      myBills.bills = [];
    }
    
    // Reset dashboard
    if (typeof dashboard !== 'undefined') {
      if (dashboard.trendChart) {
        dashboard.trendChart.destroy();
        dashboard.trendChart = null;
      }
      if (dashboard.paymentChart) {
        dashboard.paymentChart.destroy();
        dashboard.paymentChart = null;
      }
    }
    
    // Reset payments
    if (typeof payments !== 'undefined') {
      payments.pendingDues = [];
      payments.recentPayments = [];
    }
    
    // Reset reports
    if (typeof reports !== 'undefined') {
      reports.reports = {};
    }
    
    // Clear any cached data in sessionStorage
    sessionStorage.clear();
  },

  // Check if user is shopkeeper
  isShopkeeper() {
    return this.user?.role === 'shopkeeper';
  },

  // Handle send OTP for forgot password
  async handleSendOTP() {
    const phone = document.getElementById('forgot-phone').value;
    const sendBtn = document.getElementById('send-otp-btn');

    if (!phone) {
      toast.error('Please enter your phone number');
      return;
    }

    setLoading(sendBtn, true);

    try {
      const response = await authAPI.sendOTP(phone);
      toast.success('OTP sent successfully! Check your SMS.');
      
      // Move to step 2
      document.getElementById('forgot-password-step-1').classList.add('hidden');
      document.getElementById('forgot-password-step-2').classList.remove('hidden');
    } catch (error) {
      toast.error(error.message || 'Failed to send OTP');
    } finally {
      setLoading(sendBtn, false);
    }
  },

  // Handle verify OTP and reset password
  async handleVerifyOTP() {
    const phone = document.getElementById('forgot-phone').value;
    const otp = document.getElementById('otp-input').value;
    const newPassword = document.getElementById('new-password').value;
    const verifyBtn = document.getElementById('verify-otp-btn');

    if (!otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(verifyBtn, true);

    try {
      await authAPI.verifyOTPAndResetPassword(phone, otp, newPassword);
      toast.success('Password reset successfully! Please login with your new password.');
      
      // Reset form and go to login
      document.getElementById('forgot-password-step-1').classList.remove('hidden');
      document.getElementById('forgot-password-step-2').classList.add('hidden');
      document.getElementById('forgot-phone').value = '';
      document.getElementById('otp-input').value = '';
      document.getElementById('new-password').value = '';
      this.toggleAuthForms('login');
    } catch (error) {
      toast.error(error.message || 'Failed to reset password');
    } finally {
      setLoading(verifyBtn, false);
    }
  }
};

// Password Toggle Function (Global)
function togglePasswordVisibility(inputId, icon) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}
