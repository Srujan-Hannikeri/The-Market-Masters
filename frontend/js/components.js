// UI Components

// ─── Business Page Loader ────────────────────────────────────────────────────
const loader = (() => {
  let depth = 0; // reference-count so nested calls don't hide prematurely

  const messages = [
    'Loading your store…',
    'Fetching data…',
    'Almost there…',
    'Crunching numbers…',
    'Updating records…',
    'Syncing inventory…',
  ];
  let msgIdx = 0;
  let msgTimer = null;

  function getEl()  { return document.getElementById('page-loader'); }
  function getMsg() { return document.getElementById('loader-text'); }

  function show(label) {
    depth++;
    const el = getEl();
    if (!el) return;
    const msgEl = getMsg();
    if (msgEl) msgEl.textContent = label || messages[0];
    el.classList.remove('hidden');

    // Cycle through messages every 1.8 s
    if (!msgTimer) {
      msgIdx = 0;
      msgTimer = setInterval(() => {
        msgIdx = (msgIdx + 1) % messages.length;
        if (getMsg() && depth > 0) getMsg().textContent = messages[msgIdx];
      }, 1800);
    }

    // Safety net: auto-hide after 4 s so it never gets stuck
    clearTimeout(loader._safetyTimer);
    loader._safetyTimer = setTimeout(() => forceHide(), 4000);
  }

  function hide() {
    depth = Math.max(0, depth - 1);
    if (depth > 0) return;
    clearInterval(msgTimer);
    msgTimer = null;
    const el = getEl();
    if (el) el.classList.add('hidden');
  }

  function forceHide() {
    depth = 0;
    clearInterval(msgTimer);
    msgTimer = null;
    const el = getEl();
    if (el) el.classList.add('hidden');
  }

  return { show, hide, forceHide };
})();

// ─── Toast Notifications ─────────────────────────────────────────────────────
// Toast Notifications
const toast = {
  container: document.getElementById('toast-container'),

  show(message, type = 'info', duration = 3000) {
    const toastEl = document.createElement('div');
    toastEl.className = `toast ${type}`;
    
    const icon = {
      success: 'check-circle',
      error: 'exclamation-circle',
      warning: 'exclamation-triangle',
      info: 'info-circle'
    }[type];

    toastEl.innerHTML = `
      <i class="fas fa-${icon}"></i>
      <span>${message}</span>
    `;

    this.container.appendChild(toastEl);

    setTimeout(() => {
      toastEl.style.opacity = '0';
      toastEl.style.transform = 'translateX(100%)';
      setTimeout(() => toastEl.remove(), 300);
    }, duration);
  },

  success(message) {
    this.show(message, 'success');
  },

  error(message) {
    this.show(message, 'error');
  },

  warning(message) {
    this.show(message, 'warning');
  },

  info(message) {
    this.show(message, 'info');
  }
};

// Modal Manager
const modal = {
  getOverlay() {
    return document.getElementById('modal-overlay');
  },
  
  open(modalId) {
    const modalEl = document.getElementById(modalId);
    const overlay = this.getOverlay();
    if (modalEl && overlay) {
      overlay.classList.remove('hidden');
      modalEl.classList.remove('hidden');
    }
  },

  close(modalId) {
    const modalEl = document.getElementById(modalId);
    const overlay = this.getOverlay();
    if (modalEl) {
      modalEl.classList.add('hidden');
    }
    if (overlay) {
      const openModals = overlay.querySelectorAll('.modal:not(.hidden)');
      if (openModals.length === 0) {
        overlay.classList.add('hidden');
      }
    }
  },

  closeAll() {
    const overlay = this.getOverlay();
    if (overlay) {
      const modals = overlay.querySelectorAll('.modal');
      modals.forEach(m => m.classList.add('hidden'));
      overlay.classList.add('hidden');
    }
  }
};

// Format currency
const formatCurrency = (amount) => {
  return '₹' + parseFloat(amount).toFixed(2);
};

// Format date
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

