-- Market Masters Database Schema
-- Run this script to create the database manually if needed
-- Note: The application uses Sequelize ORM which will auto-create tables

CREATE DATABASE IF NOT EXISTS market_masters CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE market_masters;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(100) UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('shopkeeper', 'customer') DEFAULT 'customer',
  shopName VARCHAR(100),
  shopAddress TEXT,
  isActive BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  stock INT NOT NULL DEFAULT 0,
  lowStockThreshold INT NOT NULL DEFAULT 10,
  expiryDate DATE,
  category VARCHAR(50),
  barcode VARCHAR(50),
  image LONGTEXT,
  userId INT NOT NULL,
  isActive BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id)
);

-- Bills table
CREATE TABLE IF NOT EXISTS bills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  billNumber VARCHAR(20) NOT NULL UNIQUE,
  userId INT NOT NULL,
  customerName VARCHAR(100),
  customerPhone VARCHAR(20),
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  discount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  totalAmount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  paidAmount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  dueAmount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  paymentStatus ENUM('Paid', 'Pending', 'Partially Paid') DEFAULT 'Pending',
  dueDate DATE,
  pdfUrl VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id)
);

-- Bill Items table
CREATE TABLE IF NOT EXISTS bill_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  billId INT NOT NULL,
  productId INT,
  productName VARCHAR(200) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unitPrice DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (billId) REFERENCES bills(id) ON DELETE CASCADE,
  FOREIGN KEY (productId) REFERENCES products(id)
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  billId INT NOT NULL,
  amountPaid DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  paymentMode ENUM('Cash', 'UPI', 'Card', 'Net Banking') NOT NULL,
  transactionId VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (billId) REFERENCES bills(id) ON DELETE CASCADE
);

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  description TEXT,
  expenseDate DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  type ENUM('bill', 'reminder', 'report', 'low_stock', 'expiry_alert') NOT NULL,
  recipientPhone VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  billId INT,
  status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
  sentAt TIMESTAMP,
  errorMessage TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (billId) REFERENCES bills(id)
);

-- Indexes for better performance
CREATE INDEX idx_bills_userId ON bills(userId);
CREATE INDEX idx_bills_paymentStatus ON bills(paymentStatus);
CREATE INDEX idx_bills_created_at ON bills(created_at);
CREATE INDEX idx_payments_billId ON payments(billId);
CREATE INDEX idx_payments_paymentMode ON payments(paymentMode);
CREATE INDEX idx_expenses_userId ON expenses(userId);
CREATE INDEX idx_expenses_expenseDate ON expenses(expenseDate);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_barcode ON products(barcode);
