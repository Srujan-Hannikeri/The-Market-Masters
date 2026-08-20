// Payments Module
const payments = {
  pendingDues: [],
  listenersSetup: false,
  allBills: [],

  async load() {
    await Promise.all([
      this.loadPaymentSummary(),
      this.loadPendingDues(),
      this.loadAllPayments(),
      this.loadAllBills(),
      this.loadVerificationPending(),
    ]);

    if (!this.listenersSetup) {
      this.setupEventListeners();
      this.listenersSetup = true;
    }
  },

  setupEventListeners() {
    const form = document.getElementById("add-payment-form");

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.recordPayment();
      });
    }
  },

  async loadPaymentSummary() {
    try {
      const response = await paymentsAPI.getSummary();

      this.renderPaymentSummary(response.summary);
    } catch (error) {
      console.error("Payment Summary Error:", error);
      toast.error("Failed to load payment summary");
    }
  },

  renderPaymentSummary(summary) {
    const container = document.getElementById("payment-modes-summary");

    if (!container) {
      return;
    }

    if (!summary) {
      container.innerHTML =
        '<p class="text-center">No payment data available</p>';
      return;
    }

    const modes = [
      {
        key: "Cash",
        icon: "fa-money-bill-wave",
        class: "cash",
      },
      {
        key: "UPI",
        icon: "fa-mobile-alt",
        class: "upi",
      },
      {
        key: "Card",
        icon: "fa-credit-card",
        class: "card-payment",
      },
      {
        key: "Net Banking",
        icon: "fa-university",
        class: "net-banking",
      },
    ];

    const byMode = summary.byMode || {};

    container.innerHTML = modes
      .map((mode) => {
        const raw = byMode[mode.key];

        const amount =
          raw && typeof raw === "object"
            ? Number(raw.amount) || 0
            : Number(raw) || 0;

        return `
          <div class="payment-mode-card ${mode.class}">
            <i class="fas ${mode.icon}"></i>
            <h4>${mode.key}</h4>
            <p>${formatCurrency(amount)}</p>
          </div>
        `;
      })
      .join("");
  },

  async loadPendingDues() {
    try {
      const response = await paymentsAPI.getPendingDues();

      this.pendingDues = response.pendingDues || [];

      this.renderPendingDues();

      const countEl = document.getElementById("pending-count");

      if (countEl) {
        countEl.textContent = this.pendingDues.length;
      }
    } catch (error) {
      console.error("Pending Dues Error:", error);
      toast.error("Failed to load pending dues");
    }
  },

  renderPendingDues() {
    const tbody = document.getElementById("pending-dues-table");

    if (!tbody) {
      console.error("pending-dues-table element not found");
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

    tbody.innerHTML = this.pendingDues
      .map(
        (bill) => `
          <tr>
            <td>${bill.billNumber}</td>
            <td>${bill.customerName || "Walk-in"}</td>
            <td>${formatCurrency(bill.totalAmount)}</td>
            <td>${formatCurrency(bill.paidAmount)}</td>
            <td>
              <strong>${formatCurrency(bill.balanceAmount)}</strong>
            </td>
            <td>
              <button
                class="btn btn-sm btn-success"
                onclick="payments.openPaymentModal('${bill.id}')"
              >
                <i class="fas fa-plus"></i>
                Pay
              </button>
            </td>
          </tr>
        `,
      )
      .join("");
  },

  async loadAllPayments() {
    try {
      const response = await paymentsAPI.getPayments({
        limit: 50,
      });

      this.renderAllPayments(response.payments || []);
    } catch (error) {
      console.error("All Payments Error:", error);
      toast.error("Failed to load payments");
    }
  },

  async loadAllBills() {
    try {
      const response = await paymentsAPI.getAllBillsForPayments();

      this.allBills = response.bills || [];

      this.renderAllBills();
    } catch (error) {
      console.error("All Bills Error:", error);

      this.allBills = [];

      this.renderAllBills();
    }
  },

  renderAllBills() {
    const tbody = document.getElementById("all-bills-table");

    if (!tbody) {
      console.error("all-bills-table element not found");
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

    tbody.innerHTML = this.allBills
      .map(
        (bill) => `
          <tr>
            <td>${bill.billNumber}</td>
            <td>${bill.customerName || "Walk-in"}</td>
            <td>${formatCurrency(bill.totalAmount)}</td>
            <td>${formatCurrency(bill.paidAmount)}</td>
            <td>${formatCurrency(bill.balanceAmount)}</td>
            <td>${getStatusBadge(bill.paymentStatus)}</td>
          </tr>
        `,
      )
      .join("");
  },

  renderAllPayments(paymentsList) {
    const tbody = document.getElementById("all-payments-table");

    if (!tbody) {
      console.error("all-payments-table element not found");
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

    const modeBg = {
      Cash: "#10b981",
      UPI: "#3b82f6",
      Card: "#6366f1",
      Cheque: "#f59e0b",
      Online: "#3b82f6",
    };

    const badgeStyle = (mode) => {
      return `
        display:inline-flex;
        align-items:center;
        padding:3px 10px;
        border-radius:50px;
        font-size:11px;
        font-weight:700;
        text-transform:uppercase;
        letter-spacing:0.5px;
        background:${modeBg[mode] || "#64748b"};
        color:#fff
      `;
    };

    tbody.innerHTML = paymentsList
      .map((payment) => {
        const isPending = payment.paymentStatus === "Verification Pending";

        const paymentState = isPending
          ? `
            <button
              class="btn btn-sm btn-success"
              onclick="payments.confirmPayment('${payment.id}')"
            >
              <i class="fas fa-check"></i>
              Confirm
            </button>
          `
          : payment.paymentStatus === "Failed"
            ? `
            <span
              style="color:#dc2626;font-size:12px;font-weight:600;"
            >
              Failed
            </span>
          `
          : `
            <span
              style="color:#10b981;font-size:12px;font-weight:600;"
            >
              Confirmed
            </span>
          `;

        return `
          <tr
            style="${isPending ? "background:#fffbeb;" : ""}"
          >
            <td>${formatDate(payment.created_at)}</td>

            <td>
              ${
                payment.billId && payment.billId.billNumber
                  ? payment.billId.billNumber
                  : "-"
              }
            </td>

            <td>
              ${
                payment.billId && payment.billId.customerName
                  ? payment.billId.customerName
                  : "-"
              }
            </td>

            <td>
              <span style="${badgeStyle(payment.paymentMode)}">
                ${payment.paymentMode}
              </span>
            </td>

            <td>
              ${formatCurrency(payment.amount)}
            </td>

            <td>
              ${paymentState}
            </td>
          </tr>
        `;
      })
      .join("");
  },

  async loadVerificationPending() {
    try {
      const response = await paymentsAPI.getVerificationPendingBills();

      const pendingPayments = response.payments || [];

      const countEl = document.getElementById("verification-pending-count");

      if (countEl) {
        countEl.textContent = pendingPayments.length;

        countEl.style.display =
          pendingPayments.length > 0 ? "inline-flex" : "none";
      }

      this.renderVerificationPending(pendingPayments);
    } catch (error) {
      console.error("Error loading verification pending:", error);
    }
  },

  renderVerificationPending(pendingPayments) {
    const container = document.getElementById("verification-pending-section");

    if (!container) {
      return;
    }

    if (pendingPayments.length === 0) {
      container.style.display = "none";
      return;
    }

    container.style.display = "block";

    const tbody = document.getElementById("verification-pending-table");

    if (!tbody) {
      return;
    }

    tbody.innerHTML = pendingPayments
      .map((payment) => {
        const billNumber =
          payment.billId && payment.billId.billNumber
            ? payment.billId.billNumber
            : "-";

        const customerName =
          payment.customerId && payment.customerId.name
            ? payment.customerId.name
            : payment.billId && payment.billId.customerName
              ? payment.billId.customerName
              : "-";

        const customerPhone =
          payment.customerId && payment.customerId.phone
            ? payment.customerId.phone
            : payment.billId && payment.billId.customerPhone
              ? payment.billId.customerPhone
              : "-";

        return `
          <tr style="background:#fffbeb;">
            <td>
              <strong>${billNumber}</strong>
            </td>

            <td>${customerName}</td>

            <td>${customerPhone}</td>

            <td>${payment.paymentMode}</td>

            <td>
              <strong>
                ${formatCurrency(payment.amount)}
              </strong>
            </td>

            <td>
              ${formatDate(payment.created_at)}
            </td>

            <td>
              <button
                class="btn btn-sm btn-success"
                onclick="payments.confirmPayment('${payment.id}')"
              >
                <i class="fas fa-check-circle"></i>
                Confirm Payment
              </button>

              <button
                class="btn btn-sm btn-danger"
                style="margin-left:4px;"
                onclick="payments.rejectPayment('${payment.id}')"
              >
                <i class="fas fa-times"></i>
                Reject
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  },

  async confirmPayment(paymentId) {
    const confirmed = await confirmDialog(
      "Confirm this customer payment?\n\n" +
        "This will update the bill balance and mark payment as confirmed.",
    );

    if (!confirmed) {
      return;
    }

    try {
      await paymentsAPI.confirmPayment(paymentId);

      toast.success("Payment confirmed! Bill updated.");

      await this.load();
    } catch (error) {
      toast.error(error.message || "Failed to confirm payment");
    }
  },

  async rejectPayment(paymentId) {
    const confirmed = await confirmDialog(
      "Reject this payment?\n\n" +
        "The bill will remain unpaid and the customer will need to pay again.",
    );

    if (!confirmed) {
      return;
    }

    try {
      await paymentsAPI.rejectPayment(paymentId);

      toast.warning("Payment rejected. Bill remains unpaid.");

      await this.load();
    } catch (error) {
      toast.error(error.message || "Failed to reject payment");
    }
  },

  openPaymentModal(billId) {
    const bill = this.pendingDues.find((b) => b.id === billId);

    if (!bill) {
      return;
    }

    const billIdEl = document.getElementById("payment-bill-id");

    const billNumEl = document.getElementById("payment-bill-number");

    const dueAmountEl = document.getElementById("payment-due-amount");

    const amountEl = document.getElementById("payment-amount");

    if (billIdEl) {
      billIdEl.value = bill.id;
    }

    if (billNumEl) {
      billNumEl.value = bill.billNumber;
    }

    if (dueAmountEl) {
      dueAmountEl.value = formatCurrency(bill.balanceAmount);
    }

    if (amountEl) {
      amountEl.max = bill.balanceAmount;
      amountEl.value = bill.balanceAmount;
    }

    modal.open("add-payment-modal");
  },

  async recordPayment() {
    const billId = document.getElementById("payment-bill-id").value;

    const billNumber = document.getElementById("payment-bill-number").value;

    const amount = parseFloat(document.getElementById("payment-amount").value);

    const paymentMode = document.getElementById("payment-mode-input").value;

    const transactionId = document.getElementById(
      "payment-transaction-id",
    ).value;

    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }

    const confirmed = await confirmDialog(
      "Confirm Payment\n\n" +
        "Bill: " +
        billNumber +
        "\n" +
        "Amount: Rs." +
        amount.toFixed(2) +
        "\n" +
        "Mode: " +
        paymentMode +
        "\n\n" +
        "Click OK to confirm this payment.",
    );

    if (!confirmed) {
      return;
    }

    const submitBtn = document.querySelector(
      '#add-payment-form button[type="submit"]',
    );

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add("payment-processing");
      submitBtn.innerHTML = '<span class="spinner"></span> Recording payment…';
    }

    try {
      await paymentsAPI.createPayment({
        billId: billId,
        amountPaid: amount,
        paymentMode: paymentMode,
        transactionId: transactionId,
      });

      toast.success("Payment confirmed and recorded!");

      modal.close("add-payment-modal");

      const form = document.getElementById("add-payment-form");

      if (form) {
        form.reset();
      }

      await this.load();
    } catch (error) {
      toast.error(error.message || "Failed to record payment");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove("payment-processing");
        submitBtn.innerHTML = "Confirm & Record Payment";
      }
    }
  },
};