// Format datetime
const formatDateTime = (dateString) => {
  return new Date(dateString).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Get status badge HTML
const getStatusBadge = (status) => {
  if (!status) return '<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:50px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;background:#64748b;color:#fff"><i class="fas fa-info-circle"></i> Unknown</span>';

  const statusStr = String(status).trim();

  const styleMap = {
    // Payment status
    'Paid':                   { bg: '#10b981', icon: 'fa-check-circle' },   // green
    'Pending':                { bg: '#ef4444', icon: 'fa-clock' },           // red
    'Partially Paid':         { bg: '#eab308', icon: 'fa-exclamation-circle' }, // yellow
    'Failed':                 { bg: '#ef4444', icon: 'fa-times-circle' },    // red
    'Verification Pending':   { bg: '#f59e0b', icon: 'fa-hourglass-half' },  // orange

    // Order status
    'Confirmed':  { bg: '#3b82f6', icon: 'fa-check-double' },
    'Processing': { bg: '#f59e0b', icon: 'fa-cog' },
    'Shipped':    { bg: '#6366f1', icon: 'fa-shipping-fast' },
    'Delivered':  { bg: '#10b981', icon: 'fa-box' },
    'Cancelled':  { bg: '#ef4444', icon: 'fa-ban' },

    // Refund status
    'Refunded':     { bg: '#3b82f6', icon: 'fa-undo' },
    'Not Refunded': { bg: '#f59e0b', icon: 'fa-hand-holding-usd' }
  };

  const s = styleMap[statusStr] || { bg: '#64748b', icon: 'fa-tag' };
  const baseStyle = `display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:50px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;background:${s.bg};color:#fff;transition:transform 0.15s,box-shadow 0.15s;cursor:default;`;
  return `<span style="${baseStyle}" onmouseenter="this.style.transform='scale(1.07)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.25)'" onmouseleave="this.style.transform='scale(1)';this.style.boxShadow='none'"><i class="fas ${s.icon}"></i> ${statusStr}</span>`;
};

// Custom Dropdown UI for select elements
const customDropdown = {
  init(selector) {
    document.querySelectorAll(selector).forEach(select => {
      if (select.dataset.customized) return;
      select.dataset.customized = "true";
      select.style.display = 'none';

      const wrapper = document.createElement('div');
      wrapper.className = 'custom-select-wrapper';
      wrapper.style.position = 'relative';
      wrapper.style.display = 'inline-block';
      wrapper.style.width = select.style.minWidth || 'auto';
      if (select.style.minWidth) wrapper.style.minWidth = select.style.minWidth;

      const trigger = document.createElement('div');
      trigger.className = 'custom-select-trigger';
      trigger.style.padding = '8px 12px';
      trigger.style.background = '#fff';
      trigger.style.border = '1px solid #cbd5e1';
      trigger.style.borderRadius = '6px';
      trigger.style.cursor = 'pointer';
      trigger.style.display = 'flex';
      trigger.style.justifyContent = 'space-between';
      trigger.style.alignItems = 'center';
      trigger.style.fontSize = '13.5px';
      trigger.style.color = '#334155';
      trigger.style.fontWeight = '500';
      trigger.style.userSelect = 'none';
      
      const span = document.createElement('span');
      span.textContent = select.options[select.selectedIndex]?.text || '';
      trigger.appendChild(span);
      
      const icon = document.createElement('i');
      icon.className = 'fas fa-chevron-down';
      icon.style.color = '#94a3b8';
      icon.style.marginLeft = '12px';
      icon.style.transition = 'transform 0.2s';
      trigger.appendChild(icon);

      const list = document.createElement('div');
      list.className = 'custom-select-options';
      list.style.position = 'absolute';
      list.style.top = 'calc(100% + 4px)';
      list.style.left = '0';
      list.style.minWidth = '100%';
      list.style.background = '#fff';
      list.style.border = '1px solid #e2e8f0';
      list.style.borderRadius = '8px';
      list.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)';
      list.style.zIndex = '9999';
      list.style.display = 'none';
      list.style.maxHeight = '250px';
      list.style.overflowY = 'auto';
      list.style.padding = '6px 0';
      // Ensure words don't wrap weirdly in dropdowns
      list.style.whiteSpace = 'nowrap';

      Array.from(select.options).forEach(opt => {
        const optionEl = document.createElement('div');
        optionEl.className = 'custom-select-option';
        optionEl.textContent = opt.text;
        optionEl.style.padding = '10px 16px';
        optionEl.style.cursor = 'pointer';
        optionEl.style.fontSize = '13.5px';
        optionEl.style.color = '#475569';
        optionEl.style.transition = 'background 0.2s, color 0.2s';
        
        if (opt.selected) {
          optionEl.style.background = '#f0fdf4';
          optionEl.style.color = 'var(--primary)';
          optionEl.style.fontWeight = '600';
        }

        optionEl.onmouseenter = () => {
          if (!opt.selected) optionEl.style.background = '#f8fafc';
        };
        optionEl.onmouseleave = () => {
          if (!opt.selected) optionEl.style.background = 'transparent';
        };

        optionEl.onclick = (e) => {
          e.stopPropagation();
          select.value = opt.value;
          span.textContent = opt.text;
          
          Array.from(list.children).forEach((child, idx) => {
            child.style.background = 'transparent';
            child.style.color = '#475569';
            child.style.fontWeight = '400';
            opt.selected = false;
            select.options[idx].selected = false;
          });
          
          opt.selected = true;
          optionEl.style.background = '#f0fdf4';
          optionEl.style.color = 'var(--primary)';
          optionEl.style.fontWeight = '600';

          list.style.display = 'none';
          icon.style.transform = 'rotate(0)';
          trigger.style.borderColor = '#cbd5e1';
          trigger.style.boxShadow = 'none';
          
          select.dispatchEvent(new Event('change'));
        };
        list.appendChild(optionEl);
      });

      trigger.onclick = (e) => {
        e.stopPropagation();
        const isOpen = list.style.display === 'block';
        document.querySelectorAll('.custom-select-options').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.custom-select-trigger i').forEach(el => el.style.transform = 'rotate(0)');
        document.querySelectorAll('.custom-select-trigger').forEach(el => {
          el.style.borderColor = '#cbd5e1';
          el.style.boxShadow = 'none';
        });
        
        if (!isOpen) {
          list.style.display = 'block';
          icon.style.transform = 'rotate(180deg)';
          trigger.style.borderColor = 'var(--primary)';
          trigger.style.boxShadow = '0 0 0 3px rgba(30, 95, 91, 0.1)';
        }
      };

      document.addEventListener('click', () => {
        list.style.display = 'none';
        icon.style.transform = 'rotate(0)';
        trigger.style.borderColor = '#cbd5e1';
        trigger.style.boxShadow = 'none';
      });

      wrapper.appendChild(trigger);
      wrapper.appendChild(list);
      select.parentNode.insertBefore(wrapper, select);
    });
  }
};

