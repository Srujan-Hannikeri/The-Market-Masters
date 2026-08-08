// Reports Module
const reports = {
  salesChart: null,
  paymentModeChart: null,
  listenersSetup: false,

  load() {
    if (!this.listenersSetup) {
      this.setupEventListeners();
      this.listenersSetup = true;
    }
    this.setDefaultDates();
    this.loadReportData();
  },

  setupEventListeners() {
    document.getElementById('generate-report-btn')?.addEventListener('click', () => {
      this.loadReportData();
    });
  },

  setDefaultDates() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const startEl = document.getElementById('report-start-date');
    const endEl   = document.getElementById('report-end-date');
    if (startEl) startEl.value = todayStr;
    if (endEl)   endEl.value   = todayStr;
  },

  async loadReportData() {
    const startDate = document.getElementById('report-start-date')?.value;
    const endDate = document.getElementById('report-end-date')?.value;
    const params = { startDate, endDate };

    try {
      const [salesData, profitLossData, paymentAnalysis, billsData] = await Promise.all([
        reportsAPI.getSalesReport(params),
        reportsAPI.getProfitLossReport(params),
        reportsAPI.getPaymentAnalysis(params),
        billsAPI.getBills({ startDate, endDate, limit: 1000 })
      ]);

      // Store bills for customer breakdown view
      this.currentBills = billsData.bills || [];

      this.renderSalesChart(salesData.sales);
      this.renderPaymentModeChart(paymentAnalysis.analysis);
      this.renderProfitLossSummary(profitLossData.summary);
      this.renderCustomerBreakdown(this.currentBills);

      // Setup live update interval - refresh reports every 10 seconds
      if (!this.liveUpdateInterval) {

        this.liveUpdateInterval = setInterval(() => {

          this.loadReportData();
        }, 10000);
      }
    } catch (error) {
      console.error('Failed to load report data:', error);
    }
  },

  renderSalesChart(sales) {
    const ctx = document.getElementById('sales-trend-chart');
    if (!ctx) return;

    if (this.salesChart) {
      this.salesChart.destroy();
    }

    this.salesChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: sales.map(s => s.date),
        datasets: [{
          label: 'Sales Trend',
          data: sales.map(s => parseFloat(s.totalSales)),
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79, 70, 229, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#4f46e5',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function(context) {
                return 'Sales: ₹' + context.parsed.y.toLocaleString();
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => '₹' + value
            }
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    });
  },

  renderPaymentModeChart(analysis) {
    const ctx = document.getElementById('payment-mode-chart');
    if (!ctx) return;

    if (this.paymentModeChart) {
      this.paymentModeChart.destroy();
    }

    this.paymentModeChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: analysis.map(a => a.paymentMode),
        datasets: [{
          data: analysis.map(a => a.totalAmount),
          backgroundColor: ['#10b981', '#4f46e5', '#f59e0b', '#06b6d4']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  },

  renderProfitLossSummary(summary) {
    const container = document.getElementById('profit-loss-summary');
    if (!container) return;

    const isProfit = summary.netProfit >= 0;

    container.innerHTML = `
      <div class="summary-item">
        <h4>Total Sales</h4>
        <p>${formatCurrency(summary.totalSales)}</p>
      </div>
      <div class="summary-item">
        <h4>Total Expenses</h4>
        <p>${formatCurrency(summary.totalExpenses)}</p>
      </div>
      <div class="summary-item ${isProfit ? 'positive' : 'negative'}">
        <h4>Net Profit/Loss</h4>
        <p>${formatCurrency(Math.abs(summary.netProfit))}</p>
      </div>
    `;
  },

  renderCustomerBreakdown(bills) {
    const container = document.getElementById('customer-breakdown-container');
    if (!container) {
      console.error('customer-breakdown-container not found');
      return;
    }

    if (!bills || bills.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 2rem; text-align: center;">
          <i class="fas fa-users" style="font-size: 3rem; color: var(--gray-light); margin-bottom: 1rem;"></i>
          <p>No bills found for the selected date range</p>
        </div>
      `;
      return;
    }

    // Group bills by customer phone
    const customerMap = {};
    bills.forEach(bill => {
      const phone = bill.customerPhone || 'Walk-in Customer';
      const name = bill.customerName || 'Walk-in Customer';
      
      if (!customerMap[phone]) {
        customerMap[phone] = {
          name: name,
          phone: phone,
          totalBills: 0,
          totalAmount: 0,
          paidAmount: 0,
          dueAmount: 0,
          bills: []
        };
      }
      
      customerMap[phone].totalBills += 1;
      customerMap[phone].totalAmount += parseFloat(bill.totalAmount) || 0;
      customerMap[phone].paidAmount += parseFloat(bill.paidAmount) || 0;
      customerMap[phone].dueAmount += parseFloat(bill.balanceAmount) || 0;
      customerMap[phone].bills.push(bill);
    });

    // Convert to array and sort by total amount
    const customers = Object.values(customerMap).sort((a, b) => b.totalAmount - a.totalAmount);
    
    // Store all customers for search
    this.allCustomers = customers;

    container.innerHTML = `
      <!-- Search Bar -->
      <div style="margin-bottom: 15px;">
        <input type="text" id="customer-search" placeholder="Search by customer name or phone..." style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; font-size: 0.9rem;">
      </div>
      
      <div id="customer-table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Phone</th>
              <th>Total Bills</th>
              <th>Total Amount</th>
              <th>Paid</th>
              <th>Due Amount</th>
            </tr>
          </thead>
          <tbody id="customer-table-body">
            ${customers.map(customer => `
              <tr onclick="reports.viewCustomerBills('${customer.phone}')" style="cursor: pointer;">
                <td><strong>${customer.name}</strong></td>
                <td><i class="fas fa-phone" onclick="copyPhoneNumber('${customer.phone}', event)" title="Click to copy phone number" style="cursor: pointer; color: var(--primary);"></i> ${customer.phone}</td>
                <td>${customer.totalBills}</td>
                <td>${formatCurrency(customer.totalAmount)}</td>
                <td style="color: var(--success);">${formatCurrency(customer.paidAmount)}</td>
                <td style="color: ${customer.dueAmount > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight: bold;">
                  ${formatCurrency(customer.dueAmount)}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    
    // Add search event listener
    const searchInput = document.getElementById('customer-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchCustomers(e.target.value);
      });
    }
  },
  
  searchCustomers(query) {
    if (!query || query.trim() === '') {
      // Show all customers
      this.renderCustomerTable(this.allCustomers);
      return;
    }

    const searchTerm = query.toLowerCase().trim();
    const filteredCustomers = this.allCustomers.filter(customer => {
      const name = (customer.name || '').toLowerCase();
      const phone = (customer.phone || '').toLowerCase();
      
      return name.includes(searchTerm) || phone.includes(searchTerm);
    });

    this.renderCustomerTable(filteredCustomers);
  },
  
  renderCustomerTable(customers) {
    const tbody = document.getElementById('customer-table-body');
    
    if (customers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center" style="padding: 2rem; color: var(--gray);">
            <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
            No customers found matching your search
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = customers.map(customer => `
      <tr onclick="reports.viewCustomerBills('${customer.phone}')" style="cursor: pointer;">
        <td><strong>${customer.name}</strong></td>
        <td>${customer.phone}</td>
        <td>${customer.totalBills}</td>
        <td>${formatCurrency(customer.totalAmount)}</td>
        <td style="color: var(--success);">${formatCurrency(customer.paidAmount)}</td>
        <td style="color: ${customer.dueAmount > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight: bold;">
          ${formatCurrency(customer.dueAmount)}
        </td>
      </tr>
    `).join('');
  },

  viewCustomerBills(phone) {
    // Create modal to show all bills for this customer
    const customerBills = this.currentBills?.filter(bill => bill.customerPhone === phone) || [];
    
    // Remove existing modal if it exists
    const existingModal = document.getElementById('customer-bills-modal');
    if (existingModal) {
      existingModal.remove();
    }
    
    const totalAmount = customerBills.reduce((sum, bill) => sum + parseFloat(bill.totalAmount), 0);
    const totalPaid = customerBills.reduce((sum, bill) => sum + parseFloat(bill.paidAmount), 0);
    const totalDue = customerBills.reduce((sum, bill) => sum + parseFloat(bill.balanceAmount), 0);
    
    const modalContent = `
      <div class="modal-header">
        <h3>Customer Bills - ${customerBills[0]?.customerName || 'Walk-in Customer'}</h3>
        <button class="modal-close" onclick="modal.close('customer-bills-modal');">&times;</button>
      </div>
      <div class="modal-body">
        <div style="padding: 20px;">
          <!-- Summary Cards -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px;">
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
              <div style="font-size: 0.85rem; color: #666; margin-bottom: 5px;">Total Amount</div>
              <div style="font-size: 1.5rem; font-weight: bold; color: #2c5f2d;">${formatCurrency(totalAmount)}</div>
            </div>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
              <div style="font-size: 0.85rem; color: #666; margin-bottom: 5px;">Total Paid</div>
              <div style="font-size: 1.5rem; font-weight: bold; color: #27ae60;">${formatCurrency(totalPaid)}</div>
            </div>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
              <div style="font-size: 0.85rem; color: #666; margin-bottom: 5px;">Total Due</div>
              <div style="font-size: 1.5rem; font-weight: bold; color: ${totalDue > 0 ? '#e74c3c' : '#27ae60'};">${formatCurrency(totalDue)}</div>
            </div>
          </div>
          
          <table class="table">
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Paid</th>
                <th>Due</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${customerBills.map(bill => `
                <tr>
                  <td>${bill.billNumber}</td>
                  <td>${formatDate(bill.created_at)}</td>
                  <td>${formatCurrency(bill.totalAmount)}</td>
                  <td>${formatCurrency(bill.paidAmount)}</td>
                  <td style="color: ${parseFloat(bill.balanceAmount) > 0 ? '#e74c3c' : '#27ae60'}; font-weight: bold;">${formatCurrency(bill.balanceAmount)}</td>
                  <td>${getStatusBadge(bill.paymentStatus)}</td>
                  <td>
                    <button class="btn btn-sm btn-info" onclick="billing.viewBill(${bill.id})" title="View Bill">
                      <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="billing.printBill(${bill.id})" title="Print Bill">
                      <i class="fas fa-print"></i>
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const modalEl = document.createElement('div');
    modalEl.id = 'customer-bills-modal';
    modalEl.className = 'modal';
    modalEl.style.maxWidth = '1400px';
    modalEl.innerHTML = modalContent;

    document.getElementById('modal-overlay').appendChild(modalEl);
    modal.open('customer-bills-modal');
  },

  renderPendingDuesSummary(bills) {
    const container = document.getElementById('pending-dues-summary');
    if (!container) return;

    // Calculate totals
    let totalAmount = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let customersWithDues = 0;
    const customerDues = {};

    bills.forEach(bill => {
      const total = parseFloat(bill.totalAmount) || 0;
      const paid = parseFloat(bill.paidAmount) || 0;
      const due = parseFloat(bill.balanceAmount) || 0;

      totalAmount += total;
      totalPaid += paid;
      totalPending += due;

      // Track customer dues
      if (due > 0 && bill.customerPhone) {
        if (!customerDues[bill.customerPhone]) {
          customerDues[bill.customerPhone] = {
            name: bill.customerName || 'Customer',
            phone: bill.customerPhone,
            due: 0
          };
          customersWithDues++;
        }
        customerDues[bill.customerPhone].due += due;
      }
    });

    container.innerHTML = `
      <div class="pending-dues-stat">
        <div class="stat-label">Total Sales</div>
        <div class="stat-value green">₹${totalAmount.toFixed(2)}</div>
      </div>
      <div class="pending-dues-stat">
        <div class="stat-label">Total Collected</div>
        <div class="stat-value green">₹${totalPaid.toFixed(2)}</div>
      </div>
      <div class="pending-dues-stat">
        <div class="stat-label">Total Pending</div>
        <div class="stat-value">₹${totalPending.toFixed(2)}</div>
      </div>
      <div class="pending-dues-stat">
        <div class="stat-label">Customers with Dues</div>
        <div class="stat-value orange">${customersWithDues}</div>
      </div>
    `;

    // Add customer dues table if there are pending amounts
    if (customersWithDues > 0) {
      let tableHTML = `
        <div class="customer-dues-table">
          <h4 style="margin: 20px 0 10px 0; color: #2c3e50;"><i class="fas fa-users"></i> Customer-wise Pending Amounts</h4>
          <table>
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Phone</th>
                <th>Pending Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
      `;

      Object.values(customerDues).forEach(customer => {
        tableHTML += `
          <tr>
            <td><strong>${customer.name}</strong></td>
            <td>
              <i class="fas fa-phone" onclick="copyPhoneNumber('${customer.phone}', event)" title="Click to copy phone number" style="cursor: pointer; color: var(--primary);"></i>
              <span class="phone-link" onclick="reports.viewCustomerDues('${customer.phone}')">
                ${customer.phone}
              </span>
            </td>
            <td class="amount-due">₹${customer.due.toFixed(2)}</td>
            <td>
              <button class="btn btn-sm btn-primary" onclick="reports.viewCustomerDues('${customer.phone}')">
                <i class="fas fa-eye"></i> View Bills
              </button>
            </td>
          </tr>
        `;
      });

      tableHTML += `
            </tbody>
          </table>
        </div>
      `;

      container.innerHTML += tableHTML;
    }
  },

  viewCustomerDues(phone) {
    const customerBills = this.currentBills?.filter(bill => 
      bill.customerPhone === phone && parseFloat(bill.balanceAmount) > 0
    ) || [];

    if (customerBills.length === 0) {
      toast.info('No pending bills for this customer');
      return;
    }

    // Remove existing modal if it exists
    const existingModal = document.getElementById('customer-dues-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const customerName = customerBills[0]?.customerName || 'Customer';
    const totalDue = customerBills.reduce((sum, bill) => sum + parseFloat(bill.balanceAmount), 0);

    const modalContent = `
      <div class="modal-header">
        <h3>Pending Bills - ${customerName}</h3>
        <button class="modal-close" onclick="modal.close('customer-dues-modal');">&times;</button>
      </div>
      <div class="modal-body">
        <div style="padding: 20px;">
          <div style="background: #fff5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #e74c3c;">
            <p style="margin: 5px 0;"><strong>Phone:</strong> ${phone}</p>
            <p style="margin: 5px 0;"><strong>Total Pending Bills:</strong> ${customerBills.length}</p>
            <p style="margin: 5px 0; font-size: 1.2rem; color: #e74c3c;"><strong>Total Amount Due: ₹${totalDue.toFixed(2)}</strong></p>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Date</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Due</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${customerBills.map(bill => `
                <tr>
                  <td>${bill.billNumber}</td>
                  <td>${formatDate(bill.created_at)}</td>
                  <td>₹${parseFloat(bill.totalAmount).toFixed(2)}</td>
                  <td>₹${parseFloat(bill.paidAmount).toFixed(2)}</td>
                  <td style="color: #e74c3c; font-weight: bold;">₹${parseFloat(bill.balanceAmount).toFixed(2)}</td>
                  <td>
                    <button class="btn btn-sm btn-primary" onclick="billing.viewBill(${bill.id})">
                      <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="billing.printBill(${bill.id})">
                      <i class="fas fa-print"></i>
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const modalEl = document.createElement('div');
    modalEl.id = 'customer-dues-modal';
    modalEl.className = 'modal';
    modalEl.innerHTML = modalContent;

    document.getElementById('modal-overlay').appendChild(modalEl);
    modal.open('customer-dues-modal');
  }
};
