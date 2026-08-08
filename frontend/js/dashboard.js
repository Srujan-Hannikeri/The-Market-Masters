// Dashboard Module
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
      alertBox.style.display = "none";
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
    if (alertBox) alertBox.style.display = "none";

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
    // Only shopkeepers should see low stock alerts
    const isShopkeeper = auth.user?.role === "shopkeeper";
    if (!isShopkeeper) {
      // Hide low stock alert for customers
      const alertBox = document.getElementById("low-stock-alert");
      if (alertBox) {
        alertBox.style.display = "none";
      }
      return;
    }

    try {
      // Get inventory products
      const response = await inventoryAPI.getProducts();
      const products = response.products || [];

      // Filter low stock products (stock <= lowStockThreshold)
      const lowStockProducts = products.filter((p) => {
        const stock = parseInt(p.stock) || 0;
        const threshold = parseInt(p.minStock || p.lowStockThreshold) || 10;
        return stock <= threshold && stock > 0;
      });

      const outOfStockProducts = products.filter((p) => {
        const stock = parseInt(p.stock) || 0;
        return stock === 0;
      });

      // Show alert if there are low stock or out of stock products
      const alertBox = document.getElementById("low-stock-alert");
      const productsContainer = document.getElementById("low-stock-products");

      if (!alertBox || !productsContainer) {

        return;
      }

      if (lowStockProducts.length > 0 || outOfStockProducts.length > 0) {
        let html = "";

        // Out of stock products first (more critical)
        outOfStockProducts.forEach((product) => {
          html += `
            <div class="low-stock-product" onclick="app.navigateTo('inventory')" style="cursor: pointer;">
              <i class="fas fa-exclamation-circle"></i>
              <div>
                <div class="product-name">${product.name}</div>
                <div class="product-stock" style="color: #e74c3c; font-weight: bold;">OUT OF STOCK</div>
              </div>
            </div>
          `;
        });

        // Low stock products
        lowStockProducts.forEach((product) => {
          const threshold = parseInt(product.minStock || product.lowStockThreshold) || 10;
          html += `
            <div class="low-stock-product" onclick="app.navigateTo('inventory')" style="cursor: pointer;">
              <i class="fas fa-exclamation-triangle"></i>
              <div>
                <div class="product-name">${product.name}</div>
                <div class="product-stock">Stock: ${product.stock}/${threshold} units</div>
              </div>
            </div>
          `;
        });

        productsContainer.innerHTML = html;
        alertBox.style.display = "block";

      } else {
        alertBox.style.display = "none";
        }
    } catch (error) {
      console.error("Low stock check error:", error);
    }
  },
};

// Global function to close low stock alert
function closeLowStockAlert(event) {
  if (event) {
    event.stopPropagation();
  }
  const alertBox = document.getElementById("low-stock-alert");
  if (alertBox) {
    alertBox.style.display = "none";
  }
}
