// Profile Module
const profile = {
  userData: null,
  listenersSetup: false,

  async load() {
    await this.loadProfile();
    if (!this.listenersSetup) {
      this.setupEventListeners();
      this.listenersSetup = true;
    }
  },

  async loadProfile() {
    try {
      const response = await authAPI.getProfile();
      this.userData = response.user;
      this.renderProfile();
    } catch (error) {
      console.error('Error loading profile:', error);
      if (error.message === 'User not found or inactive.' || error.message.includes('Unauthorized')) {
        toast.error('Session expired. Please login again.');
        api.clearToken();
        auth.showAuth();
      } else {
        toast.error('Failed to load profile');
      }
    }
  },

  renderProfile() {
    if (!this.userData) return;

    const isShopkeeper = this.userData.role === 'shopkeeper';

    // Update page title
    const pageTitle = document.querySelector('#profile-page .card-header h3');
    if (pageTitle) {
      pageTitle.textContent = isShopkeeper ? 'Shopkeeper Profile' : 'My Profile';
    }

    // View mode
    document.getElementById('profile-name').textContent = this.userData.name || '-';
    const phoneElement = document.getElementById('profile-phone');
    phoneElement.innerHTML = `${this.userData.phone && this.userData.phone !== '-' ? '<i class="fas fa-phone" onclick="copyPhoneNumber(\'' + this.userData.phone + '\', event)" title="Click to copy phone number" style="cursor: pointer; color: var(--primary);"></i> ' : ''}${this.userData.phone || '-'}`;
    document.getElementById('profile-email').textContent = this.userData.email || '-';
    document.getElementById('profile-role').textContent = this.userData.role || '-';
    
    // Show/hide shop information based on role
    const shopInfoSection = document.querySelector('#profile-view .profile-section:nth-child(2)');
    if (shopInfoSection) {
      shopInfoSection.style.display = isShopkeeper ? 'block' : 'none';
    }
    
    if (isShopkeeper) {
      document.getElementById('profile-shop-name').textContent = this.userData.shopName || '-';
      document.getElementById('profile-shop-address').textContent = this.userData.shopAddress || '-';
      document.getElementById('profile-upi-id').textContent = this.userData.upiId || 'Not set';
      
      // Display UPI QR code if available
      const qrImage = document.getElementById('profile-upi-qr-image');
      const qrText = document.getElementById('profile-upi-qr-text');
      if (this.userData.upiQrCode) {
        qrImage.src = this.userData.upiQrCode;
        qrImage.style.display = 'block';
        qrText.style.display = 'none';
      } else {
        qrImage.style.display = 'none';
        qrText.style.display = 'inline';
      }
    }

    // Edit mode
    document.getElementById('edit-profile-name').value = this.userData.name || '';
    document.getElementById('edit-profile-phone').value = this.userData.phone || '';
    document.getElementById('edit-profile-email').value = this.userData.email || '';
    document.getElementById('edit-profile-shop-name').value = this.userData.shopName || '';
    document.getElementById('edit-profile-shop-address').value = this.userData.shopAddress || '';
    document.getElementById('edit-profile-upi-id').value = this.userData.upiId || '';
    
    // Show/hide shop info in edit mode
    const editShopSection = document.querySelector('#profile-edit .profile-section:nth-child(2)');
    if (editShopSection) {
      editShopSection.style.display = isShopkeeper ? 'block' : 'none';
    }
    
    // Make shop fields not required for customers
    const shopNameInput = document.getElementById('edit-profile-shop-name');
    if (shopNameInput) {
      shopNameInput.required = isShopkeeper;
    }
  },

  setupEventListeners() {
    // Edit button
    const editBtn = document.getElementById('edit-profile-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        this.showEditMode();
      });
    }

    // Cancel button
    const cancelBtn = document.getElementById('cancel-edit-profile');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.showViewMode();
      });
    }

    // QR Code file upload preview
    const qrFileInput = document.getElementById('edit-profile-upi-qr-file');
    if (qrFileInput) {
      qrFileInput.addEventListener('change', (e) => {
        this.handleQRCodeUpload(e);
      });
    }

    // Form submission
    const form = document.getElementById('edit-profile-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveProfile();
      });
    }
  },

  handleQRCodeUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size should be less than 2MB');
      return;
    }

    // Read and preview the image
    const reader = new FileReader();
    reader.onload = (e) => {
      const previewImage = document.getElementById('upi-qr-preview-image');
      if (previewImage) {
        previewImage.src = e.target.result;
        previewImage.style.display = 'block';
      }
      // Store the base64 data for submission
      this.qrCodeBase64 = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  showEditMode() {
    document.getElementById('profile-view').classList.add('hidden');
    document.getElementById('profile-edit').classList.remove('hidden');
    document.getElementById('edit-profile-btn').classList.add('hidden');
  },

  showViewMode() {
    document.getElementById('profile-view').classList.remove('hidden');
    document.getElementById('profile-edit').classList.add('hidden');
    document.getElementById('edit-profile-btn').classList.remove('hidden');
    document.getElementById('edit-profile-current-password').value = '';
  },

  async saveProfile() {
    const currentPassword = document.getElementById('edit-profile-current-password').value;
    if (!currentPassword) {
      toast.error('Current password is required to save changes');
      return;
    }

    const isShopkeeper = this.userData?.role === 'shopkeeper';

    const data = {
      name: document.getElementById('edit-profile-name').value,
      phone: document.getElementById('edit-profile-phone').value,
      email: document.getElementById('edit-profile-email').value,
      currentPassword: currentPassword
    };

    // Only include shop info for shopkeepers
    if (isShopkeeper) {
      data.shopName = document.getElementById('edit-profile-shop-name').value;
      data.shopAddress = document.getElementById('edit-profile-shop-address').value;
      data.upiId = document.getElementById('edit-profile-upi-id').value;
      // Include QR code if uploaded
      if (this.qrCodeBase64) {
        data.upiQrCode = this.qrCodeBase64;
      }
    }

    try {
      await authAPI.updateProfile(data);
      toast.success('Profile updated successfully');
      
      // Update local user data
      this.userData = { ...this.userData, ...data };
      
      // Update sidebar display
      document.getElementById('user-name').textContent = data.name;
      
      this.renderProfile();
      this.showViewMode();
      
      // Clear QR code base64 after successful save
      this.qrCodeBase64 = null;
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    }
  }
};
