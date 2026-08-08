class MyBills {
  constructor() {
    this.bills = [];
    // Don't auto-init - let app.js call load() when navigating to the page
  }

  // Load bills when navigating to the page
  async load() {
    // Check if user is authenticated
    if (!auth.user) {

      if (typeof toast !== 'undefined') {
        toast.error('Please login to view your bills');
      }
      // Redirect to login by showing auth screen
      auth.showAuth();
      return;
    }
    
    await this.loadBills();
    this.setupEventListeners();
  }

  async loadBills() {
    try {
      // Check authentication before making API call
      if (!auth.user) {

        return;
      }
      
      const response = await billsAPI.getMyBills();
      this.bills = response.bills || [];
      this.renderBills();
    } catch (error) {
      console.error('Error loading bills:', error);
      
      // If it's an auth error, redirect to login
      if (error.message.includes('Access denied') || error.message.includes('No token')) {
        if (typeof toast !== 'undefined') {
          toast.error('Session expired. Please login again.');
        }
        auth.showAuth();
      } else {
        // Don't show error toast for new users with no bills

        this.bills = [];
        this.renderBills();
      }
    }
  }

  renderBills() {
    const container = document.getElementById('customer-bills-list');
    if (!container) return;

    if (this.bills.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding: 3rem; text-align: center;"><i class="fas fa-receipt" style="font-size: 3rem; color: var(--gray-light); margin-bottom: 1rem;"></i><p>No bills found</p><p style="color: var(--gray-light); font-size: 0.9rem;">Your bills will appear here after you make a purchase</p></div>';
      return;
    }

    container.innerHTML = this.bills.map(function(bill) {
      // Only show pay button if bill is NOT fully paid
      var payButton = '';
      var isFullyPaid = bill.paymentStatus === 'Paid' || parseFloat(bill.balanceAmount) <= 0;
      
      if (!isFullyPaid) {
        payButton = '<button class="btn btn-sm btn-success" onclick="event.stopPropagation(); myBills.makePayment(' + bill.id + ', ' + bill.totalAmount + ', ' + bill.balanceAmount + ')" title="Make Payment"><i class="fas fa-credit-card"></i> Pay Now</button>';
      } else {
        payButton = '<span style="color: #28a745; font-weight: bold;"><i class="fas fa-check-circle"></i> Paid</span>';
      }
      
      var dueLine = '';
      if (bill.balanceAmount > 0) {
        dueLine = '<p style="color: var(--danger);"><strong>Due:</strong> ' + formatCurrency(bill.balanceAmount) + '</p>';
      } else {
        dueLine = '<p style="color: #28a745;"><strong>Fully Paid</strong></p>';
      }

      return '<div class="bill-card" onclick="myBills.viewBill(' + bill.id + ')">' +
        '<div class="bill-card-header">' +
          '<div>' +
            '<h4>' + bill.billNumber + '</h4>' +
            '<small>' + formatDate(bill.created_at) + '</small>' +
          '</div>' +
          getStatusBadge(bill.paymentStatus) +
        '</div>' +
        '<div class="bill-card-body">' +
          (bill.User && bill.User.shopName ? '<p style="background: #e8f5e9; padding: 8px 12px; border-radius: 6px; margin-bottom: 10px;"><i class="fas fa-store" style="color: #2c5f2d;"></i> <strong style="color: #2c5f2d;">' + bill.User.shopName + '</strong></p>' : '') +
          (bill.User && bill.User.shopAddress ? '<p style="font-size: 13px; color: #666; margin-bottom: 10px;"><i class="fas fa-map-marker-alt" style="color: #dc3545;"></i> ' + bill.User.shopAddress + '</p>' : '') +
          '<p><strong>Total:</strong> ' + formatCurrency(bill.totalAmount) + '</p>' +
          '<p><strong>Paid:</strong> ' + formatCurrency(bill.paidAmount) + '</p>' +
          dueLine +
        '</div>' +
        '<div class="bill-card-footer">' +
          '<span class="bill-amount">' + formatCurrency(bill.totalAmount) + '</span>' +
          '<div class="bill-actions">' +
            payButton +
            '<button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); myBills.viewBill(' + bill.id + ')" title="View Bill"><i class="fas fa-eye"></i></button>' +
            '<button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); billing.printBill(' + bill.id + ')" title="Print Bill"><i class="fas fa-print"></i></button>' +
            '<button class="btn btn-sm btn-info" onclick="event.stopPropagation(); billing.downloadBillPDF(' + bill.id + ')" title="Download PDF"><i class="fas fa-download"></i></button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  async viewBill(billId) {
    try {
      const response = await billsAPI.getBill(billId);
      const bill = response.bill;
      billing.renderBillModal(bill);
    } catch (error) {
      toast.error('Failed to load bill details');
    }
  }

  async makePayment(billId, totalAmount, dueAmount) {
    try {
      let shopkeeperUPI = null;
      try {
        const billResponse = await billsAPI.getBill(billId);
        const bill = billResponse.bill;
        if (bill && bill.userId) {
          try {
            const shopProfile = await api.get('/auth/shopkeeper/' + bill.userId);
            if (shopProfile.user && shopProfile.user.role === 'shopkeeper') {
              shopkeeperUPI = {
                upiId: shopProfile.user.upiId,
                upiQrCode: shopProfile.user.upiQrCode
              };
            }
          } catch (upiError) {
            // Silently ignore UPI fetch errors - payment can still proceed without UPI details

          }
        }
      } catch (error) {
        console.error('Error fetching bill details:', error);
      }
      
      // Store UPI data globally for the modal to access
      window.currentBillShopkeeperUPI = shopkeeperUPI;
      
      const paymentModal = document.createElement('div');
      paymentModal.id = 'bill-payment-modal';
      paymentModal.className = 'modal';
      paymentModal.innerHTML = 
        '<div class="modal-header">' +
          '<h3>Make Payment</h3>' +
          '<button class="modal-close" onclick="document.getElementById(\'bill-payment-modal\').remove();">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div style="padding: 20px;">' +
            '<div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px; text-align: center;">' +
              '<h4 style="color: #2c5f2d; margin-bottom: 10px;">Bill Amount</h4>' +
              '<p style="font-size: 24px; font-weight: bold; color: #dc3545; margin: 10px 0;">Due: Rs. ' + parseFloat(dueAmount).toFixed(2) + '</p>' +
              '<p style="font-size: 16px; color: #666;">Total: Rs. ' + parseFloat(totalAmount).toFixed(2) + '</p>' +
            '</div>' +
            '<form id="bill-payment-form" onsubmit="myBills.processBillPayment(event, ' + billId + ', ' + totalAmount + ', ' + dueAmount + ')">' +
              '<div class="form-group">' +
                '<label>Select Payment Mode *</label>' +
                '<select id="bill-payment-mode" required onchange="myBills.showBillPaymentDetails(this.value, ' + dueAmount + ');">' +
                  '<option value="">Choose Payment Method</option>' +
                  '<option value="Cash">Cash</option>' +
                  '<option value="UPI">UPI</option>' +
                  '<option value="Card">Credit/Debit Card</option>' +
                  '<option value="Net Banking">Net Banking</option>' +
                '</select>' +
              '</div>' +
              '<div class="form-group">' +
                '<label>Payment Type *</label>' +
                '<select id="bill-payment-type" required onchange="myBills.toggleBillPartialPayment(' + dueAmount + ')">' +
                  '<option value="Full">Full Payment (Rs. ' + parseFloat(dueAmount).toFixed(2) + ')</option>' +
                  '<option value="Partial">Partial Payment</option>' +
                '</select>' +
              '</div>' +
              '<div id="bill-partial-payment-field" style="display: none;">' +
                '<div class="form-group">' +
                  '<label>Amount Paid (Rs.) *</label>' +
                  '<input type="number" id="bill-amount-paid" step="0.01" min="0.01" max="' + dueAmount + '" placeholder="Enter amount paid">' +
                  '<small style="color: #666;">Maximum: Rs. ' + parseFloat(dueAmount).toFixed(2) + '</small>' +
                '</div>' +
              '</div>' +
              '<div id="bill-payment-details-container" style="margin-top: 20px;"></div>' +
              '<div class="form-actions" style="margin-top: 20px;">' +
                '<button type="submit" class="btn btn-primary"><i class="fas fa-check"></i> Confirm Payment</button>' +
                '<button type="button" onclick="document.getElementById(\'bill-payment-modal\').remove();" class="btn btn-secondary"><i class="fas fa-times"></i> Close</button>' +
              '</div>' +
            '</form>' +
          '</div>' +
        '</div>';
      
      document.getElementById('modal-overlay').appendChild(paymentModal);
      modal.open('bill-payment-modal');
    } catch (error) {
      console.error('Error showing payment modal:', error);
      toast.error('Failed to load payment options');
    }
  }

  toggleBillPartialPayment(dueAmount) {
    const paymentType = document.getElementById('bill-payment-type').value;
    const partialField = document.getElementById('bill-partial-payment-field');
    const amountInput = document.getElementById('bill-amount-paid');
    
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
  }

  showBillPaymentDetails(paymentMode, amount, shopkeeperUPI) {
    const container = document.getElementById('bill-payment-details-container');
    if (!container) return;
    
    // Use passed UPI data or fall back to global variable
    const upiData = shopkeeperUPI || window.currentBillShopkeeperUPI || null;
    
    // Use actual shopkeeper UPI details or show message to set them up
    const upiId = upiData && upiData.upiId ? upiData.upiId : null;
    const qrCode = upiData && upiData.upiQrCode ? upiData.upiQrCode : null;
    
    if (paymentMode === 'UPI') {
      if (!upiId && !qrCode) {
        // Show message that shopkeeper hasn't set up UPI yet
        container.innerHTML = 
          '<div style="background: #fff3cd; padding: 20px; border-radius: 10px; border: 2px solid #ffc107;">' +
            '<h4 style="color: #856404; margin-bottom: 15px; text-align: center;"><i class="fas fa-qrcode"></i> Pay via UPI</h4>' +
            '<div style="text-align: center; padding: 30px 20px;">' +
              '<i class="fas fa-info-circle" style="font-size: 48px; color: #ffc107; margin-bottom: 15px;"></i>' +
              '<p style="color: #856404; font-size: 14px; margin: 10px 0;">Shopkeeper has not configured UPI payment details yet.</p>' +
              '<p style="color: #856404; font-size: 13px; margin: 10px 0;">Please contact the shopkeeper or choose another payment method.</p>' +
            '</div>' +
            '<div style="background: #d1ecf1; padding: 12px; border-radius: 8px; margin-top: 15px;">' +
              '<p style="margin: 0; font-size: 13px; color: #0c5460;"><i class="fas fa-info-circle"></i> <strong>Amount to pay:</strong> Rs. ' + parseFloat(amount).toFixed(2) + '</p>' +
            '</div>' +
          '</div>';
      } else {
        // Show UPI QR code and ID
        var qrDisplay = qrCode ? 
          '<img src="' + qrCode + '" alt="UPI QR Code" style="max-width: 200px; max-height: 200px;">' :
          '<i class="fas fa-qrcode" style="font-size: 120px; color: #2c5f2d;"></i>';
        
        container.innerHTML = 
          '<div style="background: #fff3cd; padding: 20px; border-radius: 10px; border: 2px solid #ffc107;">' +
            '<h4 style="color: #856404; margin-bottom: 15px; text-align: center;"><i class="fas fa-qrcode"></i> Pay via UPI</h4>' +
            '<div style="text-align: center; margin: 20px 0;">' +
              '<div style="background: white; padding: 20px; border-radius: 10px; display: inline-block; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">' +
                qrDisplay +
                '<p style="color: #666; font-size: 12px; margin-top: 10px;">Shop QR Code</p>' +
              '</div>' +
            '</div>' +
            '<div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: center;">' +
              '<p style="margin: 5px 0; color: #666; font-size: 13px;">UPI ID:</p>' +
              '<p style="margin: 5px 0; font-size: 20px; font-weight: bold; color: #2c5f2d; user-select: all; letter-spacing: 1px;">' + upiId + '</p>' +
              '<button type="button" onclick="navigator.clipboard.writeText(\'' + upiId + '\'); toast.success(\'UPI ID copied!\');" style="margin-top: 10px; padding: 8px 16px; background: #e3f2fd; border: none; border-radius: 5px; cursor: pointer; color: #1976d2; font-size: 13px;"><i class="fas fa-copy"></i> Copy UPI ID</button>' +
            '</div>' +
            '<div style="background: #d1ecf1; padding: 12px; border-radius: 8px; margin-top: 15px;">' +
              '<p style="margin: 0; font-size: 13px; color: #0c5460;"><i class="fas fa-info-circle"></i> <strong>Amount to pay:</strong> Rs. ' + parseFloat(amount).toFixed(2) + '</p>' +
            '</div>' +
          '</div>';
      }
    } else {
      container.innerHTML = '';
    }
  }

  async processBillPayment(event, billId, totalAmount, dueAmount) {
    event.preventDefault();
    
    const paymentMode = document.getElementById('bill-payment-mode').value;
    const paymentType = document.getElementById('bill-payment-type').value;
    const amountPaid = paymentType === 'Partial' ? parseFloat(document.getElementById('bill-amount-paid').value) : dueAmount;
    
    if (!paymentMode) {
      toast.error('Please select a payment mode');
      return;
    }
    
    if (paymentType === 'Partial' && (!amountPaid || amountPaid <= 0 || amountPaid > dueAmount)) {
      toast.error('Please enter a valid amount paid');
      return;
    }
    
    try {
      // Use the new customer payment endpoint
      await billsAPI.makePayment(billId, {
        amountPaid: amountPaid,
        paymentMode: paymentMode
      });
      
      toast.success('Payment recorded successfully!');
      document.getElementById('bill-payment-modal').remove();
      this.loadBills();
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error(error.message || 'Failed to process payment');
    }
  }

  setupEventListeners() {
    // Event listeners can be added here
  }
}

const myBills = new MyBills();
