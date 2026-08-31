// Expenses Module
const expenses = {
  expenses: [],
  todayExpenses: [],
  monthExpenses: [],
  yearExpenses: [],
  currentPeriod: 'today',
  currentFilter: 'all',

  async load() {
    try {
      await Promise.all([
        this.loadExpenses(),
        this.loadProducts()
      ]);
      this.loadAgencies();
    } finally {
    }
    // Always re-attach — SPA navigation recreates the DOM each visit
    this.setupEventListeners();
  },

  loadAgencies() {
    const agenciesMap = new Map();

    // 1. Extract from products
    if (this.inventoryProducts) {
      this.inventoryProducts.forEach(p => {
        if (p.agencyName && p.agencyName.trim()) {
          const name = p.agencyName.trim();
          if (!agenciesMap.has(name)) {
            agenciesMap.set(name, { name: name, phone: '' });
          }
        }
      });
    }

    // 2. Extract from expenses
    const allExpenses = [...(this.todayExpenses || []), ...(this.monthExpenses || []), ...(this.yearExpenses || [])];
    allExpenses.forEach(e => {
      const desc = e.description || '';
      if (desc.startsWith('JSONMETA:')) {
        try {
          const meta = JSON.parse(desc.substring(9));
          const name = (meta.agencyName || '').trim();
          const phone = (meta.agencyPhone || '').trim();
          if (name) {
            if (agenciesMap.has(name)) {
              if (phone && !agenciesMap.get(name).phone) {
                agenciesMap.get(name).phone = phone;
              }
            } else {
              agenciesMap.set(name, { name, phone });
            }
          }
        } catch (err) {}
      }
    });

    this.agenciesList = Array.from(agenciesMap.values());
  },

  showAgencyAutocomplete(input) {
    const list = document.getElementById('agency-autocomplete-list');
    if (!list) return;

    const val = input.value.toLowerCase().trim();
    if (!val) {
      list.style.display = 'none';
      return;
    }

    const matches = (this.agenciesList || []).filter(a => a.name.toLowerCase().includes(val));
    if (matches.length === 0) {
      list.style.display = 'none';
      return;
    }

    list.innerHTML = matches.map(a => {
      const name = a.name.replace(/'/g, "\\'");
      const phone = a.phone ? a.phone.replace(/'/g, "\\'") : '';
      return '<div style="padding:8px 10px;cursor:pointer;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155;"' +
        ' onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'#fff\'"' +
        ' onclick="expenses.selectAgencyAutocompleteItem(\'' + name + '\', \'' + phone + '\')">' +
        a.name + (a.phone ? ' <span style="color:#94a3b8;font-size:11px;">(' + a.phone + ')</span>' : '') +
        '</div>';
    }).join('');
    list.style.display = 'block';
  },

  selectAgencyAutocompleteItem(name, phone) {
    const nameInput = document.getElementById('expense-agency-name');
    const phoneInput = document.getElementById('expense-agency-phone');
    const list = document.getElementById('agency-autocomplete-list');
    
    if (nameInput) nameInput.value = name;
    if (phoneInput && phone && !phoneInput.value) phoneInput.value = phone;
    if (list) list.style.display = 'none';
  },


  async loadProducts() {
    try {
      const response = await inventoryAPI.getProducts({ limit: 1000 });
      this.inventoryProducts = response.products || [];
    } catch (error) {
      console.error('Failed to load products for autocomplete:', error);
    }
  },

  async loadExpenses() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await expensesAPI.getDaily(today);
      
      this.todayExpenses = response.todayExpenses || response.expenses || [];
      this.monthExpenses = response.monthExpenses || [];
      this.yearExpenses = response.yearExpenses || [];

      // If month/year items weren't fetched (API didn't support it), fetch all as fallback
      if (response.monthExpenses === undefined || response.yearExpenses === undefined) {
        try {
          const allRes = await expensesAPI.getExpenses({ limit: 1000 });
          const allList = allRes.expenses || [];
          
          const now = new Date();
          const curYear = now.getFullYear();
          const curMonth = now.getMonth();

          this.monthExpenses = allList.filter(e => {
            const d = new Date(e.date || e.expenseDate);
            return d.getFullYear() === curYear && d.getMonth() === curMonth;
          });
          this.yearExpenses = allList.filter(e => {
            const d = new Date(e.date || e.expenseDate);
            return d.getFullYear() === curYear;
          });
        } catch (err) {
        }
      }


      // Compute display totals accurately from final arrays
      const todayTotal = this.todayExpenses.reduce((s, e) => s + parseFloat(e.amount), 0);
      const monthTotal = this.monthExpenses.reduce((s, e) => s + parseFloat(e.amount), 0);
      const yearTotal = this.yearExpenses.reduce((s, e) => s + parseFloat(e.amount), 0);
      
      this.renderExpenses();
      
      const todayElem = document.getElementById('today-expenses-display');
      const monthElem = document.getElementById('month-expenses-display');
      const yearElem = document.getElementById('year-expenses-display');

      if (todayElem) todayElem.textContent = formatCurrency(todayTotal);
      if (monthElem) monthElem.textContent = formatCurrency(monthTotal);
      if (yearElem) yearElem.textContent = formatCurrency(yearTotal);
    } catch (error) {
      console.error('Failed to load expenses:', error);
      toast.error('Failed to load expenses');
    }
  },

  setupEventListeners() {
    // Helper: clone element to strip ALL existing event listeners, then re-attach one
    const rebind = (id, event, handler) => {
      const el = document.getElementById(id);
      if (!el) return;
      const fresh = el.cloneNode(true);
      el.parentNode.replaceChild(fresh, el);
      fresh.addEventListener(event, handler);
    };

    // Add expense button
    rebind('add-expense-btn', 'click', () => {
      const dateEl = document.getElementById('expense-date');
      if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
      const typeSelect = document.getElementById('expense-type');
      if (typeSelect) {
        typeSelect.value = 'Inventory';
        this.toggleInventoryFields('Inventory');
      }
      modal.open('add-expense-modal');
    });

    // Add expense form — only one submit handler ever
    rebind('add-expense-form', 'submit', (e) => {
      e.preventDefault();
      this.createExpense();
    });

    // Period Tab Buttons — clone each to clear old handlers
    document.querySelectorAll('.expense-period-tab').forEach(btn => {
      const fresh = btn.cloneNode(true);
      btn.parentNode.replaceChild(fresh, btn);
      fresh.addEventListener('click', (e) => {
        const period = e.currentTarget.getAttribute('data-period');
        this.setPeriod(period);
      });
    });

    // Expense Type Filter
    rebind('expense-type-filter', 'change', (e) => {
      this.currentFilter = e.target.value;
      this.renderExpenses();
    });

    // Hide agency autocomplete when clicked outside
    document.addEventListener('click', (e) => {
      const list = document.getElementById('agency-autocomplete-list');
      const input = document.getElementById('expense-agency-name');
      if (list && e.target !== input) {
        list.style.display = 'none';
      }
    });
  },

  setPeriod(period) {
    this.currentPeriod = period;
    document.querySelectorAll('.expense-period-tab').forEach(btn => {
      if (btn.getAttribute('data-period') === period) {
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
      } else {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
      }
    });
    this.renderExpenses();
  },

  toggleInventoryFields(type) {
    const fields = document.getElementById('inventory-purchase-fields');
    const paymentSection = document.getElementById('inventory-payment-status-section');
    if (!fields) return;

    if (type === 'Inventory') {
      fields.style.display = 'block';
      if (paymentSection) paymentSection.style.display = 'block';
      const container = document.getElementById('inventory-items-container');
      if (container && container.children.length === 0) {
        this.addInventoryRow();
      }
    } else {
      fields.style.display = 'none';
      if (paymentSection) paymentSection.style.display = 'none';
    }
  },

  // Show/hide the "amount paid" input based on selected payment status
  onInvPaymentStatusChange(value) {
    const field = document.getElementById('inv-amount-paid-field');
    if (field) field.style.display = (value === 'Partially Paid') ? 'block' : 'none';
    if (value === 'Partially Paid') {
      // Reset display
      const dueDisplay = document.getElementById('inv-partial-due-display');
      if (dueDisplay) dueDisplay.style.display = 'none';
      const inp = document.getElementById('inv-amount-paid');
      if (inp) inp.value = '';
    }
  },

  // Live-update the Paying Now / Due cards as user types
  updatePartialDueDisplay() {
    const totalEl = document.getElementById('expense-amount');
    const paidEl = document.getElementById('inv-amount-paid');
    const dueDisplay = document.getElementById('inv-partial-due-display');
    const payingNowVal = document.getElementById('inv-paying-now-val');
    const dueVal = document.getElementById('inv-due-val');

    const total = parseFloat(totalEl?.value) || 0;
    const paid = parseFloat(paidEl?.value) || 0;
    const due = Math.max(0, total - paid);

    if (dueDisplay) dueDisplay.style.display = 'flex';
    if (payingNowVal) payingNowVal.textContent = '₹' + paid.toFixed(2);
    if (dueVal) dueVal.textContent = '₹' + due.toFixed(2);

    // Highlight border red if paid exceeds total
    if (paidEl) {
      paidEl.style.borderColor = paid > total && total > 0 ? '#ef4444' : '#f59e0b';
    }
  },

  addInventoryRow() {
    const container = document.getElementById('inventory-items-container');
    if (!container) return;

    const rowId = Date.now();
    const row = document.createElement('div');
    row.className = 'expense-inventory-item-row';

    row.innerHTML = `
      <button type="button" class="expense-item-remove"
        onclick="this.closest('.expense-inventory-item-row').remove(); expenses.calculateInventoryTotal();"
        title="Remove Row">
        <i class="fas fa-times"></i>
      </button>
      <div class="expense-inventory-grid">
        <div class="expense-item-field expense-item-name-field" style="position:relative;">
          <label class="expense-item-label">Item Name *</label>
          <input type="text" class="exp-item-name" placeholder="e.g. Rice 10kg" autocomplete="off" required
            style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;outline:none;box-sizing:border-box;transition:border-color 0.2s;"
            onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='#e2e8f0'"
            oninput="expenses.showAutocomplete(this)">
          <div class="autocomplete-list" style="position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #e2e8f0;border-radius:0 0 6px 6px;max-height:150px;overflow-y:auto;z-index:100;display:none;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);"></div>
        </div>
        <div class="expense-item-field">
          <label class="expense-item-label">MRP (₹) *</label>
          <input type="number" class="exp-item-mrp" placeholder="0.00" step="0.01" min="0" required
            style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;outline:none;box-sizing:border-box;transition:border-color 0.2s;"
            onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='#e2e8f0'">
        </div>
        <div class="expense-item-field">
          <label class="expense-item-label">Billing Amt (₹) *</label>
          <input type="number" class="exp-item-cost" placeholder="0.00" step="0.01" min="0" required
            style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;outline:none;box-sizing:border-box;transition:border-color 0.2s;"
            onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='#e2e8f0'"
            oninput="expenses.calculateInventoryTotal()">
        </div>
        <div class="expense-item-field">
          <label class="expense-item-label">Qty *</label>
          <input type="number" class="exp-item-qty" placeholder="1" min="1" value="1" required
            style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;outline:none;box-sizing:border-box;text-align:center;transition:border-color 0.2s;"
            onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='#e2e8f0'"
            oninput="expenses.calculateInventoryTotal()">
        </div>
        <div class="expense-item-field">
          <label class="expense-item-label expense-item-lowstock-label" title="Minimum quantity before low-stock alert fires">Low Stock * <i class="fas fa-exclamation-triangle"></i></label>
          <input type="number" class="exp-item-lowstock" placeholder="e.g. 5" min="1" value="10" required
            style="width:100%;padding:8px 10px;border:1px solid #fbbf24;border-radius:6px;font-size:13px;outline:none;box-sizing:border-box;text-align:center;background:#fffbeb;transition:border-color 0.2s;"
            onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='#fbbf24'">
        </div>
        <div class="expense-item-field">
          <label class="expense-item-label">Expiry Date</label>
          <input type="date" class="exp-item-expiry"
            style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;outline:none;box-sizing:border-box;transition:border-color 0.2s;"
            onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='#e2e8f0'">
        </div>
      </div>
    `;

    container.appendChild(row);
    
    // Hide autocomplete list if clicked outside
    document.addEventListener('click', (e) => {
      const activeList = row.querySelector('.autocomplete-list');
      if (activeList && e.target !== row.querySelector('.exp-item-name')) {
        activeList.style.display = 'none';
      }
    });
  },

  showAutocomplete(input) {
    const list = input.nextElementSibling;
    const val = input.value.toLowerCase().trim();
    if (!val) {
      list.style.display = 'none';
      return;
    }

    const matches = (this.inventoryProducts || []).filter(p => p.name.toLowerCase().includes(val));
    if (matches.length === 0) {
      list.style.display = 'none';
      return;
    }

    list.innerHTML = matches.map(p => {
      const name = p.name.replace(/'/g, "\\'");
      const mrp = p.mrp || p.price || 0;
      const minStock = p.minStock || 10;
      return '<div style="padding:8px 10px;cursor:pointer;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155;"' +
        ' onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'#fff\'"' +
        ' onclick="expenses.selectAutocompleteItem(this, \'' + name + '\', ' + mrp + ', ' + minStock + ')">' +
        p.name + ' <span style="color:#94a3b8;font-size:11px;">(₹' + mrp + ')</span>' +
        '</div>';
    }).join('');
    list.style.display = 'block';
  },

  selectAutocompleteItem(element, name, mrp, lowStock) {
    const list = element.parentElement;
    const fieldDiv = list.parentElement;
    const inputName = fieldDiv.querySelector('.exp-item-name');
    const row = fieldDiv.closest('.expense-inventory-item-row');
    
    if (inputName) inputName.value = name;
    
    if (row) {
      const inputMrp = row.querySelector('.exp-item-mrp');
      const inputLowStock = row.querySelector('.exp-item-lowstock');
      
      if (mrp && inputMrp && !inputMrp.value) inputMrp.value = mrp;
      if (lowStock && inputLowStock && !inputLowStock.value) inputLowStock.value = lowStock;
    }
    
    list.style.display = 'none';
  },

  calculateInventoryTotal() {
    let total = 0;
    document.querySelectorAll('.expense-inventory-item-row').forEach(row => {
      const cost = parseFloat(row.querySelector('.exp-item-cost').value) || 0;
      const qty = parseInt(row.querySelector('.exp-item-qty').value) || 0;
      total += cost * qty;
    });

    const amountInput = document.getElementById('expense-amount');
    if (amountInput && total > 0) {
      amountInput.value = total.toFixed(2);
    }
  },

  renderExpenses() {
    const tbody = document.getElementById('expenses-table');
    if (!tbody) return;

    let targetList = [];
    let periodLabel = 'today';
    if (this.currentPeriod === 'month') {
      targetList = this.monthExpenses;
      periodLabel = 'this month';
    } else if (this.currentPeriod === 'year') {
      targetList = this.yearExpenses;
      periodLabel = 'this year';
    } else {
      targetList = this.todayExpenses;
      periodLabel = 'today';
    }

    if (this.currentFilter !== 'all') {
      targetList = targetList.filter(e => e.category === this.currentFilter);
    }

    if (targetList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center">
            <div class="empty-state">
              <i class="fas fa-wallet"></i>
              <p>No expenses recorded ${periodLabel}</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = targetList.map(expense => {
      let displayDesc = '-';
      let rawDesc = expense.description || '';
      let paymentStatusBadge = '';

      if (rawDesc.startsWith('JSONMETA:')) {
        try {
          const meta = JSON.parse(rawDesc.substring(9));
          const parts = [];
          if (meta.agencyName) parts.push(`Agency: ${meta.agencyName}`);
          if (meta.notes) parts.push(meta.notes);
          displayDesc = parts.join(' | ') || 'Inventory Purchase';

          // Build payment status badge
          if (meta.paymentStatus) {
            const ps = meta.paymentStatus;
            const badgeStyles = {
              'Paid':           'background:#dcfce7;color:#15803d;border:1px solid #86efac;',
              'Partially Paid': 'background:#fef9c3;color:#854d0e;border:1px solid #fde047;',
              'Unpaid':         'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;'
            };
            const style = badgeStyles[ps] || badgeStyles['Unpaid'];
            const icon = ps === 'Paid' ? '✅' : ps === 'Partially Paid' ? '🟡' : '🔴';
            paymentStatusBadge = `<span style="${style} padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700; white-space:nowrap;">${icon} ${ps}</span>`;
          }
        } catch (e) {
          displayDesc = rawDesc;
        }
      } else {
        // Strip legacy [Items Restocked: ...] text if present
        let cleanText = rawDesc.replace(/\s*\[Items Restocked:[^\]]+\]/g, '').trim();
        displayDesc = cleanText || '-';
      }

      return `
        <tr onclick="expenses.viewExpenseDetails('${expense.id}')" style="cursor: pointer; transition: background 0.15s ease;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'" title="Click to view expense card breakdown">
          <td><span class="badge badge-info">${expense.category || expense.type || '-'}</span></td>
          <td style="font-weight: 500; color: #334155; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${displayDesc}</td>
          <td style="font-weight: 700; color: #0f172a;">${formatCurrency(expense.amount)}</td>
          <td>${paymentStatusBadge}</td>
          <td style="color: #64748b; font-size: 13px; font-weight: 500;">${formatDate(expense.date || expense.expenseDate)}</td>
        </tr>
      `;
    }).join('');
  },

  async viewExpenseDetails(expenseId) {
    let expense = [...this.todayExpenses, ...this.monthExpenses, ...this.yearExpenses].find(e => e.id == expenseId);
    if (!expense) {
      try {
        const res = await expensesAPI.getExpense(expenseId);
        expense = res.expense;
      } catch (err) {
        toast.error('Failed to load expense details');
        return;
      }
    }
    if (!expense) return;

    const modalBody = document.getElementById('expense-details-body');
    if (!modalBody) return;

    let agencyName = '-';
    let agencyPhone = '';
    let notes = '-';
    let items = [];
    let paymentStatus = '';
    let totalAmount = parseFloat(expense.amount) || 0;
    let amountPaid = 0;
    let dueAmount = 0;

    let rawDesc = expense.description || '';
    if (rawDesc.startsWith('JSONMETA:')) {
      try {
        const meta = JSON.parse(rawDesc.substring(9));
        agencyName = meta.agencyName || '-';
        agencyPhone = meta.agencyPhone || '';
        notes = meta.notes || '-';
        items = meta.items || [];
        paymentStatus = meta.paymentStatus || '';
        totalAmount = parseFloat(meta.totalAmount) || parseFloat(expense.amount) || 0;
        amountPaid = parseFloat(meta.amountPaid) || 0;
        dueAmount = parseFloat(meta.dueAmount) || parseFloat((totalAmount - amountPaid).toFixed(2));
      } catch (e) {
        notes = rawDesc;
      }
    } else {
      // Legacy description parsing
      if (rawDesc.includes('Agency:')) {
        const agMatch = rawDesc.match(/Agency:\s*([^|\[]+)/);
        if (agMatch) agencyName = agMatch[1].trim();
      }
      
      // Parse legacy restocked items: [Items Restocked: Item 1 (Qty: 2), Item 2 (Qty: 5)]
      const itemsMatch = rawDesc.match(/\[Items Restocked:\s*([^\]]+)\]/);
      if (itemsMatch) {
        const rawItemsStr = itemsMatch[1];
        const itemTokens = rawItemsStr.split(',');
        itemTokens.forEach(token => {
          const m = token.match(/([^(]+)(?:\(Qty:\s*(\d+)\))?/);
          if (m) {
            const name = m[1].trim();
            const qty = parseInt(m[2]) || 1;
            items.push({ name, qty, billingPrice: 0, mrp: 0 });
          }
        });
      }
      
      // Enrich legacy items with MRP and billing price from inventory if missing
      try {
        const prodRes = await inventoryAPI.getProducts();
        const allProds = prodRes.products || [];
        items.forEach(item => {
          const matchProd = allProds.find(p => p.name.toLowerCase() === item.name.toLowerCase());
          if (matchProd) {
            item.mrp = parseFloat(matchProd.mrp) || parseFloat(matchProd.price) || 0;
            item.billingPrice = parseFloat(matchProd.costPrice) || (expense.amount && item.qty ? (parseFloat(expense.amount) / item.qty) : 0);
          } else if (!item.billingPrice && expense.amount && item.qty) {
            item.billingPrice = parseFloat(expense.amount) / item.qty;
          }
        });
      } catch (err) {
        items.forEach(item => {
          if (!item.billingPrice && expense.amount && item.qty) {
            item.billingPrice = parseFloat(expense.amount) / item.qty;
          }
        });
      }

      // Clean notes display
      notes = rawDesc.replace(/^Agency:[^|]+\|?\s*/, '').replace(/\s*\[Items Restocked:[^\]]+\]/g, '').trim();
    }

    let itemsTableHtml = '';
    if (items.length > 0) {
      itemsTableHtml = `
        <section class="purchased-items-card">
          <div class="purchased-items-heading">
            <span class="purchased-items-icon"><i class="fas fa-boxes"></i></span>
            <div><h4>Items Purchased</h4><p>${items.length} item${items.length === 1 ? '' : 's'} in this expense</p></div>
          </div>
          <div class="purchased-items-table-wrap">
          <table class="table purchased-items-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Qty</th>
                <th>Billing Price (₹)</th>
                <th>MRP (₹)</th>
                <th>Total Billing (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => {
                const bPrice = item.billingPrice > 0 ? item.billingPrice : (expense.amount && item.qty ? (parseFloat(expense.amount) / item.qty) : 0);
                const mrpVal = item.mrp > 0 ? item.mrp : bPrice;
                const totVal = bPrice * item.qty;

                return `
                  <tr>
                    <td>${item.name}</td>
                    <td class="item-quantity"><span class="badge badge-info">${item.qty}</span></td>
                    <td>${formatCurrency(bPrice)}</td>
                    <td>${formatCurrency(mrpVal)}</td>
                    <td class="item-total">${formatCurrency(totVal)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          </div>
        </section>
      `;
    }

    modalBody.innerHTML = `
      <div style="background: #fff; border-radius: 8px; padding: 5px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 15px;">
          <div>
            <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600;">Expense Category</span>
            <div style="margin-top: 4px;"><span class="badge badge-info" style="font-size: 13px; padding: 4px 12px;">${expense.category || expense.type || '-'}</span></div>
          </div>
          <div>
            <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600;">Total Expense Amount</span>
            <div style="font-size: 18px; font-weight: 700; color: #ef4444; margin-top: 2px;">${formatCurrency(expense.amount)}</div>
          </div>
          <div>
            <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600;">Expense Date</span>
            <div style="font-size: 13px; font-weight: 500; color: #334155; margin-top: 4px;"><i class="far fa-calendar-alt" style="color: var(--primary);"></i> ${formatDate(expense.date || expense.expenseDate)}</div>
          </div>
          <div>
            <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600;">Agency / Distributor</span>
            <div style="font-size: 14px; font-weight: 600; color: #0f172a; margin-top: 4px;">
              <i class="fas fa-building" style="color: var(--primary);"></i> ${agencyName}
            </div>
            ${agencyPhone ? `
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 8px 12px;">
                <a href="tel:${agencyPhone}" style="display: flex; align-items: center; gap: 6px; text-decoration: none; color: #15803d; font-size: 15px; font-weight: 700; flex: 1;">
                  <i class="fas fa-phone-alt" style="font-size: 13px;"></i>
                  ${agencyPhone}
                </a>
                <button onclick="navigator.clipboard.writeText('${agencyPhone}').then(() => toast.success('Phone number copied!'))" 
                  style="background: #16a34a; color: white; border: none; border-radius: 6px; padding: 5px 10px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 4px; white-space: nowrap;">
                  <i class="fas fa-copy"></i> Copy
                </button>
              </div>
            ` : ''}
          </div>
        </div>

        ${notes && notes !== '-' ? `
          <div style="margin-bottom: 15px; background: #f1f5f9; padding: 12px; border-radius: 6px; border-left: 4px solid var(--primary);">
            <strong style="font-size: 12px; color: #475569; text-transform: uppercase; display: block; margin-bottom: 4px;">Notes / Description:</strong>
            <span style="font-size: 13px; color: #1e293b;">${notes}</span>
          </div>
        ` : ''}

        ${paymentStatus ? (() => {
          const configs = {
            'Paid': {
              bg: '#dcfce7', border: '#86efac', iconColor: '#16a34a',
              icon: 'fa-check-circle', label: 'Paid in Full', labelColor: '#15803d'
            },
            'Partially Paid': {
              bg: '#fef9c3', border: '#fde047', iconColor: '#ca8a04',
              icon: 'fa-adjust', label: 'Partially Paid', labelColor: '#854d0e'
            },
            'Unpaid': {
              bg: '#fee2e2', border: '#fca5a5', iconColor: '#dc2626',
              icon: 'fa-times-circle', label: 'Unpaid', labelColor: '#991b1b'
            }
          };
          const c = configs[paymentStatus] || configs['Unpaid'];
          return `
            <div style="background: ${c.bg}; border: 1px solid ${c.border}; border-radius: 10px; padding: 14px 16px; margin-bottom: 15px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: ${paymentStatus !== 'Paid' ? '10px' : '0'};">
                <i class="fas ${c.icon}" style="color: ${c.iconColor}; font-size: 18px;"></i>
                <span style="font-weight: 700; font-size: 15px; color: ${c.labelColor};">Payment Status: ${c.label}</span>
              </div>
              ${paymentStatus !== 'Paid' ? `
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 8px;">
                  <div style="background: rgba(255,255,255,0.7); padding: 10px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Total Bill</div>
                    <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 2px;">₹${totalAmount.toFixed(2)}</div>
                  </div>
                  <div style="background: rgba(255,255,255,0.7); padding: 10px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 11px; color: #16a34a; font-weight: 600; text-transform: uppercase;">Paid</div>
                    <div style="font-size: 16px; font-weight: 700; color: #15803d; margin-top: 2px;">₹${amountPaid.toFixed(2)}</div>
                  </div>
                  <div style="background: rgba(255,255,255,0.7); padding: 10px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 11px; color: #dc2626; font-weight: 600; text-transform: uppercase;">Due</div>
                    <div style="font-size: 16px; font-weight: 700; color: #b91c1c; margin-top: 2px;">₹${dueAmount.toFixed(2)}</div>
                  </div>
                </div>
              ` : `
                <div style="font-size: 13px; color: #166534; margin-top: 4px;">
                  Full amount of ₹${totalAmount.toFixed(2)} paid to the agency.
                </div>
              `}
            </div>`;
        })() : ''}

        ${itemsTableHtml}
      </div>
    `;

    const overlay = document.getElementById('modal-overlay');
    const modalEl = document.getElementById('expense-details-modal');
    if (overlay && modalEl) {
      overlay.classList.remove('hidden');
      modalEl.classList.remove('hidden');
    } else {
      modal.open('expense-details-modal');
    }
  },

  async createExpense() {
    const type = document.getElementById('expense-type')?.value;
    const amount = parseFloat(document.getElementById('expense-amount')?.value);
    const agencyName = document.getElementById('expense-agency-name')?.value?.trim();
    const agencyPhone = document.getElementById('expense-agency-phone')?.value?.trim();
    let description = document.getElementById('expense-description')?.value?.trim() || '';
    const expenseDate = document.getElementById('expense-date')?.value;

    if (!type || !amount || !expenseDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    const saveBtn = document.querySelector('#add-expense-form button[type="submit"]');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    // Handle Inventory Purchase items auto-addition
    if (type === 'Inventory') {
      const itemRows = document.querySelectorAll('.expense-inventory-item-row');
      const itemsDetailList = [];
      const inventoryPromises = [];

      for (const row of itemRows) {
        const name = row.querySelector('.exp-item-name').value.trim();
        const mrp = parseFloat(row.querySelector('.exp-item-mrp').value) || 0;
        const costPrice = parseFloat(row.querySelector('.exp-item-cost').value) || 0;
        const stock = parseInt(row.querySelector('.exp-item-qty').value) || 1;
        const lowStockInput = row.querySelector('.exp-item-lowstock');
        const lowStockVal = lowStockInput ? (parseInt(lowStockInput.value) || 10) : 10;
        const expiryInput = row.querySelector('.exp-item-expiry');
        const expiryDate = expiryInput && expiryInput.value ? expiryInput.value : null;

        // Validate low stock field is filled
        if (name && (!lowStockInput || !lowStockInput.value)) {
          toast.error(`Please enter a Low Stock Threshold for "${name || 'an item'}".`);
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Expense';
          }
          return;
        }

        if (name) {
          inventoryPromises.push(
            inventoryAPI.createProduct({
              name,
              mrp: mrp || costPrice,
              price: mrp || costPrice,
              costPrice: costPrice,
              agencyName: agencyName || '',
              stock: stock,
              lowStockThreshold: lowStockVal,
              minStock: lowStockVal,
              expiryDate: expiryDate
            }).catch(err => {
              // Product may already exist
            })
          );
          itemsDetailList.push({ name, mrp: mrp || costPrice, billingPrice: costPrice, qty: stock });
        }
      }

      await Promise.all(inventoryPromises);

      // Capture payment status
      const selectedPayStatus = document.querySelector('input[name="inv-payment-status"]:checked')?.value || 'Unpaid';
      const amountPaidNow = selectedPayStatus === 'Partially Paid'
        ? (parseFloat(document.getElementById('inv-amount-paid')?.value) || 0)
        : selectedPayStatus === 'Paid' ? amount : 0;

      const metaObj = {
        agencyName: agencyName || '',
        agencyPhone: agencyPhone || '',
        notes: description,
        items: itemsDetailList,
        paymentStatus: selectedPayStatus,
        totalAmount: amount,
        amountPaid: amountPaidNow,
        dueAmount: parseFloat((amount - amountPaidNow).toFixed(2))
      };

      description = `JSONMETA:${JSON.stringify(metaObj)}`;
    }

    const expenseData = {
      category: type,
      type,
      amount,
      description,
      date: expenseDate,
      expenseDate
    };

    try {
      await expensesAPI.createExpense(expenseData);
      toast.success('Expense recorded and inventory updated automatically!');
      modal.close('add-expense-modal');
      document.getElementById('add-expense-form').reset();
      
      const itemsContainer = document.getElementById('inventory-items-container');
      if (itemsContainer) itemsContainer.innerHTML = '';
      
      // Load in background without awaiting, so UI doesn't freeze
      this.loadExpenses();
      this.loadProducts();
      if (typeof inventory !== 'undefined' && typeof inventory.load === 'function') {
        inventory.load();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to add expense');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Expense';
      }
    }
  },

  async deleteExpense(id) {
    const confirmed = await confirmDialog('Are you sure you want to delete this expense?');
    if (!confirmed) return;

    try {
      await expensesAPI.deleteExpense(id);
      toast.success('Expense deleted successfully!');
      await this.loadExpenses();
    } catch (error) {
      toast.error('Failed to delete expense');
    }
  }
};
