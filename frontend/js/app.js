// Main Application Module
const app = {
  currentPage: 'dashboard',

  // Initialize application
  init() {
    this.setupNavigation();
    this.setupEventListeners();
    this.updateDate();
    
    // Load initial page
    this.navigateTo('dashboard');
    
    // Refresh data every 5 minutes
    setInterval(() => {
      this.refreshCurrentPage();
    }, 300000);
  },

  // Setup navigation
  setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        if (page) {
          this.navigateTo(page);
          // Close sidebar on mobile after navigation
          this.closeMobileSidebar();
        }
      });
    });

    // Profile button in sidebar
    const profileBtn = document.getElementById('user-profile-btn');
    if (profileBtn) {
      profileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.navigateTo('profile');
        this.closeMobileSidebar();
      });
    }
    
    // Setup hamburger menu
    this.setupHamburgerMenu();
  },
  
  // Setup hamburger menu functionality
  setupHamburgerMenu() {
    const hamburger = document.getElementById('hamburger-menu');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    if (!hamburger) return;
    
    // Default state on load for mobile vs desktop
    if (window.innerWidth <= 992) {
      sidebar.classList.add('mobile-hidden');
    } else {
      sidebar.classList.remove('mobile-hidden');
    }

    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      sidebar.classList.toggle('mobile-hidden');
      overlay.classList.toggle('active');
    });
    
    // Close sidebar when clicking overlay
    if (overlay) {
      overlay.addEventListener('click', () => {
        this.closeMobileSidebar();
      });
    }
    
    // Handle window resize dynamically
    window.addEventListener('resize', () => {
      if (window.innerWidth > 992) {
        sidebar.classList.remove('mobile-hidden');
        if (overlay) overlay.classList.remove('active');
        if (hamburger) hamburger.classList.remove('active');
      } else if (!hamburger.classList.contains('active')) {
        sidebar.classList.add('mobile-hidden');
      }
    });
  },
  
  // Close mobile sidebar
  closeMobileSidebar() {
    if (window.innerWidth <= 992) {
      const hamburger = document.getElementById('hamburger-menu');
      const sidebar = document.querySelector('.sidebar');
      const overlay = document.getElementById('sidebar-overlay');
      
      if (hamburger) hamburger.classList.remove('active');
      if (sidebar) sidebar.classList.add('mobile-hidden');
      if (overlay) overlay.classList.remove('active');
    }
  },

  // Setup global event listeners
  setupEventListeners() {
    // Handle browser back/forward
    window.addEventListener('popstate', () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && hash !== this.currentPage) {
        this.navigateTo(hash, false);
      }
    });
  },

  // Navigate to page
  async navigateTo(page, updateHistory = true) {
    // Check if customer is trying to access shopkeeper-only pages
    const isShopkeeper = auth.user?.role === 'shopkeeper';
    const shopkeeperOnlyPages = ['billing', 'payments', 'expenses', 'reports', 'shop-orders'];
    const customerOnlyPages = ['shop', 'cart', 'my-orders'];

    if (!isShopkeeper && shopkeeperOnlyPages.includes(page)) {
      toast.error('Access denied. This page is for shopkeepers only.');
      this.navigateTo('dashboard');
      return;
    }

    if (isShopkeeper && customerOnlyPages.includes(page)) {
      toast.error('This page is for customers only.');
      this.navigateTo('dashboard');
      return;
    }

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.page === page) {
        item.classList.add('active');
      }
    });

    // Hide existing in-DOM pages (fallback sections)
    document.querySelectorAll('.page').forEach(p => {
      p.classList.remove('active');
    });

    // Clear and load the partial into #page-container (SPA partials)
    const container = document.getElementById('page-container');
    if (container) container.innerHTML = '';

    // Update page title mapping
    const titles = {
      dashboard: 'Dashboard',
      billing: 'Billing',
      payments: 'Payments',
      inventory: 'Inventory',
      expenses: 'Expenses',
      reports: 'Reports',
      'my-bills': 'My Bills',
      profile: 'Profile',
      shop: 'Shop Products',
      cart: 'Shopping Cart',
      'my-orders': 'My Orders',
      'shop-orders': 'Manage Orders',
      about: 'About'
    };
    document.getElementById('page-title').textContent = titles[page] || page;

    // Try to load fragment from frontend/pages/<page>.html
    const partialPath = `pages/${page}.html`;
    let loaded = false;
    try {
      const res = await fetch(partialPath);
      if (res.ok) {
        const html = await res.text();
        if (container) container.innerHTML = html;
        // Mark loaded section active if it contains the section wrapper
        const loadedSection = container.querySelector(`#${page}-page`);
        if (loadedSection) loadedSection.classList.add('active');
        loaded = true;
      }
    } catch (err) {
      console.warn('Failed to load partial', partialPath, err);
    }

    // Fallback to existing in-index sections if partial not found
    if (!loaded) {
      const targetPage = document.getElementById(`${page}-page`);
      if (targetPage) {
        targetPage.classList.add('active');
      }
    }

    this.currentPage = page;

    // Load page data
    this.loadPageData(page);

    // Update URL
    if (updateHistory) {
      window.history.pushState({}, '', `#${page}`);
    }
  },

  // Load page-specific data
  loadPageData(page) {
    switch (page) {
      case 'dashboard':
        dashboard.load();
        break;
      case 'billing':
        billing.load();
        break;
      case 'payments':
        payments.load();
        break;
      case 'inventory':
        inventory.load();
        break;
      case 'expenses':
        expenses.load();
        break;
      case 'reports':
        reports.load();
        break;
      case 'my-bills':
        myBills.load();
        break;
      case 'profile':
        profile.load();
        break;
      case 'shop':
        shopping.init();
        break;
      case 'cart':
        shopping.loadCart();
        break;
      case 'my-orders':
        shopping.loadMyOrders();
        break;
      case 'shop-orders':
        shopping.loadShopOrders();
        break;
    }
  },

  // Refresh current page data
  refreshCurrentPage() {
    this.loadPageData(this.currentPage);
  },

  // Update current date display
  updateDate() {
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  }
};

// Global utility function to copy phone number to clipboard
function copyPhoneNumber(phone, event) {
  if (event) {
    event.stopPropagation();
  }
  
  if (!phone || phone === 'N/A' || phone === '-') {
    toast.error('No phone number available');
    return;
  }
  
  navigator.clipboard.writeText(phone).then(() => {
    toast.success('Phone number copied to clipboard!');
  }).catch(err => {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = phone;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    toast.success('Phone number copied to clipboard!');
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize auth module on any page; auth.showAuth/showApp are now defensive
  if (typeof auth !== 'undefined' && typeof auth.init === 'function') {
    auth.init();
  }
});
