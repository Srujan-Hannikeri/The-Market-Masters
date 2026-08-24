// Dashboard Module
const parseExpiryCalendarDate = (value) => {
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatExpiryStatus = (value, today) => {
  const expiry = parseExpiryCalendarDate(value);
  const days = Math.round((expiry - today) / 86400000);
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  if (days === -1) return 'Expired yesterday';
  if (days < -1) return `Expired ${Math.abs(days)} days ago`;
  return `Expires in ${days} days`;
};

const dashboard = {
  trendChart: null,
  paymentChart: null,
  lowStockInterval: null,

  // Stop all background polls — called by app.js on navigate
  stop() {
    if (this.lowStockInterval) {
      clearInterval(this.lowStockInterval);
      this.lowStockInterval = null;
    }
  },

  async load() {
    try {
      // Wait for auth user to be available, but only if still on dashboard
      if (!auth.user) {
        setTimeout(() => {
          if (app.currentPage === 'dashboard') this.load();
        }, 100);
        return;
      }
      // Check if user is shopkeeper
      const isShopkeeper = auth.user?.role === "shopkeeper";

      // Reset view first to clear any previous state
      this.resetView();

      if (isShopkeeper) {
        const response = await reportsAPI.getDashboardStats();
        this.renderStats(response.stats);
        this.renderBillsByStatus(response.billsByStatus);
        this.renderRecentBills(response.recentBills);
        await this.loadCharts();

        // Check and display low stock alerts
        this.checkLowStock();

        // Quiet low-stock poll every 5 minutes (not 30s — less noise)
        if (!this.lowStockInterval) {
          this.lowStockInterval = setInterval(() => {
            if (typeof app !== 'undefined' && app.currentPage === 'dashboard') {
              this.checkLowStock();
            } else {
              this.stopLowStock();
            }
          }, 300000);
        }
      } else {
        // Customer view - show welcome message
        this.renderCustomerView();
      }
    } catch (error) {
      console.error("Dashboard load error:", error);
      if (error.message?.includes("Shopkeeper only")) {
        this.renderCustomerView();
      } else {
        toast.error("Failed to load dashboard data");
      }
    }
  },

  resetView() {
    // Remove customer welcome if exists
    const customerWelcome = document.getElementById("customer-welcome");
    if (customerWelcome) {
      customerWelcome.remove();
    }

    // Show all shopkeeper elements (they'll be hidden again if needed)
    const statsGrid = document.querySelector(".stats-grid");
    const dashboardGrid = document.querySelector(".dashboard-grid");
    const recentBillsCard = document.getElementById("recent-bills-card");

    if (statsGrid) statsGrid.style.display = "grid";
    if (dashboardGrid) dashboardGrid.style.display = "grid";
    if (recentBillsCard) recentBillsCard.style.display = "block";

    // Hide low stock alert for customers
    const alertBox = document.getElementById("low-stock-alert");
    if (alertBox && auth.user?.role !== "shopkeeper") {
      alertBox.classList.add('hidden');
      alertBox.style.display = 'none';
    }
  },

  renderCustomerView() {
    // First reset any shopkeeper views
    this.resetView();

    // Hide shopkeeper-only dashboard elements
    const statsGrid = document.querySelector(".stats-grid");
    const dashboardGrid = document.querySelector(".dashboard-grid");
    const recentBillsCard = document.getElementById("recent-bills-card");
    const alertBox = document.getElementById("low-stock-alert");

    if (statsGrid) statsGrid.style.display = "none";
    if (dashboardGrid) dashboardGrid.style.display = "none";
    if (recentBillsCard) recentBillsCard.style.display = "none";
    if (alertBox) {
      alertBox.classList.add('hidden');
      alertBox.style.display = 'none';
    }

    // Show customer welcome
    const container = document.querySelector("#dashboard-page");
    if (container && !document.getElementById("customer-welcome")) {
      const welcomeDiv = document.createElement("div");
      welcomeDiv.id = "customer-welcome";
      welcomeDiv.innerHTML = `
        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-body text-center" style="padding: 3rem;">
            <i class="fas fa-shopping-bag" style="font-size: 4rem; color: var(--primary); margin-bottom: 1rem;"></i>
            <h2>Welcome, ${auth.user?.name || "Customer"}!</h2>
            <p style="margin: 1rem 0; color: var(--gray);">Browse our products and shop online.</p>
            <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
              <button class="btn btn-primary" onclick="app.navigateTo('inventory')">
                <i class="fas fa-store"></i> Browse Products
              </button>
              <button class="btn btn-secondary" onclick="app.navigateTo('my-bills')">
                <i class="fas fa-receipt"></i> My Bills
              </button>
            </div>
          </div>
        </div>
        
        <div class="card">
          <div class="card-header">
            <h3>Quick Links</h3>
          </div>
          <div class="card-body">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
              <div class="quick-link-card" onclick="app.navigateTo('inventory')" style="cursor: pointer; padding: 1.5rem; border: 1px solid var(--gray-light); border-radius: var(--radius); text-align: center; transition: all 0.3s;">
                <i class="fas fa-boxes" style="font-size: 2rem; color: var(--primary); margin-bottom: 0.5rem;"></i>
                <h4>Products</h4>
                <p style="color: var(--gray); font-size: 0.9rem;">Browse our catalog</p>
              </div>
              <div class="quick-link-card" onclick="app.navigateTo('my-bills')" style="cursor: pointer; padding: 1.5rem; border: 1px solid var(--gray-light); border-radius: var(--radius); text-align: center; transition: all 0.3s;">
                <i class="fas fa-receipt" style="font-size: 2rem; color: var(--success); margin-bottom: 0.5rem;"></i>
                <h4>My Bills</h4>
                <p style="color: var(--gray); font-size: 0.9rem;">View your purchases</p>
              </div>
              <div class="quick-link-card" onclick="app.navigateTo('profile')" style="cursor: pointer; padding: 1.5rem; border: 1px solid var(--gray-light); border-radius: var(--radius); text-align: center; transition: all 0.3s;">
                <i class="fas fa-user" style="font-size: 2rem; color: var(--info); margin-bottom: 0.5rem;"></i>
                <h4>Profile</h4>
                <p style="color: var(--gray); font-size: 0.9rem;">Manage your account</p>
              </div>
            </div>
          </div>
        </div>
      `;
      container.insertBefore(welcomeDiv, container.firstChild);
    }
  },

  renderStats(stats) {
    const todaySales     = document.getElementById("today-sales");
    const todayExpenses  = document.getElementById("today-expenses");
    const todayProfit    = document.getElementById("today-profit");
    const pendingDues    = document.getElementById("pending-dues");

    if (todaySales)    todaySales.textContent    = formatCurrency(stats.todaySales);
    if (todayExpenses) todayExpenses.textContent = formatCurrency(stats.todayExpenses);
    if (todayProfit)   todayProfit.textContent   = formatCurrency(stats.todayProfit);
    if (pendingDues)   pendingDues.textContent   = formatCurrency(stats.pendingAmount);
  },

  renderBillsByStatus(data) {
    const ctx = document.getElementById("payment-chart");
    if (!ctx) return;

    if (this.paymentChart) {
      this.paymentChart.destroy();
    }

    this.paymentChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: Object.keys(data),
        datasets: [
          {
            data: Object.values(data),
            backgroundColor: ["#10b981", "#ef4444", "#f59e0b"],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
          },
        },
      },
    });
  },

  renderRecentBills(bills) {
    const tbody = document.getElementById("recent-bills-table");
    if (!tbody) return;

    tbody.innerHTML = bills
      .map(
        (bill) => `
      <tr>
        <td>${bill.billNumber}</td>
        <td>${bill.customerName || "Walk-in"}</td>
        <td>${formatCurrency(bill.totalAmount)}</td>
        <td>${getStatusBadge(bill.paymentStatus)}</td>
        <td>${formatDate(bill.created_at)}</td>
      </tr>
    `,
      )
      .join("");
  },

  async loadCharts() {
    try {
      const trendData = await reportsAPI.getTrendData(30);
      this.renderTrendChart(trendData);
    } catch (error) {
      console.error("Failed to load trend data:", error);
    }
  },

  renderTrendChart(data) {
    const ctx = document.getElementById("trend-chart");
    if (!ctx) return;

    if (this.trendChart) {
      this.trendChart.destroy();
    }

    const allDates = [
      ...new Set([
        ...data.sales.map((s) => s.date),
        ...data.expenses.map((e) => e.date),
      ]),
    ].sort();

    const salesData = allDates.map((date) => {
      const sale = data.sales.find((s) => s.date === date);
      return sale ? sale.amount : 0;
    });

    const expenseData = allDates.map((date) => {
      const expense = data.expenses.find((e) => e.date === date);
      return expense ? expense.amount : 0;
    });

    this.trendChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: allDates.map((d) =>
          new Date(d).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
          }),
        ),
        datasets: [
          {
            label: "Sales",
            data: salesData,
            borderColor: "#4f46e5",
            backgroundColor: "rgba(79, 70, 229, 0.1)",
            fill: true,
            tension: 0.4,
          },
          {
            label: "Expenses",
            data: expenseData,
            borderColor: "#ef4444",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => "₹" + value,
            },
          },
        },
      },
    });
  },

  async checkLowStock() {
    const isShopkeeper = auth.user?.role === "shopkeeper";
    const alertBox = document.getElementById("low-stock-alert");
    if (!isShopkeeper) {
      if (alertBox) alertBox.style.display = "none";
      return;
    }

    try {
      const response = await inventoryAPI.getProducts();
      const products = response.products || [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const in10Days = new Date(today);
      in10Days.setDate(in10Days.getDate() + 10);

      const expiredProducts = products.filter(p => {
        if (!p.expiryDate) return false;
        return parseExpiryCalendarDate(p.expiryDate) < today;
      });

      const soonExpiringProducts = products.filter(p => {
        if (!p.expiryDate) return false;
        const exp = parseExpiryCalendarDate(p.expiryDate);
        return exp >= today && exp <= in10Days;
      });

      const outOfStockProducts = products.filter(p => parseInt(p.stock) === 0);

      const lowStockProducts = products.filter(p => {
        const stock = parseInt(p.stock) || 0;
        const threshold = parseInt(p.minStock || p.lowStockThreshold) || 10;
        return stock > 0 && stock <= threshold;
      });

      const productsContainer = document.getElementById("low-stock-products");
      if (!alertBox || !productsContainer) return;

      const hasExpiry = expiredProducts.length > 0 || soonExpiringProducts.length > 0;
      const hasStock = outOfStockProducts.length > 0 || lowStockProducts.length > 0;
      const hasAny = hasExpiry || hasStock;

      if (!hasAny) {
        alertBox.classList.add("hidden");
        alertBox.style.display = "none";
        return;
      }

      // Update title and icon dynamically
      const titleEl = document.getElementById("alert-header-title");
      const iconEl = document.getElementById("alert-header-icon");
      if (hasExpiry && hasStock) {
        if (titleEl) titleEl.textContent = "Stock & Expiry Alert!";
        if (iconEl) { iconEl.className = "fas fa-exclamation-triangle"; iconEl.style.color = ""; }
      } else if (hasExpiry) {
        if (titleEl) titleEl.textContent = "Expiry Date Alert!";
        if (iconEl) { iconEl.className = "fas fa-calendar-times"; iconEl.style.color = "#e74c3c"; }
      } else {
        if (titleEl) titleEl.textContent = "Low Stock Alert!";
        if (iconEl) { iconEl.className = "fas fa-exclamation-triangle"; iconEl.style.color = ""; }
      }

      let html = "";

      // ── EXPIRY SECTION ──────────────────────────────
      if (hasExpiry) {
        html += `<div class="alert-section-title" style="
          font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px;
          color:#92400e; margin:8px 0 6px; padding:4px 8px;
          background:rgba(239,68,68,0.10); border-radius:4px; display:flex; align-items:center; gap:5px;
        "><i class='fas fa-calendar-times'></i> Expiry Alerts</div>`;

        expiredProducts.forEach(p => {
          html += `
            <div class="low-stock-product expiry-alert expired" onclick="dashboard.openProductExpense('${p.name.replace(/'/g, "\\'")}')" style="cursor:pointer;">
              <i class="fas fa-calendar-times" style="color:#ef4444;"></i>
              <div>
                <div class="product-name">${p.name}</div>
                <div class="product-stock" style="color:#ef4444;font-weight:700;">🚨 ${formatExpiryStatus(p.expiryDate, today)} • ${parseExpiryCalendarDate(p.expiryDate).toLocaleDateString('en-IN')}</div>
              </div>
            </div>`;
        });

        soonExpiringProducts.forEach(p => {
          html += `
            <div class="low-stock-product expiry-alert expiring" onclick="dashboard.openProductExpense('${p.name.replace(/'/g, "\\'")}')" style="cursor:pointer;">
              <i class="fas fa-clock" style="color:#f59e0b;"></i>
              <div>
                <div class="product-name">${p.name}</div>
                <div class="product-stock" style="color:#d97706;font-weight:600;">${formatExpiryStatus(p.expiryDate, today)} • ${parseExpiryCalendarDate(p.expiryDate).toLocaleDateString('en-IN')}</div>
              </div>
            </div>`;
        });
      }

      // ── STOCK SECTION ───────────────────────────────
      if (hasStock) {
        html += `<div class="alert-section-title" style="
          font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px;
          color:#92400e; margin:${hasExpiry ? '12px' : '8px'} 0 6px; padding:4px 8px;
          background:rgba(245,158,11,0.12); border-radius:4px; display:flex; align-items:center; gap:5px;
        "><i class='fas fa-exclamation-triangle'></i> Stock Alerts</div>`;

        outOfStockProducts.forEach(p => {
          html += `
            <div class="low-stock-product" onclick="dashboard.openProductExpense('${p.name.replace(/'/g, "\\'")}')" style="cursor:pointer;">
              <i class="fas fa-exclamation-circle" style="color:#ef4444;"></i>
              <div>
                <div class="product-name">${p.name}</div>
                <div class="product-stock" style="color:#ef4444;font-weight:700;">OUT OF STOCK</div>
              </div>
            </div>`;
        });

        lowStockProducts.forEach(p => {
          const threshold = parseInt(p.minStock || p.lowStockThreshold) || 10;
          html += `
            <div class="low-stock-product" onclick="dashboard.openProductExpense('${p.name.replace(/'/g, "\\'")}')" style="cursor:pointer;">
              <i class="fas fa-exclamation-triangle" style="color:#f59e0b;"></i>
              <div>
                <div class="product-name">${p.name}</div>
                <div class="product-stock">Stock: <strong>${p.stock}</strong> / ${threshold} units</div>
              </div>
            </div>`;
        });
      }

      productsContainer.innerHTML = html;
      alertBox.classList.remove("hidden");
      alertBox.style.display = "block";

    } catch (error) {
      console.error("checkLowStock error:", error);
    }
  },

  async openProductExpense(productName) {
    app.navigateTo('expenses');
    try {
      const response = await expensesAPI.getExpenses();
      const expensesList = response.expenses || [];
      const expense = expensesList.find(e => {
        if (e.description && e.description.startsWith('JSONMETA:')) {
           try {
             const meta = JSON.parse(e.description.replace('JSONMETA:', ''));
             return meta.items && meta.items.some(i => i.name === productName);
           } catch(err) {}
        }
        return false;
      });
      if (expense) {
        const expenseId = expense.id || expense._id;
        // Give the expenses page time to fully render before opening modal
        setTimeout(() => {
          if (typeof expenses !== 'undefined' && expenses.viewExpenseDetails) {
            expenses.viewExpenseDetails(expenseId);
          }
        }, 600);
      } else {
        toast.info("No expense bill found for this product.");
      }
    } catch (error) {
      console.error("openProductExpense error:", error);
    }
  }
};

// Global function to close low stock alert
function closeLowStockAlert(event) {
  if (event) {
    event.stopPropagation();
  }
  const alertBox = document.getElementById("low-stock-alert");
  if (alertBox) {
    alertBox.classList.add('hidden');
    alertBox.style.display = 'none';
  }
}
