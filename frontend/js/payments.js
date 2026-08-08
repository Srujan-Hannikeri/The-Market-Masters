// Payments Module
const payments = {
  pendingDues: [],
  listenersSetup: false,

  async load() {
    await Promise.all([
      this.loadPaymentSummary(),
      this.loadPendingDues(),
      this.loadAllPayments(),
      this.loadAllBills()
    ]);
    if (!this.listenersSetup) {
      this.setupEventListeners();
      this.listenersSetup = true;
    }
  },

  setupEventListeners() {
    // Add payment form
    document.getElementById('add-payment-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.recordPayment();
    });
  },

  async loadPaymentSummary() {
    try {
      const response = await paymentsAPI.getSummary();

      this.renderPaymentSummary(response.summary);
    } catch (error) {
      console.error('Payment Summary Error:', error);
      toast.error('Failed to load payment summary');
    }
  },

  renderPaymentSummary(summary) {
    const container = document.getElementById('payment-modes-summary');
    if (!container) return;

    if (!summary) {
      container.innerHTML = '<p class="text-center">No payment data available</p>';
      return;
    }

    const modes = [
      { key: 'Cash', icon: 'fa-money-bill-wave', class: 'cash' },
      { key: 'UPI', icon: 'fa-mobile-alt', class: 'upi' },
      { key: 'Card', icon: 'fa-credit-card', class: 'card' },
      { key: 'Net Banking', icon: 'fa-university', class: 'net-banking' }
    ];

    const byMode = summary.byMode || {};

    container.innerHTML = modes.map(mode => `
      <div class="payment-mode-card ${mode.class}">
        <i class="fas ${mode.icon}"></i>
        <h4>${mode.key}</h4>
        <p>${formatCurrency(byMode[mode.key] || 0)}</p>
      </div>
    `).join('');
  },

  async loadPendingDues() {
    try {
      const response = await paymentsAPI.getPendingDues();

      this.pendingDues = response.pendingDues || [];
      this.renderPendingDues();
      const countEl = document.getElementById('pending-count');
      if (countEl) {
        countEl.textContent = this.pendingDues.length;
      }
    } catch (error) {
      console.error('Pending Dues Error:', error);
      toast.error('Failed to load pending dues');
    }
  },

  renderPendingDues() {
    const tbody = document.getElementById('pending-dues-table');
    if (!tbody) {
      console.error('pending-dues-table element not found');
      return;
    }

    if (!this.pendingDues || this.pendingDues.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center">
            <div class="empty-state">
              <i class="fas fa-check-circle"></i>
              <p>No pending dues! All bills are paid.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.pendingDues.map(bill => `
      <tr>
        <td>${bill.billNumber}</td>
        <td>${bill.customerName || 'Walk-in'}</td>
        <td>${formatCurrency(bill.totalAmount)}</td>
        <td>${formatCurrency(bill.paidAmount)}</td>
        <td><strong>${formatCurrency(bill.balanceAmount)}</strong></td>
        <td>
          <button class="btn btn-sm btn-success" onclick="payments.openPaymentModal('${bill.id}')">
            <i class="fas fa-plus"></i> Pay
          </button>
        </td>
      </tr>
    `).join('');
  },

  async loadAllPayments() {
    try {
      const response = await paymentsAPI.getPayments({ limit: 50 });

      this.renderAllPayments(response.payments || []);
    } catch (error) {
      console.error('All Payments Error:', error);
      toast.error('Failed to load payments');
    }
  },

  async loadAllBills() {
    try {
      const response = await paymentsAPI.getAllBillsForPayments();

      this.allBills = response.bills || [];
      this.renderAllBills();
    } catch (error) {
      console.error('All Bills Error:', error);
      // Don't show error toast - just log it
      this.allBills = [];
      this.renderAllBills();
    }
  },

  renderAllBills() {
    const tbody = document.getElementById('all-bills-table');
    if (!tbody) {
      console.error('all-bills-table element not found');
      return;
    }

    if (!this.allBills || this.allBills.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center">
            <div class="empty-state">
              <i class="fas fa-file-invoice"></i>
              <p>No bills found. Create bills to see them here.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.allBills.map(bill => `
      <tr>
        <td>${bill.billNumber}</td>
        <td>${bill.customerName || 'Walk-in'}</td>
        <td>${formatCurrency(bill.totalAmount)}</td>
        <td>${formatCurrency(bill.paidAmount)}</td>
        <td>${formatCurrency(bill.balanceAmount)}</td>
        <td>${getStatusBadge(bill.paymentStatus)}</td>
      </tr>
    `).join('');
  },

  renderAllPayments(paymentsList) {
    const tbody = document.getElementById('all-payments-table');
    if (!tbody) {
      console.error('all-payments-table element not found');
      return;
    }

    if (!paymentsList || paymentsList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center">
            <div class="empty-state">
              <i class="fas fa-credit-card"></i>
              <p>No payments recorded yet.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const modeBg = { 'Cash': '#10b981', 'UPI': '#3b82f6', 'Card': '#6366f1', 'Cheque': '#f59e0b', 'Online': '#3b82f6' };
    const badgeStyle = (mode) => `display:inline-flex;align-items:center;padding:3px 10px;border-radius:50px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;background:${modeBg[mode]||'#64748b'};color:#fff`;

    tbody.innerHTML = paymentsList.map(payment => `
      <tr>
        <td>${formatDate(payment.created_at)}</td>
        <td>${payment.billId?.billNumber || '-'}</td>
        <td>${payment.billId?.customerName || '-'}</td>
        <td><span style="${badgeStyle(payment.paymentMode)}">${payment.paymentMode}</span></td>
        <td>${formatCurrency(payment.amount)}</td>
      </tr>
    `).join('');
  },

  openPaymentModal(billId) {
    const bill = this.pendingDues.find(b => b.id === billId);
    if (!bill) return;

    const billIdEl    = document.getElementById('payment-bill-id');
    const billNumEl   = document.getElementById('payment-bill-number');
    const dueAmountEl = document.getElementById('payment-due-amount');
    const amountEl    = document.getElementById('payment-amount');

    if (billIdEl)    billIdEl.value    = bill.id;
    if (billNumEl)   billNumEl.value   = bill.billNumber;
    if (dueAmountEl) dueAmountEl.value = formatCurrency(bill.balanceAmount);
    if (amountEl) {
      amountEl.max   = bill.balanceAmount;
      amountEl.value = bill.balanceAmount;
    }

    modal.open('add-payment-modal');
  },

  async recordPayment() {
    const paymentData = {
      billId: document.getElementById('payment-bill-id').value,
      amountPaid: parseFloat(document.getElementById('payment-amount').value),
      paymentMode: document.getElementById('payment-mode-input').value,
      transactionId: document.getElementById('payment-transaction-id').value
    };

    try {
      await paymentsAPI.createPayment(paymentData);
      toast.success('Payment recorded successfully!');
      modal.close('add-payment-modal');
      document.getElementById('add-payment-form').reset();
      await this.load();
    } catch (error) {
      toast.error(error.message || 'Failed to record payment');
    }
  }
};
