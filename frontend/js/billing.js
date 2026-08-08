// Billing Module
const billing = {
  products: [],
  billItems: [],
  currentBill: null,
  listenersSetup: false,

  async load() {
    await this.loadProducts();
    if (!this.listenersSetup) {
      this.setupEventListeners();
      this.listenersSetup = true;
    }
    
    // Clear existing bill items before adding new ones
    const container = document.getElementById('bill-items-container');
    if (container) {
      container.innerHTML = '';
    }
    
    // Add one empty bill item row
    this.addBillItem();
    await this.loadBills();
  },

  async loadProducts() {
    try {
      const response = await inventoryAPI.getProducts({ limit: 1000 });
      this.products = response.products;
    } catch (error) {
      toast.error('Failed to load products');
    }
  },

  setupEventListeners() {
    // Add item button
    document.getElementById('add-item-btn')?.addEventListener('click', () => {
      this.addBillItem();
    });

    // Create bill form
    document.getElementById('create-bill-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.createBill();
    });

    // Paid amount input
    document.getElementById('paid-amount')?.addEventListener('input', () => {
      this.updatePaymentStatus();
    });

    // Bill status filter
    document.getElementById('bill-status-filter')?.addEventListener('change', () => {
      this.loadBills();
    });

    // Barcode scanner rapid input listener
    let barcodeBuffer = '';
    let barcodeTimer = null;
    
    document.addEventListener('keydown', (e) => {
      // Only process when billing page is visible
      const billingPage = document.getElementById('billing-page');
      if (!billingPage || !billingPage.classList.contains('active')) return;
      
      // Ignore if user is currently typing in customer name/phone inputs
      const activeTag = document.activeElement ? document.activeElement.tagName : '';
      const activeId = document.activeElement ? document.activeElement.id : '';
      if ((activeTag === 'INPUT' || activeTag === 'TEXTAREA') && activeId !== 'barcode-scanner-input') {
        if (!document.activeElement.classList.contains('quantity-input')) {
          return;
        }
      }

      if (e.key === 'Enter') {
        if (barcodeBuffer.length >= 3) {
          this.handleBarcodeScan(barcodeBuffer.trim());
          barcodeBuffer = '';
        }
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
        clearTimeout(barcodeTimer);
        barcodeTimer = setTimeout(() => {
          barcodeBuffer = '';
        }, 100);
      }
    });
  },

  handleBarcodeScan(code) {

    const product = this.products.find(p => p.barcode && String(p.barcode).trim().toLowerCase() === String(code).trim().toLowerCase());
    
    if (product) {
      // Check if item already exists in current rows
      let existingRow = null;
      document.querySelectorAll('.bill-item-row').forEach(row => {
        const select = row.querySelector('.product-select');
        if (select && select.value == product.id) {
          existingRow = row;
        }
      });

      if (existingRow) {
        const qtyInput = existingRow.querySelector('.quantity-input');
        qtyInput.value = parseInt(qtyInput.value || 0) + 1;
        this.updateItemTotal(existingRow);
      } else {
        // Find empty row or create new row
        let emptyRow = null;
        document.querySelectorAll('.bill-item-row').forEach(row => {
          const select = row.querySelector('.product-select');
          if (select && !select.value) {
            emptyRow = row;
          }
        });

        if (!emptyRow) {
          this.addBillItem();
          const rows = document.querySelectorAll('.bill-item-row');
          emptyRow = rows[rows.length - 1];
        }

        const select = emptyRow.querySelector('.product-select');
        select.value = product.id;
        this.updateItemTotal(emptyRow);
      }
      toast.success(`Scanned: ${product.name}`);
    } else {
      toast.error(`No product found with barcode: ${code}`);
    }
  },

  addBillItem() {
    const container = document.getElementById('bill-items-container');
    if (!container) return;   // page not loaded yet — bail silently
    const itemId = Date.now();

    const itemRow = document.createElement('div');
    itemRow.className = 'bill-item-row';
    itemRow.dataset.itemId = itemId;

    itemRow.innerHTML = `
      <select class="product-select" required>
        <option value="">Select Product</option>
        ${this.products.map(p => `<option value="${p.id}" data-price="${p.price}">${p.name} (₹${p.price})</option>`).join('')}
      </select>
      <input type="number" class="quantity-input" value="1" min="1" required>
      <span class="price-display">₹0</span>
      <span class="item-total">₹0</span>
      <button type="button" class="remove-item-btn"><i class="fas fa-trash"></i></button>
    `;

    // Event listeners for this row
    const select = itemRow.querySelector('.product-select');
    const quantity = itemRow.querySelector('.quantity-input');
    const removeBtn = itemRow.querySelector('.remove-item-btn');

    select.addEventListener('change', () => this.updateItemTotal(itemRow));
    quantity.addEventListener('input', () => this.updateItemTotal(itemRow));
    removeBtn.addEventListener('click', () => {
      itemRow.remove();
      this.calculateTotals();
    });

    container.appendChild(itemRow);
  },

  updateItemTotal(row) {
    const select = row.querySelector('.product-select');
    const quantity = row.querySelector('.quantity-input');
    const priceDisplay = row.querySelector('.price-display');
    const totalDisplay = row.querySelector('.item-total');

    const selectedOption = select.options[select.selectedIndex];
    const price = parseFloat(selectedOption.dataset.price) || 0;
    const qty = parseInt(quantity.value) || 0;
    const total = price * qty;

    priceDisplay.textContent = formatCurrency(price);
    totalDisplay.textContent = formatCurrency(total);

    this.calculateTotals();
  },

  calculateTotals() {
    let subtotal = 0;

    document.querySelectorAll('.bill-item-row').forEach(row => {
      const totalText = row.querySelector('.item-total').textContent;
      subtotal += parseFloat(totalText.replace('₹', '').replace(',', '')) || 0;
    });

    // No discount - total equals subtotal
    const total = subtotal;

    const subtotalEl = document.getElementById('bill-subtotal');
    const totalEl    = document.getElementById('bill-total');
    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
    if (totalEl)    totalEl.textContent    = formatCurrency(total);

    this.updatePaymentStatus();
  },

  updatePaymentStatus() {
    const totalEl = document.getElementById('bill-total');
    const statusEl = document.getElementById('payment-status');
    if (!totalEl || !statusEl) return;

    const total = parseFloat(totalEl.textContent.replace('₹', '').replace(',', '')) || 0;
    const paid = parseFloat(document.getElementById('paid-amount')?.value) || 0;

    let status = 'Pending';
    if (paid >= total && total > 0) {
      status = 'Paid';
    } else if (paid > 0) {
      status = 'Partially Paid';
    }

    statusEl.textContent = status;
    statusEl.className = status.replace(' ', '.');
  },

  async createBill() {
    const items = [];
    document.querySelectorAll('.bill-item-row').forEach(row => {
      const productId = row.querySelector('.product-select').value;
      const quantity = parseInt(row.querySelector('.quantity-input').value);
      if (productId && quantity > 0) {
        items.push({ productId: parseInt(productId), quantity });
      }
    });

    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    const billData = {
      customerName: document.getElementById('bill-customer-name')?.value,
      customerPhone: document.getElementById('bill-customer-phone')?.value,
      items,
      discount: 0, // No discount
      paidAmount: parseFloat(document.getElementById('paid-amount')?.value) || 0,
      paymentMode: document.getElementById('payment-mode')?.value
    };

    try {
      const response = await billsAPI.createBill(billData);
      this.currentBill = response.bill;
      toast.success('Bill created successfully!');

      // Ask if user wants to print the bill
      setTimeout(() => {
        if (confirm('Bill created successfully! Do you want to print it now?')) {
          // Use the bill ID from the response
          this.printBill(this.currentBill.id);
        }
      }, 800);

      // Refresh reports if reports module is loaded
      if (typeof reports !== 'undefined' && reports.loadReportData) {
        reports.loadReportData();
      }

      this.resetForm();
      await this.loadBills();
    } catch (error) {
      toast.error(error.message || 'Failed to create bill');
    }
  },

  async loadBills() {
    try {
      const status = document.getElementById('bill-status-filter')?.value;
      const params = status ? { status } : {};
      const response = await billsAPI.getBills(params);
      this.allBills = response.bills || []; // Store all bills
      this.renderBillsList(this.allBills);
      
      // Setup live update interval - refresh bills every 5 seconds
      if (!this.liveUpdateInterval) {
        this.liveUpdateInterval = setInterval(() => {
          this.loadBills();
        }, 5000);
      }
    } catch (error) {
      console.error('Error loading bills:', error);
      // Don't show error toast - just render empty list
      this.allBills = [];
      this.renderBillsList(this.allBills);
    }
  },

  searchBills(query) {
    if (!query || query.trim() === '') {
      this.renderBillsList(this.allBills);
      return;
    }

    const searchTerm = query.toLowerCase().trim();
    const filteredBills = this.allBills.filter(bill => {
      const customerName = (bill.customerName || '').toLowerCase();
      const customerPhone = (bill.customerPhone || '').toLowerCase();
      const billNumber = (bill.billNumber || '').toLowerCase();
      
      return customerName.includes(searchTerm) || 
             customerPhone.includes(searchTerm) || 
             billNumber.includes(searchTerm);
    });

    this.renderBillsList(filteredBills);
  },

  renderBillsList(bills) {
    const container = document.getElementById('bills-list');
    if (!container) return;

    if (bills.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-file-invoice"></i>
          <h3>No bills found</h3>
          <p>Create your first bill to get started</p>
        </div>
      `;
      return;
    }

    container.innerHTML = bills.map(bill => `
      <div class="bill-card ${bill.paymentStatus.toLowerCase().replaceAll(' ', '-')}">
        <div class="bill-card-header">
          <h4>${bill.billNumber}</h4>
          ${getStatusBadge(bill.paymentStatus)}
        </div>
        <div class="bill-card-body">
          <p><i class="fas fa-user"></i> ${bill.customerName || 'Walk-in Customer'}</p>
          <p><i class="fas fa-phone" onclick="copyPhoneNumber('${bill.customerPhone}', event)" title="Click to copy phone number" style="cursor: pointer; color: var(--primary);"></i> ${bill.customerPhone || 'N/A'}</p>
          <p><i class="fas fa-calendar"></i> ${formatDate(bill.created_at)}</p>
        </div>
        <div class="bill-card-footer">
          <span class="bill-amount">${formatCurrency(bill.totalAmount)}</span>
          <div class="bill-actions">
            <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); billing.viewBill(${bill.id})" title="View Bill">
              <i class="fas fa-eye"></i> View
            </button>
            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); billing.printBill(${bill.id})" title="Print Bill">
              <i class="fas fa-print"></i> Print
            </button>
          </div>
        </div>
      </div>
    `).join('');
  },

  async viewBill(billId) {
    try {
      const response = await billsAPI.getBill(billId);
      const bill = response.bill;
      this.renderBillModal(bill);
    } catch (error) {
      toast.error('Failed to load bill details');
    }
  },

  renderBillModal(bill) {
    // Remove existing modal if present to prevent duplicates
    const existingModal = document.getElementById('bill-view-modal-content');
    if (existingModal) {
      existingModal.remove();
    }

    const isShopkeeper = auth.user?.role === 'shopkeeper';
    
    // Payment status message
    let paymentMessage = '';
    if (bill.paymentStatus === 'Partially Paid') {
      paymentMessage = `<div class="alert alert-warning" style="margin: 1rem 0; padding: 1rem; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
        <i class="fas fa-exclamation-triangle"></i> <strong>Partial Payment:</strong> Amount due of ${formatCurrency(bill.balanceAmount)} is pending. Please complete the payment.
      </div>`;
    } else if (bill.paymentStatus === 'Pending') {
      paymentMessage = `<div class="alert alert-danger" style="margin: 1rem 0; padding: 1rem; background: #f8d7da; border-left: 4px solid #dc3545; border-radius: 4px;">
        <i class="fas fa-clock"></i> <strong>Payment Pending:</strong> Full amount of ${formatCurrency(bill.totalAmount)} is due.
      </div>`;
    } else if (bill.paymentStatus === 'Paid') {
      paymentMessage = `<div class="alert alert-success" style="margin: 1rem 0; padding: 1rem; background: #d4edda; border-left: 4px solid #28a745; border-radius: 4px;">
        <i class="fas fa-check-circle"></i> <strong>Fully Paid:</strong> Thank you for your payment!
      </div>`;
    }

    const modalContent = `
      <div class="bill-view-modal">
        <div class="bill-view-header">
          <h2>Bill ${bill.billNumber}</h2>
          <span class="bill-status">${getStatusBadge(bill.paymentStatus)}</span>
        </div>
        ${paymentMessage}
        <div class="bill-view-details">
          <div class="bill-view-section">
            <h4>Customer Information</h4>
            <p><strong>Name:</strong> ${bill.customerName || 'Walk-in Customer'}</p>
            <p><strong>Phone:</strong> <i class="fas fa-phone" onclick="copyPhoneNumber('${bill.customerPhone}', event)" title="Click to copy phone number" style="cursor: pointer; color: var(--primary);"></i> ${bill.customerPhone || 'N/A'}</p>
            <p><strong>Date:</strong> ${formatDateTime(bill.created_at)}</p>
          </div>
          <div class="bill-view-section">
            <h4>Items</h4>
            <table class="bill-items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>MRP</th>
                  ${isShopkeeper ? '<th>Billing<br>Amount</th><th>Profit</th>' : ''}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${bill.BillItems.map(item => {
                  const mrp = parseFloat(item.mrp || item.unitPrice || 0);
                  const cost = parseFloat(item.Product?.costPrice || item.costPrice || 0);
                  const profitPerUnit = mrp - cost;
                  const totalProfit = profitPerUnit * (parseInt(item.quantity) || 1);

                  return `
                    <tr>
                      <td>${item.productName}</td>
                      <td>${item.quantity}</td>
                      <td>${formatCurrency(mrp)}</td>
                      ${isShopkeeper ? `
                        <td>${cost > 0 ? formatCurrency(cost) : '₹0.00'}</td>
                        <td style="color: #10b981; font-weight: 700;">+${formatCurrency(totalProfit)}</td>
                      ` : ''}
                      <td>${formatCurrency(item.total)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          <div class="bill-view-section">
            <h4>Payment Summary</h4>
            <div class="bill-summary-row">
              <span>Total:</span>
              <span>${formatCurrency(bill.totalAmount)}</span>
            </div>
            <div class="bill-summary-row">
              <span>Paid:</span>
              <span>${formatCurrency(bill.paidAmount)}</span>
            </div>
            <div class="bill-summary-row due">
              <span>Due:</span>
              <span>${formatCurrency(bill.balanceAmount)}</span>
            </div>
          </div>
          ${bill.Payments && bill.Payments.length > 0 ? `
          <div class="bill-view-section">
            <h4>Payment History</h4>
            <table class="bill-items-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Mode</th>
                  <th>Amount</th>
                  ${isShopkeeper ? '<th>Action</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${bill.Payments.map(payment => `
                  <tr>
                    <td>${formatDate(payment.created_at)}</td>
                    <td>${payment.paymentMode}</td>
                    <td>${formatCurrency(payment.amountPaid)}</td>
                    ${isShopkeeper ? `<td>
                      <button class="btn btn-sm btn-secondary" onclick="billing.editPayment(${payment.id}, ${bill.id})">
                        <i class="fas fa-edit"></i>
                      </button>
                    </td>` : ''}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}
        </div>
        <div class="bill-view-actions">
          ${isShopkeeper && bill.paymentStatus !== 'Paid' ? `
          <button class="btn btn-success" onclick="billing.recordShopkeeperPayment(${bill.id}, ${bill.balanceAmount})">
            <i class="fas fa-money-bill-wave"></i> Record Payment
          </button>
          ` : ''}
          <button class="btn btn-primary" onclick="billing.printBill(${bill.id})">
            <i class="fas fa-print"></i> Print
          </button>
          <button class="btn btn-info" onclick="billing.downloadBillPDF(${bill.id})">
            <i class="fas fa-download"></i> Download PDF
          </button>
          <button class="btn btn-secondary" onclick="modal.close('bill-view-modal-content')">
            Close
          </button>
        </div>
      </div>
    `;

    // Create and show modal
    const modalEl = document.createElement('div');
    modalEl.id = 'bill-view-modal-content';
    modalEl.className = 'modal';
    // Medium modal width for comfortable viewing
    modalEl.style.maxWidth = '720px';
    modalEl.style.width = 'auto';
    modalEl.innerHTML = `
      <div class="modal-header">
        <h3>Bill Details</h3>
        <button class="modal-close" onclick="modal.close('bill-view-modal-content');">&times;</button>
      </div>
      <div class="modal-body">
        ${modalContent}
      </div>
    `;

    document.getElementById('modal-overlay').appendChild(modalEl);
    modal.open('bill-view-modal-content');
  },

  async editPayment(paymentId, billId) {
    try {
      const response = await paymentsAPI.getPayment(paymentId);
      const payment = response.payment;
      
      const newAmount = prompt('Enter new payment amount:', payment.amountPaid);
      if (newAmount === null) return;
      
      const newMode = prompt('Enter payment mode (Cash/UPI/Card/Net Banking):', payment.paymentMode);
      if (newMode === null) return;

      // Update payment
      await paymentsAPI.updatePayment(paymentId, {
        amountPaid: parseFloat(newAmount),
        paymentMode: newMode
      });

      toast.success('Payment updated successfully!');
      await this.viewBill(billId);
      await this.loadBills();
    } catch (error) {
      toast.error('Failed to update payment');
    }
  },

  async addPaymentFromView(billId, dueAmount) {
    payments.openPaymentModal(billId);
  },

  async printBill(billId) {
    // Read the format selector — falls back to 'a4' if element not on page
    const format = document.getElementById('print-format-select')?.value || 'a4';
    try {
      const response = await billsAPI.generatePDF(billId, format);
      if (response.pdfUrl) {
        const printWindow = window.open(response.pdfUrl, '_blank');
        if (printWindow) {
          printWindow.onload = function () {
            setTimeout(() => printWindow.print(), 600);
          };
        }
        const label = {
          a4: 'A4', a3: 'A3', a5: 'A5', letter: 'Letter',
          '80mm': '80 mm Thermal', '58mm': '58 mm Thermal'
        }[format] || format.toUpperCase();
        toast.success(`PDF (${label}) generated!`);
      } else {
        toast.error('Failed to generate PDF bill');
      }
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Failed to generate PDF: ' + error.message);
    }
  },

  async downloadBillPDF(billId) {
    try {
      const response = await billsAPI.generatePDF(billId);
      if (response.pdfUrl) {
        // Create temporary link to download
        const link = document.createElement('a');
        link.href = response.pdfUrl;
        link.download = `Bill-${response.billNumber || billId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('PDF downloaded successfully!');
      } else {
        toast.error('Failed to generate PDF');
      }
    } catch (error) {
      toast.error('Failed to download PDF: ' + error.message);
    }
  },

  resetForm() {
    document.getElementById('create-bill-form')?.reset();
    const itemsContainer = document.getElementById('bill-items-container');
    if (itemsContainer) itemsContainer.innerHTML = '';
    const subtotalEl = document.getElementById('bill-subtotal');
    const totalEl    = document.getElementById('bill-total');
    const statusEl   = document.getElementById('payment-status');
    if (subtotalEl) subtotalEl.textContent = '₹0';
    if (totalEl)    totalEl.textContent    = '₹0';
    if (statusEl)   statusEl.textContent   = 'Pending';
  },

  // Check order refund status and show refund modal
  async checkAndShowRefundModal(billId, totalAmount) {
    try {
      // Get bill details to find associated order
      const response = await billsAPI.getBill(billId);
      const bill = response.bill;
      
      if (!bill.notes || !bill.notes.startsWith('Order:')) {
        toast.error('This bill is not associated with an order');
        return;
      }
      
      // Extract order number from bill notes
      const orderNumber = bill.notes.replace('Order: ', '');
      
      // Find order by order number
      const orderResponse = await ordersAPI.getOrderByNumber(orderNumber);
      const order = orderResponse.order;
      
      if (!order) {
        toast.error('Associated order not found');
        return;
      }
      
      if (order.orderStatus !== 'Cancelled') {
        toast.error('Can only refund cancelled orders');
        return;
      }
      
      if (order.refundStatus === 'Refunded') {
        toast.info('This order has already been refunded');
        return;
      }
      
      // Show refund modal
      this.showBillRefundModal(billId, totalAmount);
    } catch (error) {
      console.error('Error checking refund status:', error);
      toast.error(error.message || 'Failed to check refund status');
    }
  },

  // Show refund modal for bill
  showBillRefundModal(billId, totalAmount) {
    const refundModal = document.createElement('div');
    refundModal.id = 'bill-refund-modal';
    refundModal.className = 'modal';
    refundModal.innerHTML = 
      '<div class="modal-header">' +
        '<h3>Process Refund</h3>' +
        '<button class="modal-close" onclick="document.getElementById(\'bill-refund-modal\').remove();">&times;</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div style="padding: 20px;">' +
          '<div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">' +
            '<p style="margin: 0; color: #856404;">' +
              '<i class="fas fa-info-circle"></i> Enter the refund amount to process for this bill.' +
            '</p>' +
          '</div>' +
          '<form id="bill-refund-form" onsubmit="billing.processBillRefund(event, ' + billId + ', ' + totalAmount + ')">' +
            '<div class="form-group">' +
              '<label>Refund Amount (Rs.) *</label>' +
              '<input type="number" id="bill-refund-amount" step="0.01" min="0.01" max="' + totalAmount + '" value="' + totalAmount + '" required>' +
              '<small style="color: #666;">Maximum: Rs. ' + parseFloat(totalAmount).toFixed(2) + '</small>' +
            '</div>' +
            '<div class="form-actions">' +
              '<button type="submit" class="btn btn-warning"><i class="fas fa-check"></i> Process Refund</button>' +
              '<button type="button" onclick="document.getElementById(\'bill-refund-modal\').remove();" class="btn btn-secondary">Cancel</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>';
    
    document.getElementById('modal-overlay').appendChild(refundModal);
    modal.open('bill-refund-modal');
  },

  // Process bill refund
  async processBillRefund(event, billId, totalAmount) {
    event.preventDefault();
    
    const refundAmount = parseFloat(document.getElementById('bill-refund-amount').value);
    
    if (!refundAmount || refundAmount <= 0) {
      toast.error('Please enter a valid refund amount');
      return;
    }
    
    if (refundAmount > totalAmount) {
      toast.error('Refund amount cannot exceed bill total');
      return;
    }
    
    try {
      // Get bill details to find associated order
      const response = await billsAPI.getBill(billId);
      const bill = response.bill;
      
      if (!bill.notes || !bill.notes.startsWith('Order:')) {
        toast.error('This bill is not associated with an order');
        return;
      }
      
      // Extract order number from bill notes
      const orderNumber = bill.notes.replace('Order: ', '');
      
      // Find order by order number
      const orderResponse = await ordersAPI.getOrderByNumber(orderNumber);
      const order = orderResponse.order;
      
      if (!order) {
        toast.error('Associated order not found');
        return;
      }
      
      if (order.orderStatus !== 'Cancelled') {
        toast.error('Can only refund cancelled orders');
        return;
      }
      
      if (order.refundStatus === 'Refunded') {
        toast.error('This order has already been refunded');
        return;
      }
      
      // Process refund through order API
      await ordersAPI.processRefund(order.id, refundAmount);
      
      toast.success('Refund processed successfully!');
      document.getElementById('bill-refund-modal').remove();
      
      // Reload bills
      this.loadBills();
    } catch (error) {
      console.error('Error processing refund:', error);
      toast.error(error.message || 'Failed to process refund');
    }
  },

  // Shopkeeper records payment for a bill
  recordShopkeeperPayment(billId, dueAmount) {
    const paymentModal = document.createElement('div');
    paymentModal.id = 'shopkeeper-payment-modal';
    paymentModal.className = 'modal';
    paymentModal.innerHTML = 
      '<div class="modal-header">' +
        '<h3>Record Payment</h3>' +
        '<button class="modal-close" onclick="document.getElementById(\'shopkeeper-payment-modal\').remove();">&times;</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div style="padding: 20px;">' +
          '<div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px; text-align: center;">' +
            '<h4 style="color: #2c5f2d; margin-bottom: 10px;">Bill Payment</h4>' +
            '<p style="font-size: 24px; font-weight: bold; color: #dc3545; margin: 10px 0;">Due: Rs. ' + parseFloat(dueAmount).toFixed(2) + '</p>' +
          '</div>' +
          '<form id="shopkeeper-payment-form" onsubmit="billing.processShopkeeperPayment(event, ' + billId + ', ' + dueAmount + ')">' +
            '<div class="form-group">' +
              '<label>Payment Mode *</label>' +
              '<select id="shopkeeper-payment-mode" required>' +
                '<option value="">Choose Payment Method</option>' +
                '<option value="Cash">Cash</option>' +
                '<option value="UPI">UPI</option>' +
                '<option value="Card">Credit/Debit Card</option>' +
                '<option value="Net Banking">Net Banking</option>' +
              '</select>' +
            '</div>' +
            '<div class="form-group">' +
              '<label>Payment Type *</label>' +
              '<select id="shopkeeper-payment-type" required onchange="billing.toggleShopkeeperPartialPayment(' + dueAmount + ')">' +
                '<option value="Full">Full Payment (Rs. ' + parseFloat(dueAmount).toFixed(2) + ')</option>' +
                '<option value="Partial">Partial Payment</option>' +
              '</select>' +
            '</div>' +
            '<div id="shopkeeper-partial-payment-field" style="display: none;">' +
              '<div class="form-group">' +
                '<label>Amount Paid (Rs.) *</label>' +
                '<input type="number" id="shopkeeper-amount-paid" step="0.01" min="0.01" max="' + dueAmount + '" placeholder="Enter amount paid">' +
                '<small style="color: #666;">Maximum: Rs. ' + parseFloat(dueAmount).toFixed(2) + '</small>' +
              '</div>' +
            '</div>' +
            '<div class="form-actions" style="margin-top: 20px;">' +
              '<button type="submit" class="btn btn-primary"><i class="fas fa-check"></i> Record Payment</button>' +
              '<button type="button" onclick="document.getElementById(\'shopkeeper-payment-modal\').remove();" class="btn btn-secondary"><i class="fas fa-times"></i> Cancel</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>';
    
    document.getElementById('modal-overlay').appendChild(paymentModal);
    modal.open('shopkeeper-payment-modal');
  },

  toggleShopkeeperPartialPayment(dueAmount) {
    const paymentType = document.getElementById('shopkeeper-payment-type').value;
    const partialField = document.getElementById('shopkeeper-partial-payment-field');
    const amountInput = document.getElementById('shopkeeper-amount-paid');
    
    if (paymentType === 'Partial') {
      partialField.style.display = 'block';
      if (amountInput) {
        amountInput.required = true;
        amountInput.max = dueAmount;
      }
    } else {
      partialField.style.display = 'none';
      if (amountInput) {
        amountInput.required = false;
        amountInput.value = '';
      }
    }
  },

  async processShopkeeperPayment(event, billId, dueAmount) {
    event.preventDefault();
    
    const paymentMode = document.getElementById('shopkeeper-payment-mode').value;
    const paymentType = document.getElementById('shopkeeper-payment-type').value;
    const amountPaid = paymentType === 'Partial' ? parseFloat(document.getElementById('shopkeeper-amount-paid').value) : dueAmount;
    
    if (!paymentMode) {
      toast.error('Please select a payment mode');
      return;
    }
    
    if (paymentType === 'Partial' && (!amountPaid || amountPaid <= 0 || amountPaid > dueAmount)) {
      toast.error('Please enter a valid amount paid');
      return;
    }
    
    try {
      // Use the payments API to record payment
      await paymentsAPI.createPayment({
        billId: billId,
        amountPaid: amountPaid,
        paymentMode: paymentMode
      });
      
      toast.success('Payment recorded successfully!');
      document.getElementById('shopkeeper-payment-modal').remove();
      
      // Reload bills to reflect the update
      this.loadBills();
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error(error.message || 'Failed to process payment');
    }
  }
};
