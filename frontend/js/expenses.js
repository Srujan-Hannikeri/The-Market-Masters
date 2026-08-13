// Expenses Module
const expenses = {
  expenses: [],
  todayExpenses: [],
  monthExpenses: [],
  yearExpenses: [],
  currentPeriod: 'today',
  currentFilter: 'all',
  listenersSetup: false,

  async load() {
    await this.loadExpenses();
    if (!this.listenersSetup) {
      this.setupEventListeners();
      this.listenersSetup = true;
    }
  },

  async loadExpenses() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await expensesAPI.getDaily(today);
      
      this.todayExpenses = response.todayExpenses || response.expenses || [];
      this.monthExpenses = response.monthExpenses || [];
      this.yearExpenses = response.yearExpenses || [];

      // If month/year items weren't fetched, fetch all expenses as fallback
      if (this.monthExpenses.length === 0 || this.yearExpenses.length === 0) {
        try {
          const allRes = await expensesAPI.getExpenses({ limit: 1000 });
          const allList = allRes.expenses || [];
          
          const now = new Date();
          const curYear = now.getFullYear();
          const curMonth = now.getMonth();

          if (this.monthExpenses.length === 0) {
            this.monthExpenses = allList.filter(e => {
              const d = new Date(e.date || e.expenseDate);
              return d.getFullYear() === curYear && d.getMonth() === curMonth;
            });
          }
          if (this.yearExpenses.length === 0) {
            this.yearExpenses = allList.filter(e => {
              const d = new Date(e.date || e.expenseDate);
              return d.getFullYear() === curYear;
            });
          }
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
    // Add expense button
    document.getElementById('add-expense-btn')?.addEventListener('click', () => {
      const dateEl = document.getElementById('expense-date');
      if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
      const typeSelect = document.getElementById('expense-type');
      if (typeSelect) {
        typeSelect.value = 'Inventory';
        this.toggleInventoryFields('Inventory');
      }
      modal.open('add-expense-modal');
    });

    // Add expense form
    document.getElementById('add-expense-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.createExpense();
    });

    // Period Tab Buttons
    document.querySelectorAll('.expense-period-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const period = e.currentTarget.getAttribute('data-period');
        this.setPeriod(period);
      });
    });

    // Expense Type Filter
    document.getElementById('expense-type-filter')?.addEventListener('change', (e) => {
      this.currentFilter = e.target.value;
      this.renderExpenses();
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
    if (!fields) return;

    if (type === 'Inventory') {
      fields.style.display = 'block';
      const container = document.getElementById('inventory-items-container');
      if (container && container.children.length === 0) {
        this.addInventoryRow();
      }
    } else {
      fields.style.display = 'none';
    }
  },

  addInventoryRow() {
    const container = document.getElementById('inventory-items-container');
    if (!container) return;

    const rowId = Date.now();
    const row = document.createElement('div');
    row.className = 'expense-inventory-item-row';
    row.style.cssText = `
      background: #fff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 10px;
      position: relative;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    `;

    row.innerHTML = `
      <button type="button"
        style="position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:50%;background:#ef4444;color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;line-height:1;"
        onclick="this.closest('.expense-inventory-item-row').remove(); expenses.calculateInventoryTotal();"
        title="Remove Row">
        <i class="fas fa-times"></i>
      </button>
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr 0.8fr 0.8fr;gap:10px;padding-right:30px;">
        <div>
          <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.4px;">Item Name *</label>
          <input type="text" class="exp-item-name" placeholder="e.g. Rice 10kg" list="product-names-list" required
            style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;outline:none;box-sizing:border-box;transition:border-color 0.2s;"
            onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='#e2e8f0'">
        </div>
        <div>
          <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.4px;">MRP (₹) *</label>
          <input type="number" class="exp-item-mrp" placeholder="0.00" step="0.01" min="0" required
            style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;outline:none;box-sizing:border-box;transition:border-color 0.2s;"
            onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='#e2e8f0'">
        </div>
        <div>
          <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.4px;">Billing Amt (₹) *</label>
          <input type="number" class="exp-item-cost" placeholder="0.00" step="0.01" min="0" required
            style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;outline:none;box-sizing:border-box;transition:border-color 0.2s;"
            onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='#e2e8f0'"
            oninput="expenses.calculateInventoryTotal()">
        </div>
        <div>
          <label style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.4px;">Qty *</label>
          <input type="number" class="exp-item-qty" placeholder="1" min="1" value="1" required
            style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;outline:none;box-sizing:border-box;text-align:center;transition:border-color 0.2s;"
            onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='#e2e8f0'"
            oninput="expenses.calculateInventoryTotal()">
        </div>
        <div>
          <label style="display:block;font-size:11px;font-weight:600;color:#e67e22;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.4px;" title="Minimum quantity before low-stock alert fires">Low Stock * <i class="fas fa-exclamation-triangle" style="font-size:9px;"></i></label>
          <input type="number" class="exp-item-lowstock" placeholder="e.g. 5" min="1" value="10" required
            style="width:100%;padding:8px 10px;border:1px solid #fbbf24;border-radius:6px;font-size:13px;outline:none;box-sizing:border-box;text-align:center;background:#fffbeb;transition:border-color 0.2s;"
            onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='#fbbf24'"
            title="Minimum stock before a low-stock alert appears on the dashboard">
        </div>
      </div>
    `;

    container.appendChild(row);
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

      if (rawDesc.startsWith('JSONMETA:')) {
        try {
          const meta = JSON.parse(rawDesc.substring(9));
          const parts = [];
          if (meta.agencyName) parts.push(`Agency: ${meta.agencyName}`);
          if (meta.notes) parts.push(meta.notes);
          displayDesc = parts.join(' | ') || 'Inventory Purchase';
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
          <td style="font-weight: 500; color: #334155; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${displayDesc}</td>
          <td style="font-weight: 700; color: #0f172a;">${formatCurrency(expense.amount)}</td>
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
    let notes = '-';
    let items = [];

    let rawDesc = expense.description || '';
    if (rawDesc.startsWith('JSONMETA:')) {
      try {
        const meta = JSON.parse(rawDesc.substring(9));
        agencyName = meta.agencyName || '-';
        notes = meta.notes || '-';
        items = meta.items || [];
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
        <div style="margin-top: 15px;">
          <h4 style="margin-bottom: 10px; color: var(--primary); font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;"><i class="fas fa-boxes"></i> Purchased Items Breakdown</h4>
          <table class="table" style="width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
            <thead style="background: #f8fafc;">
              <tr>
                <th style="padding: 10px; font-size: 12px;">Item Name</th>
                <th style="padding: 10px; font-size: 12px; text-align: center;">Qty</th>
                <th style="padding: 10px; font-size: 12px; text-align: right;">Billing Price (₹)</th>
                <th style="padding: 10px; font-size: 12px; text-align: right;">MRP (₹)</th>
                <th style="padding: 10px; font-size: 12px; text-align: right;">Total Billing (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => {
                const bPrice = item.billingPrice > 0 ? item.billingPrice : (expense.amount && item.qty ? (parseFloat(expense.amount) / item.qty) : 0);
                const mrpVal = item.mrp > 0 ? item.mrp : bPrice;
                const totVal = bPrice * item.qty;

                return `
                  <tr style="border-top: 1px solid #f1f5f9;">
                    <td style="padding: 10px; font-size: 13px; font-weight: 500;">${item.name}</td>
                    <td style="padding: 10px; font-size: 13px; text-align: center;"><span class="badge badge-info">${item.qty}</span></td>
                    <td style="padding: 10px; font-size: 13px; text-align: right; font-weight: 600; color: #0f172a;">${formatCurrency(bPrice)}</td>
                    <td style="padding: 10px; font-size: 13px; text-align: right; color: #64748b;">${formatCurrency(mrpVal)}</td>
                    <td style="padding: 10px; font-size: 13px; text-align: right; font-weight: 700; color: #047857;">${formatCurrency(totVal)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
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
            <div style="font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 4px;"><i class="fas fa-building" style="color: var(--primary);"></i> ${agencyName}</div>
          </div>
        </div>

        ${notes && notes !== '-' ? `
          <div style="margin-bottom: 15px; background: #f1f5f9; padding: 12px; border-radius: 6px; border-left: 4px solid var(--primary);">
            <strong style="font-size: 12px; color: #475569; text-transform: uppercase; display: block; margin-bottom: 4px;">Notes / Description:</strong>
            <span style="font-size: 13px; color: #1e293b;">${notes}</span>
          </div>
        ` : ''}

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
    let description = document.getElementById('expense-description')?.value?.trim() || '';
    const expenseDate = document.getElementById('expense-date')?.value;

    if (!type || !amount || !expenseDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Handle Inventory Purchase items auto-addition
    if (type === 'Inventory') {
      const itemRows = document.querySelectorAll('.expense-inventory-item-row');
      const addedItemsSummary = [];
      const itemsDetailList = [];

      for (const row of itemRows) {
        const name = row.querySelector('.exp-item-name').value.trim();
        const mrp = parseFloat(row.querySelector('.exp-item-mrp').value) || 0;
        const costPrice = parseFloat(row.querySelector('.exp-item-cost').value) || 0;
        const stock = parseInt(row.querySelector('.exp-item-qty').value) || 1;
        const lowStockInput = row.querySelector('.exp-item-lowstock');
        const lowStockVal = lowStockInput ? (parseInt(lowStockInput.value) || 10) : 10;

        // Validate low stock field is filled
        if (name && (!lowStockInput || !lowStockInput.value)) {
          toast.error(`Please enter a Low Stock Threshold for "${name || 'an item'}".`);
          return;
        }

        if (name) {
          try {
            await inventoryAPI.createProduct({
              name,
              mrp: mrp || costPrice,
              price: mrp || costPrice,
              costPrice: costPrice,
              agencyName: agencyName || '',
              stock: stock,
              lowStockThreshold: lowStockVal,
              minStock: lowStockVal
            });
          } catch (err) {
            // Product may already exist — createProduct handles stock merging server-side
          }
          addedItemsSummary.push(`${name} (Qty: ${stock})`);
          itemsDetailList.push({ name, mrp: mrp || costPrice, billingPrice: costPrice, qty: stock });
        }
      }

      const metaObj = {
        agencyName: agencyName || '',
        notes: description,
        items: itemsDetailList
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
      
      await this.loadExpenses();
      if (typeof inventory.load === 'function') {
        await inventory.load();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to add expense');
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