// Debounce function
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Confirm dialog
const confirmDialog = (message) => {
  return new Promise((resolve) => {
    const confirmed = window.confirm(message);
    resolve(confirmed);
  });
};

// Loading state
const setLoading = (element, isLoading) => {
  if (isLoading) {
    element.disabled = true;
    element.dataset.originalText = element.innerHTML;
    element.innerHTML = '<span class="spinner"></span> Loading...';
  } else {
    element.disabled = false;
    element.innerHTML = element.dataset.originalText || element.innerHTML;
  }
};

// Table sorting
const sortTable = (table, column, asc = true) => {
  const tbody = table.querySelector('tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  
  rows.sort((a, b) => {
    const aVal = a.cells[column].textContent.trim();
    const bVal = b.cells[column].textContent.trim();
    
    if (asc) {
      return aVal.localeCompare(bVal, undefined, { numeric: true });
    } else {
      return bVal.localeCompare(aVal, undefined, { numeric: true });
    }
  });
  
  rows.forEach(row => tbody.appendChild(row));
};

// Pagination
const createPagination = (currentPage, totalPages, onPageChange) => {
  const container = document.createElement('div');
  container.className = 'pagination';

  // Previous button
  const prevBtn = document.createElement('button');
  prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => onPageChange(currentPage - 1);
  container.appendChild(prevBtn);

  // Page numbers
  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  
  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    const firstBtn = document.createElement('button');
    firstBtn.textContent = '1';
    firstBtn.onclick = () => onPageChange(1);
    container.appendChild(firstBtn);
    if (startPage > 2) {
      const ellipsis = document.createElement('span');
      ellipsis.textContent = '...';
      container.appendChild(ellipsis);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.textContent = i;
    if (i === currentPage) {
      pageBtn.classList.add('active');
    }
    pageBtn.onclick = () => onPageChange(i);
    container.appendChild(pageBtn);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement('span');
      ellipsis.textContent = '...';
      container.appendChild(ellipsis);
    }
    const lastBtn = document.createElement('button');
    lastBtn.textContent = totalPages;
    lastBtn.onclick = () => onPageChange(totalPages);
    container.appendChild(lastBtn);
  }

  // Next button
  const nextBtn = document.createElement('button');
  nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => onPageChange(currentPage + 1);
  container.appendChild(nextBtn);

  return container;
};

// Search highlight
const highlightText = (text, searchTerm) => {
  if (!searchTerm) return text;
  const regex = new RegExp(`(${searchTerm})`, 'gi');
  return text.replace(regex, '<span class="highlight">$1</span>');
};

// Export data to CSV
const exportToCSV = (data, filename) => {
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(h => `"${row[h]}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
};

// Print element
const printElement = (element) => {
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>Print</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        </style>
      </head>
      <body>
        ${element.innerHTML}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
};

// Initialize modal close buttons
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.closeAll();
    });
  });

  document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      modal.closeAll();
    }
  });
});
