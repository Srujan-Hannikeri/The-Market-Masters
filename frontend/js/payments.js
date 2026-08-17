// Payments Module
const payments = {
  pendingDues: [],
  listenersSetup: false,

  async load() {
    await Promise.all([
      this.loadPaymentSummary(),
      this.loadPendingDues(),
      this.loadAllPayments(),
      this.loadAllBills(),
      this.loadVerificationPending()
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

    container.innerHTML = modes.map(mode => {
      // byMode[key] is { count, amount } — read .amount, fallback to 0
      const raw = byMode[mode.key];
      const amount = raw && typeof raw === 'object' ? Number(raw.amount) || 0
                   : Number(raw) || 0;
      return `
        <div class="payment-mode-card ${mode.class}">
          <i class="fas ${mode.icon}"></i>
          <h4>${mode.key}</h4>
          <p>${formatCurrency(amount)}</p>
        </div>
      `;
    }).join('');
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
          <td colspan="6" class="text-center">
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

    tbody.innerHTML = paymentsList.map(payment => {
      const isPending = payment.paymentStatus === 'Verification Pending';
      const confirmBtn = isPending
        ? `<button class="btn btn-sm btn-success" onclick="payments.confirmPayment('${payment.id}')">
             <i class="fas fa-check"></i> Confirm
           </button>`
        : `<span style="color:#10b981;font-size:12px;font-weight:600;">✓ Confirmed</span>`;
      return `
        <tr style="${isPending ? 'background:#fffbeb;' : ''}">
          <td>${formatDate(payment.created_at)}</td>
          <td>${payment.billId?.billNumber || '-'}</td>
          <td>${payment.billId?.customerName || '-'}</td>
          <td><span style="${badgeStyle(payment.paymentMode)}">${payment.paymentMode}</span></td>
          <td>${formatCurrency(payment.amount)}</td>
          <td>${confirmBtn}</td>
        </tr>
      `;
    }).join('');
  },

  async loadVerificationPending() {
    try {
      const response = await paymentsAPI.getVerificationPendingBills();
      const pendingPayments = response.payments || [];
      
      // Show a notification badge if there are pending verifications
      const countEl = document.getElementById('verification-pending-count');
      if (countEl) {
        countEl.textContent = pendingPayments.length;
        countEl.style.display = pendingPayments.length > 0 ? 'inline-flex' : 'none';
      }

      this.renderVerificationPending(pendingPayments);
    } catch (error) {
      console.error('Error loading verification pending:', error);
    }
  },

  renderVerificationPending(pendingPayments) {
    const container = document.getElementById('verification-pending-section');
    if (!container) return;

    if (pendingPayments.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    const tbody = document.getElementById('verification-pending-table');
    if (!tbody) return;

    tbody.innerHTML = pendingPayments.map(payment => `
      <tr style="background: #fffbeb;">
        <td>
          <strong>${payment.billId?.billNumber || '-'}</strong>
        </td>
        <td>${payment.customerId?.name || payment.billId?.customerName || '-'}</td>
        <td>${payment.customerId?.phone || payment.billId?.customerPhone || '-'}</td>
        <td>${payment.paymentMode}</td>
        <td><strong>${formatCurrency(payment.amount)}</strong></td>
        <td>${formatDate(payment.created_at)}</td>
        <td>
          <button class="btn btn-sm btn-success" onclick="payments.confirmPayment('${payment.id}')">
            <i class="fas fa-check-circle"></i> Confirm Payment
          </button>
          <button class="btn btn-sm btn-danger" style="margin-left:4px;" onclick="payments.rejectPayment('${payment.id}')">
            <i class="fas fa-times"></i> Reject
          </button>
        </td>
      </tr>
    `).join('');
  },

  async confirmPayment(paymentId) {
    const confirmed = await confirmDialog('Confirm this customer payment?\n\nThis will update the bill balance and mark payment as confirmed.');
    if (!confirmed) return;

    try {
      await paymentsAPI.confirmPayment(paymentId);
      toast.success('Payment confirmed! Bill updated.');
      await this.load();
    } catch (error) {
      toast.error(error.message || 'Failed to confirm payment');
    }
  },

  async rejectPayment(paymentId) {
    const confirmed = await confirmDialog('Reject this payment? The bill will remain unpaid.');
    if (!confirmed) return;

    try {
      await paymentsAPI.updatePayment(paymentId, { paymentStatus: 'Failed' });
      // Reset bill back to pending
      toast.warning('Payment rejected.');
      await this.load();
    } catch (error) {
      toast.error(error.message || 'Failed to reject payment');
    }
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
    // Gather values
    const billId       = document.getElementById('payment-bill-id').value;
    const billNumber   = document.getElementById('payment-bill-number').value;
    const amount       = parseFloat(document.getElementById('payment-amount').value);
    const paymentMode  = document.getElementById('payment-mode-input').value;
    const transactionId = document.getElementById('payment-transaction-id').value;

    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount.');
      return;
    }

    // ── Confirmation dialog before recording ──
    const dueAmountText = document.getElementById('payment-due-amount').value;
    const confirmed = await confirmDialog(
      `Confirm Payment\n\nBill: ${billNumber}\nAmount: ₹${amount.toFixed(2)}\nMode: ${paymentMode}\n\nClick OK to confirm this payment.`
    );
    if (!confirmed) return;

    const submitBtn = document.querySelector('#add-payment-form button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Recording…'; }

    try {
      await paymentsAPI.createPayment({
        billId,
        amountPaid: amount,
        paymentMode,
        transactionId
      });
      toast.success('Payment confirmed and recorded!');
      modal.close('add-payment-modal');
      document.getElementById('add-payment-form').reset();
      await this.load();
    } catch (error) {
      toast.error(error.message || 'Failed to record payment');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Confirm & Record Payment'; }
    }
  }
};
