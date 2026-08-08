// Inventory Module
const inventory = {
  products: [],
  listenersSetup: false,

  async load() {
    const isShopkeeper = auth.user?.role === 'shopkeeper';
    
    await this.loadProducts();
    if (!this.listenersSetup) {
      this.setupEventListeners();
      this.listenersSetup = true;
    }
    
    // Show/hide shopkeeper-only elements
    this.setupCustomerView();
  },

  setupCustomerView() {
    const isShopkeeper = auth.user?.role === 'shopkeeper';
    
    // Hide add product button for customers
    const addProductBtn = document.getElementById('add-product-btn');
    if (addProductBtn) {
      addProductBtn.style.display = isShopkeeper ? 'block' : 'none';
    }
    
    // Hide low stock alerts for customers (dashboard)
    const lowStockAlert = document.getElementById('low-stock-alert');
    if (lowStockAlert) {
      lowStockAlert.style.display = isShopkeeper ? 'block' : 'none';
    }
    
    // Keep inventory low stock alert hidden - checkLowStock() will control it
    // Don't set display here to avoid flash
    
    // Change page title for customers
    const pageTitle = document.getElementById('page-title');
    if (pageTitle && !isShopkeeper) {
      pageTitle.textContent = 'Browse Products';
    }
  },

  async loadProducts() {
    try {


      const response = await inventoryAPI.getProducts();
      this.products = response.products || [];



      if (this.products.length === 0) {

      }
      
      this.renderProducts();

      // Check low stock after loading (only for shopkeepers)
      if (auth.user?.role === 'shopkeeper') {
        await this.checkLowStock();
      }
    } catch (error) {
      console.error('Error loading products:', error);
      console.error('Error stack:', error.stack);
      toast.error('Failed to load products: ' + error.message);
    }
  },

  setupEventListeners() {
    // Add product button
    document.getElementById('add-product-btn')?.addEventListener('click', () => {
      modal.open('add-product-modal');
    });

    // Add product form
    document.getElementById('add-product-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.createProduct();
    });

    // Edit product form
    document.getElementById('edit-product-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.updateProduct();
    });

    // Search
    document.getElementById('product-search')?.addEventListener('input', debounce((e) => {
      this.searchProducts(e.target.value);
    }, 300));
  },

  renderProducts() {
    const tbody = document.getElementById('products-table');
    if (!tbody) {
      console.error('Products table element not found!');
      return;
    }

    const isShopkeeper = auth.user?.role === 'shopkeeper';

    if (this.products.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${isShopkeeper ? 8 : 5}" class="text-center">
            <div class="empty-state">
              <i class="fas fa-boxes"></i>
              <p>No products found</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    // Update table head headers dynamically for shopkeeper (edit view)
    const theadRow = document.querySelector('#inventory-page thead tr');
    if (theadRow) {
      if (isShopkeeper) {
        theadRow.innerHTML = `
          <th>Name</th>
          <th>MRP</th>
          <th>Billing Amount / Cost</th>
          <th>Stock</th>
          <th>Category</th>
          <th>Actions</th>
        `;
      } else {
        // Customer / Browse view: show shop name, MRP, stock, category, actions (Add to Cart)
        theadRow.innerHTML = `
          <th>Name</th>
          <th>Shop</th>
          <th>MRP</th>
          <th>Stock</th>
          <th>Category</th>
          <th>Actions</th>
        `;
      }
    }

    tbody.innerHTML = this.products.map(product => {
      const stockStatus = product.stock === 0 ? 'out' : 
                         product.stock <= product.lowStockThreshold ? 'low' : 'good';

      const mrpVal = formatCurrency(product.mrp || product.price || 0);
      const costVal = product.costPrice ? formatCurrency(product.costPrice) : '-';

      if (isShopkeeper) {
        // Shopkeeper view (editable)
        const actions = `
          <td>
            <button class="btn btn-sm btn-secondary" onclick="inventory.editProduct(${product.id})">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="inventory.deleteProduct(${product.id})">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        `;

        return `
          <tr>
            <td>
              <strong>${product.name}</strong>
              ${product.barcode ? `<br><small class="text-muted"><i class="fas fa-barcode"></i> ${product.barcode}</small>` : ''}
            </td>
            <td><strong>${mrpVal}</strong></td>
            <td>${costVal}</td>
            <td>
              <span class="stock-indicator">
                <span class="stock-dot ${stockStatus}"></span>
                ${product.stock}
              </span>
            </td>
            <td>${product.category || '-'}</td>
            ${actions}
          </tr>
        `;
      } else {
        // Customer / Browse view: show shop name, MRP, and Add to Cart action
        const shopName = product.User && product.User.shopName ? product.User.shopName : '-';
        const addAction = product.stock > 0 ? `
          <td>
            <button class="btn btn-sm btn-primary" onclick="shopping.addToCart(${product.id})">
              <i class="fas fa-cart-plus"></i> Add to Cart
            </button>
          </td>
        ` : `
          <td><button class="btn btn-sm btn-disabled" disabled>Out of Stock</button></td>
        `;

        return `
          <tr>
            <td><strong>${product.name}</strong></td>
            <td>${shopName}</td>
            <td><strong>${mrpVal}</strong></td>
            <td>
              <span class="stock-indicator">
                <span class="stock-dot ${stockStatus}"></span>
                ${product.stock}
              </span>
            </td>
            <td>${product.category || '-'}</td>
            ${addAction}
          </tr>
        `;
      }
    }).join('');

  },

  async searchProducts(query) {
    try {
      const response = await inventoryAPI.getProducts({ search: query });
      this.products = response.products;
      this.renderProducts();
    } catch (error) {
      toast.error('Search failed');
    }
  },

  async createProduct() {
    const productName = document.getElementById('product-name').value.trim();
    
    if (!productName) {
      toast.error('Product name is required!');
      return;
    }
    
    const mrp = parseFloat(document.getElementById('product-mrp').value) || 0;
    
    const productData = {
      name: productName,
      description: document.getElementById('product-description').value,
      mrp: mrp,
      price: mrp,
      costPrice: parseFloat(document.getElementById('product-cost-price').value) || 0,
      stock: parseInt(document.getElementById('product-stock').value) || 0,
      lowStockThreshold: parseInt(document.getElementById('product-low-stock').value) || 10,
      category: document.getElementById('product-category').value,
      barcode: document.getElementById('product-barcode').value.trim()
    };

    // Handle image upload
    const imageFile = document.getElementById('product-image').files[0];
    if (imageFile) {
      try {
        const base64Image = await this.fileToBase64(imageFile);
        productData.image = base64Image;
      } catch (error) {
        console.error('Error converting image:', error);
      }
    }

    try {
      const response = await inventoryAPI.createProduct(productData);

      if (response.stockUpdated) {
        toast.success(response.message || 'Product stock updated successfully!');
      } else {
        toast.success('Product created successfully!');
      }
      
      modal.close('add-product-modal');
      document.getElementById('add-product-form').reset();
      await this.loadProducts();
      
      await this.checkLowStock();
      if (typeof dashboard.checkLowStock === 'function') {
        await dashboard.checkLowStock();
      }
    } catch (error) {
      console.error('Error in createProduct:', error);
      toast.error(error.message || 'Failed to create product');
    }
  },

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  },

  async editProduct(id) {
    try {
      const response = await inventoryAPI.getProduct(id);
      const product = response.product;
      
      document.getElementById('edit-product-id').value = product.id;
      document.getElementById('edit-product-name').value = product.name;
      document.getElementById('edit-product-description').value = product.description || '';
      document.getElementById('edit-product-mrp').value = product.mrp || product.price || '';
      document.getElementById('edit-product-cost-price').value = product.costPrice || '';
      document.getElementById('edit-product-stock').value = product.stock;
      document.getElementById('edit-product-low-stock').value = product.lowStockThreshold;
      document.getElementById('edit-product-category').value = product.category || '';
      document.getElementById('edit-product-barcode').value = product.barcode || '';
      
      modal.open('edit-product-modal');
    } catch (error) {
      toast.error('Failed to load product details');
    }
  },

  async updateProduct() {
    const id = document.getElementById('edit-product-id').value;
    const mrp = parseFloat(document.getElementById('edit-product-mrp').value) || 0;

    const productData = {
      name: document.getElementById('edit-product-name').value,
      description: document.getElementById('edit-product-description').value,
      mrp: mrp,
      price: mrp,
      costPrice: parseFloat(document.getElementById('edit-product-cost-price').value) || 0,
      stock: parseInt(document.getElementById('edit-product-stock').value),
      lowStockThreshold: parseInt(document.getElementById('edit-product-low-stock').value),
      category: document.getElementById('edit-product-category').value,
      barcode: document.getElementById('edit-product-barcode').value.trim()
    };

    // Handle image upload
    const imageFile = document.getElementById('edit-product-image').files[0];
    if (imageFile) {
      try {
        const base64Image = await this.fileToBase64(imageFile);
        productData.image = base64Image;
      } catch (error) {
        console.error('Error converting image:', error);
      }
    }

    try {
      await inventoryAPI.updateProduct(id, productData);
      toast.success('Product updated successfully!');
      modal.close('edit-product-modal');
      document.getElementById('edit-product-form').reset();
      await this.loadProducts();
      
      // Refresh low stock alerts automatically
      await this.checkLowStock();
      
      // Also refresh dashboard low stock alert if on dashboard
      if (typeof dashboard.checkLowStock === 'function') {
        await dashboard.checkLowStock();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to update product');
    }
  },

  async deleteProduct(id) {
    const confirmed = await confirmDialog('Are you sure you want to delete this product? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await inventoryAPI.deleteProduct(id);
      toast.success('Product deleted successfully!');
      await this.loadProducts();
    } catch (error) {
      console.error('Delete product error:', error);
      toast.error(error.message || 'Failed to delete product');
    }
  },

  async checkLowStock() {
    // Only shopkeepers should see low stock alerts
    const isShopkeeper = auth.user?.role === 'shopkeeper';
    if (!isShopkeeper) {
      // Hide low stock alert for customers
      const alertBox = document.getElementById('inventory-low-stock-alert');
      if (alertBox) {
        alertBox.style.display = 'none';
      }
      return;
    }

    try {
      const response = await inventoryAPI.getProducts();
      const products = response.products || [];


      // Show all products with their stock status
      products.forEach(p => {
        const stock = parseInt(p.stock) || 0;
        const threshold = parseInt(p.lowStockThreshold) || 10;
        const status = stock === 0 ? 'OUT OF STOCK' : stock <= threshold ? 'LOW STOCK' : 'OK';

      });
      
      // Filter low stock products (stock <= lowStockThreshold)
      const lowStockProducts = products.filter(p => {
        const stock = parseInt(p.stock) || 0;
        const threshold = parseInt(p.lowStockThreshold) || 10;
        const isLow = stock <= threshold && stock > 0;
        if (isLow) {

        }
        return isLow;
      });

      // Filter out of stock products (stock = 0)
      const outOfStockProducts = products.filter(p => {
        const stock = parseInt(p.stock) || 0;
        const isOut = stock === 0;
        if (isOut) {

        }
        return isOut;
      });


      // Show alert if there are low stock or out of stock products
      const alertBox = document.getElementById('inventory-low-stock-alert');
      const productsContainer = document.getElementById('inventory-low-stock-products');
      
      if (!alertBox || !productsContainer) {

        return;
      }
      
      if (lowStockProducts.length > 0 || outOfStockProducts.length > 0) {
        let html = '';
        
        // Out of stock products first (more critical)
        outOfStockProducts.forEach(product => {
          html += `
            <div class="low-stock-product">
              <i class="fas fa-exclamation-circle"></i>
              <div>
                <div class="product-name">${product.name}</div>
                <div class="product-stock" style="color: #e74c3c; font-weight: bold;">OUT OF STOCK</div>
              </div>
            </div>
          `;
        });
        
        // Low stock products
        lowStockProducts.forEach(product => {
          const threshold = parseInt(product.lowStockThreshold) || 10;
          html += `
            <div class="low-stock-product">
              <i class="fas fa-exclamation-triangle"></i>
              <div>
                <div class="product-name">${product.name}</div>
                <div class="product-stock">Stock: ${product.stock}/${threshold} units</div>
              </div>
            </div>
          `;
        });
        
        productsContainer.innerHTML = html;
        alertBox.style.display = 'block';

      } else {
        alertBox.style.display = 'none';

      }
    } catch (error) {
      console.error('Low stock check error:', error);
    }
  }
};

// Global function to close inventory low stock alert
function closeInventoryLowStockAlert(event) {
  if (event) {
    event.stopPropagation();
  }
  const alertBox = document.getElementById('inventory-low-stock-alert');
  if (alertBox) {
    alertBox.style.display = 'none';
  }
}
